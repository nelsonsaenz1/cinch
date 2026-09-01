-- ===========================================================================
-- Audit items 23, 24, 25 and 27 — the four claim functions.
--
-- These four exist for the same reason and were written in the same week: each
-- replaces a read-then-write that was correct in the single-caller case and
-- wrong the moment two callers arrived. A webhook redelivered by Svix, a
-- reconcile racing itself across two devices, a receipts pass overlapping the
-- previous one, eleven support emails measured through a limit of three.
--
-- All four shipped WITHOUT automated coverage, which is the gap this file
-- closes. Their correctness is not observable from the outside — a
-- double-processed webhook and a correctly-skipped one look identical in the
-- response, and a lock that does not hold shows up as a support inbox rather
-- than as a failure — so a test is the only thing that can tell them apart.
--
-- What is NOT asserted here: true concurrency. pgTAP runs one session, so the
-- `for update skip locked` and `pg_advisory_xact_lock` cannot be raced from
-- inside it. What each test does assert is the property those primitives exist
-- to produce — that a second claim of the same thing comes back empty — which
-- is the observable consequence and the one a regression would break.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

insert into auth.users (id, email)
values ('88888888-8888-4888-8888-888888888888', 'wren@example.test'),
       ('99999999-9999-4999-8999-999999999999', 'other@example.test');

-- ---------------------------------------------------------------------------
-- Item 23 · `claim_superwall_event` — the webhook ledger.
--
-- Svix retries on any non-2xx and on a timeout, so a delivery arriving twice is
-- the expected case rather than the exceptional one. The claim is what makes
-- the second delivery a no-op, and it must ALSO record that the redelivery
-- happened: more than one of these is the signal that the handler is timing
-- out, and a claim that silently swallowed it would hide its own symptom.
-- ---------------------------------------------------------------------------

select is(
  claim_superwall_event('msg_aaa', 'subscription_start', 'user_1', 'cinch.pro.monthly'),
  true,
  'the first delivery of an event is claimed'
);

select is(
  claim_superwall_event('msg_aaa', 'subscription_start', 'user_1', 'cinch.pro.monthly'),
  false,
  'and a redelivery of the same svix id is refused — the handler must not run twice'
);

select is(
  (select delivery_count from superwall_events where svix_id = 'msg_aaa'),
  2,
  'the redelivery is still counted, because a retry storm is a symptom worth seeing'
);

select is(
  claim_superwall_event('msg_bbb', 'subscription_start', 'user_1', 'cinch.pro.monthly'),
  true,
  'a different svix id carrying the same facts is a different delivery'
);

-- 20260901000000: the ledger records what KIND of period was delivered.
-- A StoreKit intro-offer trial arrives as initial_purchase with periodType
-- TRIAL, and its conversion as a renewal flagged isTrialConversion — without
-- these two columns the trial transition cannot be measured from the ledger.
select is(
  claim_superwall_event(
    'msg_trial', 'initial_purchase', 'user_2', 'cinch.standard.annual',
    p_period_type => 'TRIAL', p_is_trial_conversion => false),
  true,
  'a claim carrying a period type is accepted'
);

select is(
  (select period_type from superwall_events where svix_id = 'msg_trial'),
  'TRIAL',
  'and the period type is stored verbatim'
);

select is(
  (select period_type from superwall_events where svix_id = 'msg_bbb'),
  null,
  'a claim made without one stores null — absence recorded as absence'
);

-- ---------------------------------------------------------------------------
-- Item 24 · `claim_superwall_alias` — the reconciliation queue.
--
-- A purchase that arrived before the SDK had an identity is parked against
-- `$SuperwallAlias:…`. Whoever signs in claims it. Two devices signing in at
-- once must not both be told the purchase is theirs.
-- ---------------------------------------------------------------------------

insert into superwall_events (svix_id, event_type, app_user_id, product_id, outcome)
values ('msg_alias_1', 'subscription_start',
        '$SuperwallAlias:11111111-2222-4333-8444-555555555555',
        'cinch.pro.annual', 'unidentified_alias'),
       ('msg_alias_2', 'subscription_renew',
        '$SuperwallAlias:11111111-2222-4333-8444-555555555555',
        'cinch.pro.annual', 'unidentified_alias'),
       -- A second person's parked purchase, which must not travel with the first.
       ('msg_alias_3', 'subscription_start',
        '$SuperwallAlias:99999999-8888-4777-8666-555555555555',
        'cinch.standard.monthly', 'unidentified_alias');

select is(
  (select count(*)::int from claim_superwall_alias(
     '$SuperwallAlias:11111111-2222-4333-8444-555555555555',
     '88888888-8888-4888-8888-888888888888')),
  2,
  'every unclaimed event for the alias is bound and returned in one call'
);

select is(
  (select count(*)::int from claim_superwall_alias(
     '$SuperwallAlias:11111111-2222-4333-8444-555555555555',
     '99999999-9999-4999-8999-999999999999')),
  0,
  'a second claimant gets nothing — the loser of a race is told there is nothing to claim'
);

select is(
  (select reconciled_user_id from superwall_events where svix_id = 'msg_alias_1'),
  '88888888-8888-4888-8888-888888888888'::uuid,
  'and the binding stayed with the first claimant'
);

select is(
  (select reconciled_user_id from superwall_events where svix_id = 'msg_alias_3'),
  null,
  'another alias''s parked purchase is untouched'
);

select is(
  (select outcome::text from superwall_events where svix_id = 'msg_alias_1'),
  'unidentified_alias',
  'the outcome still records what the WEBHOOK decided — reconciling is a separate fact'
);

-- A malformed alias must not reach an index. `IdentityLogic.generateAlias()` is
-- the prefix plus a UUID; anything else did not come from the SDK, and this is
-- a service-role function taking a caller-supplied string.
select is(
  (select count(*)::int from claim_superwall_alias('not-an-alias',
     '88888888-8888-4888-8888-888888888888')),
  0,
  'a string that is not a SuperwallKit alias claims nothing'
);

-- ---------------------------------------------------------------------------
-- Item 25 · `push_claim_receipts` — the Expo receipts pass.
--
-- Expo answers for a ticket only after it has tried to deliver it, so asking
-- too early mostly returns nothing and burns an attempt. The 15-minute floor
-- and the 10-minute backoff are the whole scheduling policy, and they live in
-- this one statement.
-- ---------------------------------------------------------------------------

insert into push_receipts (ticket_id, token, channel, created_at, attempts, last_attempt_at)
values -- Ready: old enough, never attempted.
       ('tk_ready', 'ExponentPushToken[a]', 'daily_outfit', now() - interval '30 minutes', 0, null),
       -- Too fresh: Expo will not have an answer yet.
       ('tk_fresh', 'ExponentPushToken[b]', 'daily_outfit', now() - interval '2 minutes', 0, null),
       -- Backing off: asked four minutes ago, floor is ten.
       ('tk_recent', 'ExponentPushToken[c]', 'daily_outfit', now() - interval '2 hours', 1,
        now() - interval '4 minutes'),
       -- Spent: six attempts is where an unresolved ticket stops being asked about.
       ('tk_spent', 'ExponentPushToken[d]', 'daily_outfit', now() - interval '2 hours', 6,
        now() - interval '1 hour'),
       -- Aged out: past the 24-hour window Expo keeps receipts for.
       ('tk_stale', 'ExponentPushToken[e]', 'daily_outfit', now() - interval '30 hours', 0, null);

select bag_eq(
  $$select ticket_id from push_claim_receipts(100)$$,
  $$values ('tk_ready')$$,
  'only a ticket that is old enough, unspent, in-window and off backoff is claimed'
);

select is(
  (select attempts from push_receipts where ticket_id = 'tk_ready'),
  1,
  'claiming spends an attempt, so a pass that dies mid-flight cannot loop forever'
);

select is(
  (select count(*)::int from push_claim_receipts(100)),
  0,
  'and an immediate second pass claims nothing — the backoff it just wrote holds it off'
);

-- ---------------------------------------------------------------------------
-- Item 27 · `claim_support_send` — counting and booking in one statement.
--
-- The endpoint used to count, then send, then insert. Measured, a limit of
-- three let eleven through. Counting and booking are now one critical section
-- per user.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from (
     select (claim_support_send('88888888-8888-4888-8888-888888888888', 'bug')).*
       from generate_series(1, 3)
   ) s where s.booking_id is not null),
  3,
  'three sends in an hour are booked'
);

select is(
  (select refused from claim_support_send('88888888-8888-4888-8888-888888888888', 'bug')),
  'hour',
  'the fourth is refused, and refused for the hour'
);

-- The day limit outranks the hour, so somebody at ten is told about the day
-- rather than about an hour they may not be inside.
insert into support_sends (user_id, topic, sent_at)
select '99999999-9999-4999-8999-999999999999', 'bug', now() - interval '5 hours'
  from generate_series(1, 10);

select is(
  (select refused from claim_support_send('99999999-9999-4999-8999-999999999999', 'bug')),
  'day',
  'at the daily ceiling the refusal names the day, not the hour'
);

-- Releasing a booking whose mail never went out, and only one's own.
select is(
  release_support_send(
    (select id from support_sends
      where user_id = '88888888-8888-4888-8888-888888888888' order by sent_at desc limit 1),
    '99999999-9999-4999-8999-999999999999'),
  false,
  'a booking cannot be released by somebody who does not own it'
);

select is(
  (select refused from claim_support_send('88888888-8888-4888-8888-888888888888', 'bug')),
  'hour',
  'and the refused-by-someone-else release did not free the slot'
);

select * from finish();
rollback;
