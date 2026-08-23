-- Standard's five successful stylist chats a month, settled by reservation id.
--
-- ── WHAT REPLACED WHAT ──────────────────────────────────────────────────────
--
-- `25_stylist_success_allowance.sql` tested an aggregate counter that could be
-- decremented by anyone holding a user id. Its "release six times, floor at
-- zero" case was demonstrating the corruption rather than preventing it: each
-- of those releases was erasing a success that had genuinely happened.
--
-- This file tests the correction. Every reservation has an opaque id, every
-- settlement is a transition on that exact row scoped to its owner, and
-- capacity is DERIVED from states rather than maintained as a number — so
-- there is no counter left to drift.

begin;
select plan(30);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','resv-a@example.test','',now(),now(),now()),
       ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','resv-b@example.test','',now(),now(),now()),
       -- c settles a chat across midnight; d holds a slot without having
       -- spent one; e has genuinely spent the month.
       ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','resv-c@example.test','',now(),now(),now()),
       ('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','resv-d@example.test','',now(),now(),now()),
       ('55555555-5555-5555-5555-555555555555','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','resv-e@example.test','',now(),now(),now())
on conflict (id) do nothing;

-- ── The shape of a claim ───────────────────────────────────────────────────
create temp table ids (label text primary key, id uuid);

insert into ids
select 'a', (public.claim_stylist_chat('11111111-1111-1111-1111-111111111111', 5) ->> 'reservation_id')::uuid;
insert into ids
select 'b', (public.claim_stylist_chat('11111111-1111-1111-1111-111111111111', 5) ->> 'reservation_id')::uuid;

select isnt((select id from ids where label='a'), null, 'a claim returns an opaque reservation id');
select isnt(
  (select id from ids where label='a'), (select id from ids where label='b'),
  'two claims are two distinct reservations'
);

-- ── 1. DUPLICATE RELEASE IS A NO-OP ────────────────────────────────────────
select is(
  (public.release_stylist_chat((select id from ids where label='b'),
    '11111111-1111-1111-1111-111111111111', 5) ->> 'changed')::boolean,
  true, 'the first release settles the reservation'
);
select is(
  (public.release_stylist_chat((select id from ids where label='b'),
    '11111111-1111-1111-1111-111111111111', 5) ->> 'changed')::boolean,
  false, 'a DUPLICATE release changes nothing'
);
-- Since 20260824020000, `used` reports COMPLETED successes only (none yet), so
-- the reopened-slot check is the row itself: a duplicate release finds the
-- reservation already `released` and leaves it that way.
select is(
  (public.release_stylist_chat((select id from ids where label='b'),
    '11111111-1111-1111-1111-111111111111', 5) ->> 'state'),
  'released', 'a duplicate release cannot reopen a slot — the old bug'
);

-- ── 2. DUPLICATE COMPLETION IS A NO-OP ─────────────────────────────────────
select is(
  (public.complete_stylist_chat((select id from ids where label='a'),
    '11111111-1111-1111-1111-111111111111', 5) ->> 'changed')::boolean,
  true, 'the first completion settles the reservation'
);
select is(
  (public.complete_stylist_chat((select id from ids where label='a'),
    '11111111-1111-1111-1111-111111111111', 5) ->> 'changed')::boolean,
  false, 'a DUPLICATE completion changes nothing'
);

-- ── 3. A LATE RELEASE AFTER COMPLETION MUST NOT UNDO IT ────────────────────
-- The exact case the previous version corrupted: a timeout firing after the
-- reply landed used to erase a real success.
select is(
  (public.release_stylist_chat((select id from ids where label='a'),
    '11111111-1111-1111-1111-111111111111', 5) ->> 'changed')::boolean,
  false, 'a late release after completion changes nothing'
);
select is(
  (public.release_stylist_chat((select id from ids where label='a'),
    '11111111-1111-1111-1111-111111111111', 5) ->> 'state'),
  'completed', 'the completed reservation stays completed'
);
select is(
  (public.release_stylist_chat((select id from ids where label='a'),
    '11111111-1111-1111-1111-111111111111', 5) ->> 'used')::int,
  1, 'a late release does not erase a real success'
);

-- ── 4. RELEASING A WHILE B SUCCEEDS TOUCHES ONLY A ─────────────────────────
insert into ids select 'c', (public.claim_stylist_chat('11111111-1111-1111-1111-111111111111', 5) ->> 'reservation_id')::uuid;
insert into ids select 'd', (public.claim_stylist_chat('11111111-1111-1111-1111-111111111111', 5) ->> 'reservation_id')::uuid;
select public.complete_stylist_chat((select id from ids where label='d'), '11111111-1111-1111-1111-111111111111', 5);
select public.release_stylist_chat((select id from ids where label='c'), '11111111-1111-1111-1111-111111111111', 5);
select is(
  (select state from public.stylist_chat_reservations where id = (select id from ids where label='d')),
  'completed', 'releasing one reservation leaves another’s success intact'
);

-- ── 5. THE FIFTH IS ALLOWED AND THE SIXTH IS REFUSED ───────────────────────
-- Two completed so far (a, d). Three more take it to five.
do $$
declare i int; r jsonb;
begin
  for i in 1..3 loop
    r := public.claim_stylist_chat('11111111-1111-1111-1111-111111111111', 5);
    perform public.complete_stylist_chat((r->>'reservation_id')::uuid,
      '11111111-1111-1111-1111-111111111111', 5);
  end loop;
end $$;

select is(
  (select count(*)::int from public.stylist_chat_reservations
    where user_id='11111111-1111-1111-1111-111111111111' and state='completed'
      and period_start = date_trunc('month', now() at time zone 'utc')::date),
  5, 'exactly five completions are recorded'
);
select is(
  (public.claim_stylist_chat('11111111-1111-1111-1111-111111111111', 5) ->> 'allowed')::boolean,
  false, 'the sixth claim is refused'
);
select is(
  (public.claim_stylist_chat('11111111-1111-1111-1111-111111111111', 5) ->> 'reason'),
  'exhausted', 'the refusal is exhaustion, not a plan boundary'
);

-- ── 6. CONCURRENT FIFTH-SLOT CONTENTION ────────────────────────────────────
-- pgTAP cannot open a second connection inside one transaction, so the
-- serialisation point is asserted directly: `claim_stylist_chat` takes an
-- EXCLUSIVE transaction-scoped advisory lock keyed on the user before it
-- counts. Two concurrent claimants therefore cannot both read four — the
-- second blocks until the first commits its reservation, then reads five and
-- is refused by the case above.
select is(
  (select count(*)::int from pg_locks
    where locktype='advisory' and mode='ExclusiveLock' and granted and pid = pg_backend_pid()),
  1, 'a claim holds an exclusive per-user advisory lock while it counts'
);

-- ── 7. AN ABANDONED RESERVATION CANNOT PERMANENTLY CONSUME CAPACITY ────────
insert into public.stylist_chat_reservations (user_id, period_start, state, created_at)
values ('22222222-2222-2222-2222-222222222222',
        date_trunc('month', now() at time zone 'utc')::date, 'reserved', now() - interval '30 minutes');
select is(
  (public.claim_stylist_chat('22222222-2222-2222-2222-222222222222', 1) ->> 'allowed')::boolean,
  true, 'a reservation older than the window stops holding its slot'
);

-- ── 8. A NEW UTC MONTH STARTS OVER ─────────────────────────────────────────
insert into public.stylist_chat_reservations (user_id, period_start, state, created_at, settled_at)
values ('22222222-2222-2222-2222-222222222222',
        (date_trunc('month', now() at time zone 'utc') - interval '1 month')::date,
        'completed', now() - interval '40 days', now() - interval '40 days');
select is(
  (select count(*)::int from public.stylist_chat_reservations r
    where r.user_id='22222222-2222-2222-2222-222222222222'
      and r.period_start = date_trunc('month', now() at time zone 'utc')::date
      and r.state = 'completed'),
  0, 'last month’s completions do not count against this month'
);

-- ── 8b. A SUCCESS IS CHARGED TO ITS RESERVATION'S PERIOD ──────────────────
--
-- The rollover case that actually happens: a chat claimed at 23:59:50 UTC and
-- answered at 00:00:04. Completion must charge the success to the month the
-- reservation was made in, and the allowance it returns must describe the
-- CURRENT month — otherwise a chat spanning midnight would either be billed
-- twice or silently forgiven.
insert into public.stylist_chat_reservations (id, user_id, period_start, state, created_at)
values ('dddddddd-dddd-dddd-dddd-ddddddddddd1',
        '33333333-3333-3333-3333-333333333333',
        (date_trunc('month', now() at time zone 'utc') - interval '1 month')::date,
        'reserved', now());
select is(
  (public.complete_stylist_chat('dddddddd-dddd-dddd-dddd-ddddddddddd1',
    '33333333-3333-3333-3333-333333333333', 5) ->> 'state'),
  'completed', 'a reservation made before midnight still settles after it'
);
select is(
  (select period_start from public.stylist_chat_reservations
    where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'),
  (date_trunc('month', now() at time zone 'utc') - interval '1 month')::date,
  'the success is charged to the month its reservation was made in'
);
select is(
  (public.claim_stylist_chat('33333333-3333-3333-3333-333333333333', 5) ->> 'remaining')::int,
  5, 'the new month is not inflated by a chat that spanned midnight'
);

-- ── 8c. TWO REFUSALS, TWO DIFFERENT TRUTHS ────────────────────────────────
--
-- `exhausted` and `capacity_held` both refuse, and everything else about them
-- differs. Reporting the second as the first would tell somebody with four
-- successes that they had used five, one line above an allowance saying they
-- had one left.
--
-- FOUR COMPLETED, ONE LIVE. Capacity is full; completions are not.
insert into public.stylist_chat_reservations (user_id, period_start, state, created_at, settled_at)
select '44444444-4444-4444-4444-444444444444',
       date_trunc('month', now() at time zone 'utc')::date, 'completed', now(), now()
  from generate_series(1, 4);
insert into public.stylist_chat_reservations (user_id, period_start, state, created_at)
values ('44444444-4444-4444-4444-444444444444',
        date_trunc('month', now() at time zone 'utc')::date, 'reserved', now());

select is(
  (public.claim_stylist_chat('44444444-4444-4444-4444-444444444444', 5) ->> 'reason'),
  'capacity_held', 'a slot held by a live reservation is not exhaustion'
);
select is(
  (public.claim_stylist_chat('44444444-4444-4444-4444-444444444444', 5) ->> 'used')::int,
  4, 'a live reservation is never counted as a successful chat'
);
select is(
  (public.claim_stylist_chat('44444444-4444-4444-4444-444444444444', 5) ->> 'remaining')::int,
  1, 'the fifth success is still available and reported as such'
);
select ok(
  (public.claim_stylist_chat('44444444-4444-4444-4444-444444444444', 5)
     ->> 'retry_after_seconds')::int between 1 and
  ceil(extract(epoch from public.stylist_reservation_window()))::int,
  'the retry hint never outlives the reservation window'
);

-- FIVE COMPLETED. Now, and only now, the month is genuinely spent.
insert into public.stylist_chat_reservations (user_id, period_start, state, created_at, settled_at)
select '55555555-5555-5555-5555-555555555555',
       date_trunc('month', now() at time zone 'utc')::date, 'completed', now(), now()
  from generate_series(1, 5);
select is(
  (public.claim_stylist_chat('55555555-5555-5555-5555-555555555555', 5) ->> 'reason'),
  'exhausted', 'five successes on record is exhaustion'
);
select is(
  (public.claim_stylist_chat('55555555-5555-5555-5555-555555555555', 5) ->> 'remaining')::int,
  0, 'and nothing remains'
);
select ok(
  (public.claim_stylist_chat('55555555-5555-5555-5555-555555555555', 5)
     ? 'retry_after_seconds') is not true,
  'exhaustion offers no retry, because waiting will not help'
);

-- ── 9. ONE REQUEST CAN NEVER SETTLE ANOTHER'S ─────────────────────────────
select is(
  (public.release_stylist_chat((select id from ids where label='d'),
    '22222222-2222-2222-2222-222222222222', 5) ->> 'state'),
  'unknown', 'a reservation cannot be settled by a different account'
);
select is(
  (select state from public.stylist_chat_reservations where id = (select id from ids where label='d')),
  'completed', 'the other account’s success is untouched by the attempt'
);

-- ── 10. GRANTS ─────────────────────────────────────────────────────────────
select is(
  (select count(*)::int from information_schema.role_routine_grants
    where routine_schema='public'
      and routine_name in ('claim_stylist_chat','complete_stylist_chat','release_stylist_chat')
      and grantee in ('anon','authenticated','PUBLIC')),
  0, 'no client role can reach the reservation functions'
);

select * from finish();
rollback;
