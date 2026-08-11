-- Audit item 25. Find out whether a notification actually arrived.
--
-- WHAT WAS MISSING
--
-- Expo answers a send with a TICKET per message, and a ticket means "accepted
-- for delivery" — never "delivered". The real answer is a RECEIPT, fetched
-- minutes later against the ticket id. `_shared/push.ts` said so in its own
-- docblock and then did not fetch them, so everything after the handoff to
-- exp.host was invisible: a token Apple had retired, a payload APNs rejected, a
-- certificate that had expired. All of it read as `accepted`.
--
-- The expensive case is `DeviceNotRegistered`. It arrives at TICKET time only
-- when Expo already knows the token is dead; when Apple is the one who knows,
-- it comes back on the receipt. Without this, those rows live forever and every
-- future sweep pays to push to a device that will never answer — and the user's
-- real device, with its new token, looks like just another row.
--
-- WHY A TABLE
--
-- Receipts cannot be read in the same invocation that sends: Expo asks for a
-- wait, and the sweep that sent has nothing to wait with. So ticket ids are
-- parked here and a later tick collects them. Expo keeps a receipt for about 24
-- hours; after that the answer is gone and the row is only clutter, which is
-- what `push_receipts_prune` is for.

create table push_receipts (
  -- Expo's ticket id. Unique per message, and the only handle the receipt
  -- endpoint accepts.
  ticket_id text primary key,
  -- Carried so a DeviceNotRegistered receipt can retire the right row without a
  -- join back through a ledger that may itself have been pruned.
  token text not null,
  channel text not null,
  created_at timestamptz not null default now(),
  -- Bounded retry. Expo can answer "not ready yet" for a while, and without a
  -- counter a permanently unanswerable ticket would be re-fetched every tick
  -- until the 24-hour prune.
  attempts integer not null default 0,
  last_attempt_at timestamptz
);

comment on table push_receipts is
  'Expo ticket ids awaiting a delivery receipt. Rows are deleted the moment a receipt resolves them; anything still here after 24h is past the point Expo will answer and gets pruned.';

create index push_receipts_due_idx on push_receipts (created_at);

alter table push_receipts enable row level security;
-- No policies. Service role only. A ticket id is a handle to somebody's
-- notification and is no business of any client.

-- ---------------------------------------------------------------------------
-- Claim a batch to look up.
--
-- `for update skip locked` so two overlapping ticks divide the work instead of
-- fetching the same ids twice — the same pattern the send claims use.
--
-- The 15-minute floor is Expo's own guidance: asking sooner mostly returns
-- nothing and burns the attempt counter. The 24-hour ceiling is the point past
-- which Expo has dropped the receipt, so there is nothing left to ask for.
-- ---------------------------------------------------------------------------
create function push_claim_receipts(p_limit integer default 1000)
returns table (ticket_id text, token text)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.push_receipts r
     set attempts        = r.attempts + 1,
         last_attempt_at = now()
   where r.ticket_id in (
     select c.ticket_id
       from public.push_receipts c
      where c.created_at <= now() - interval '15 minutes'
        and c.created_at >  now() - interval '24 hours'
        and c.attempts   <  6
        and (c.last_attempt_at is null or c.last_attempt_at <= now() - interval '10 minutes')
      order by c.created_at
      limit greatest(1, least(p_limit, 1000))
      for update skip locked
   )
  returning r.ticket_id, r.token;
end;
$$;

revoke execute on function push_claim_receipts(integer) from public, anon, authenticated;

-- Anything Expo will no longer answer for. Not a delivery judgement — an
-- unresolved row is an unknown, and the standing refusal is that an unknown is
-- never written down as a fact.
create function push_receipts_prune()
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_deleted integer;
begin
  delete from public.push_receipts where created_at < now() - interval '25 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function push_receipts_prune() from public, anon, authenticated;
grant  execute on function push_receipts_prune() to postgres;
