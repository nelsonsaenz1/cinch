-- ===========================================================================
-- The free tier's event boundary, restated: THREE EVENTS, EVER.
--
-- Founder directive 2026-08-21: "Events need to be limited to 3 events
-- all-time until you get a paid account. Can't join with a free account
-- after you've joined 3 events total." All-time is the load-bearing word,
-- and it is why a count over `event_members` cannot enforce this:
--
--   · leaving an event HARD-DELETES the member's own row (that is the
--     designed exit — absence, not an announcement), and
--   · a deleted event cascades its whole roster away.
--
-- Either one would hand a free account infinite events three at a time. So
-- the fact "this account has entered this event" is recorded ONCE, in a
-- ledger nothing in the app ever deletes, and the gate counts the ledger.
--
--   event_join_ledger      (user_id, event_id, joined_at) — insert-once.
--                          event_id carries NO foreign key on purpose: the
--                          fact must survive the event's deletion, and an FK
--                          would either block that deletion or erase the
--                          fact with it. user_id cascades with the account —
--                          a deleted account owes no history.
--
--   enforce/record via one BEFORE trigger on event_members, on any write
--   that lands a row in state 'joined' (a fresh insert — including the
--   host's own seat from handle_new_event — or an invite accepted). Order:
--     1. already in the ledger for THIS event → free to (re)join: the event
--        was paid for in ledger terms the first time.
--     2. plan is free AND the ledger already holds 3 → refuse, with the
--        errcode/hint grammar `enforce_event_limit` set.
--     3. otherwise record and allow.
--   Hosting counts: the host's seat is a joined membership and "3 events
--   all-time" does not exempt the ones you threw. (The 2-concurrent hosting
--   ceiling still applies first on the hosting path.)
--
-- WHY A TRIGGER AND NOT THE CLIENT: the founder's same directive — "no
-- work-arounds for any of our hard paywall gates". The client's copy of this
-- boundary is a courtesy screen; this is the boundary. SECURITY DEFINER so
-- the ledger needs no INSERT grant for `authenticated` at all — the trigger
-- is the only writer, and a patched client cannot spoof or skip it.
--
-- The number 3 lives in event_join_limit_for_plan beside its siblings; the
-- client copy goes next to PLAN_ITEM_LIMITS in src/features/billing/plans.ts
-- (change one, change the other — tests/plans.test.ts is the tripwire).
-- ===========================================================================

create table public.event_join_ledger (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

alter table public.event_join_ledger enable row level security;

-- The owner may read their own history — that is how the app draws "2 of 3
-- events used" without a round trip through a function. Nobody inserts,
-- updates or deletes through the API; the trigger is the only writer.
create policy "join ledger: own rows readable" on public.event_join_ledger
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.event_join_ledger from public, anon;
grant select on public.event_join_ledger to authenticated;

create function public.event_join_limit_for_plan(p_plan public.subscription_plan) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan when 'free' then 3 else null end;
$$;

create function public.enforce_event_join_cap() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_limit integer; v_count integer;
begin
  -- Only the transition INTO 'joined' is the boundary. Invites, declines,
  -- removals and tombstones are not events entered.
  if new.state <> 'joined' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.state = 'joined' then
    return new; -- already joined; some other column moved.
  end if;

  -- An event already on this account's ledger was counted when it was first
  -- entered; rejoining it costs nothing more.
  if exists (
    select 1 from public.event_join_ledger l
     where l.user_id = new.user_id and l.event_id = new.event_id
  ) then
    return new;
  end if;

  v_limit := public.event_join_limit_for_plan(public.effective_plan(new.user_id));
  if v_limit is not null then
    select count(*) into v_count from public.event_join_ledger l
     where l.user_id = new.user_id;
    if v_count >= v_limit then
      raise exception 'event_join_limit_reached: % of % lifetime events', v_count, v_limit
        using errcode = 'check_violation', hint = 'Upgrade to join more events.';
    end if;
  end if;

  insert into public.event_join_ledger (user_id, event_id)
  values (new.user_id, new.event_id)
  on conflict do nothing;

  return new;
end; $$;

revoke execute on function public.event_join_limit_for_plan(public.subscription_plan)
  from public, anon, authenticated;
revoke execute on function public.enforce_event_join_cap() from public, anon, authenticated;

create trigger event_members_enforce_join_cap
  before insert or update on public.event_members
  for each row execute function public.enforce_event_join_cap();

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Every CURRENT joined membership predates the ledger and is history the rule
-- is about. What cannot be recovered — rows already deleted by leaving, or by
-- event deletion — is forgiven rather than guessed: the boundary starts
-- counting from the truth it can prove.
insert into public.event_join_ledger (user_id, event_id, joined_at)
select m.user_id, m.event_id, m.created_at
  from public.event_members m
 where m.state = 'joined'
on conflict do nothing;
