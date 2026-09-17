-- ---------------------------------------------------------------------------
-- A89 (2026-09-16 nightly): every send carries its delivery outcome, in a table.
--
-- WHAT WAS TRUE BEFORE
--
-- The receipt leg was wired (audit item 25) and it worked: the first three
-- sends in the product's history went out at 12:15:02Z on 2026-09-16 and the
-- 12:37Z receipts tick logged `asked 3, delivered 3, failed 0`. But the only
-- record of that verdict was a line in the function log. `push_receipts` is a
-- QUEUE — a row is deleted the moment Expo answers for it — so a reader who
-- opened the table afterwards found it empty and concluded the leg was not
-- wired at all. An empty queue and an unwired leg look identical from a table
-- that only ever holds the unanswered.
--
-- WHAT THIS ADDS
--
-- The verdict is written where the send is: `push_sends.delivered_at` when the
-- receipt came back `ok` (Apple accepted the message for that device), and
-- `push_sends.receipt_error` with Expo's reason when it did not. A send row
-- with neither is a send whose receipt has not been read yet, or aged out —
-- unknown, and printed as unknown. To find the send row from a ticket, the
-- queue row now carries the claim it was sent for (user_id, dedupe_key); the
-- channel it already had.
--
-- `push_claim_receipts` returns those two columns, so its shape changes and it
-- is dropped and recreated; its guest list is restated because a fresh
-- function starts with the default grant to PUBLIC.
-- ---------------------------------------------------------------------------

alter table public.push_receipts
  add column if not exists user_id    uuid,
  add column if not exists dedupe_key text;

comment on column public.push_receipts.user_id is
  'The claim this ticket was sent for, so a receipt can stamp its push_sends row. Nullable only for rows parked before 2026-09-17; none existed.';

alter table public.push_sends
  add column if not exists delivered_at  timestamptz,
  add column if not exists receipt_error text;

comment on column public.push_sends.delivered_at is
  'Set when Expo''s receipt for this send came back ok — Apple accepted the message for the device. Null means the receipt was not (yet) read, never that it failed.';
comment on column public.push_sends.receipt_error is
  'Expo''s reason when the receipt came back as an error (DeviceNotRegistered, MessageTooBig, …). Null means no error has been read.';

drop function if exists public.push_claim_receipts(integer);

create function public.push_claim_receipts(p_limit integer default 1000)
returns table (ticket_id text, token text, user_id uuid, dedupe_key text)
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
  returning r.ticket_id, r.token, r.user_id, r.dedupe_key;
end;
$$;

revoke execute on function public.push_claim_receipts(integer) from public, anon, authenticated;
grant  execute on function public.push_claim_receipts(integer) to service_role, postgres;

comment on function public.push_claim_receipts(integer) is
  'Claims parked Expo tickets whose receipt is due (15 min – 24 h old, under six attempts, ten minutes apart). Returns the claim each ticket was sent for so the collector can stamp push_sends.';
