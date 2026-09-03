-- ===========================================================================
-- The access matrix is a schema, not an accident of platform defaults.
--
-- Run with:  supabase test db
--
-- 20260819000000_normalise_client_grants.sql closed the last 167 grants that
-- existed in production and in no migration. These assertions are what stop
-- them coming back — either by a new table inheriting an ambient default, or
-- by someone "fixing" a hash mismatch with a grant.
--
-- Written as catalogue invariants rather than name lists wherever the invariant
-- is the real requirement, for the reason 01_rls_baseline.sql gives: the table
-- somebody forgets to protect is the table they also forget to add to the test.
-- Where an exact allowlist IS the requirement — the two anon-callable functions
-- — it is spelled out, because "some functions may be anon-callable" is not a
-- boundary anyone can check.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- ---------------------------------------------------------------------------
-- 1. No anonymous DML anywhere in public. Not on the 13 tables that used to
--    carry it, not on any table added since.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'anon'
      and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')),
  0,
  'anon holds no SELECT/INSERT/UPDATE/DELETE on any public table'
);

-- ---------------------------------------------------------------------------
-- 2. anon executes exactly two functions, and they are the two that were
--    granted on purpose. A third appearing here is drift or a mistake.
-- ---------------------------------------------------------------------------
select set_eq(
  $$ select routine_name::text
       from information_schema.role_routine_grants
      where specific_schema = 'public'
        and grantee = 'anon'
        and privilege_type = 'EXECUTE' $$,
  array['invite_card', 'join_waitlist'],
  'anon may execute only invite_card and join_waitlist'
);

-- ---------------------------------------------------------------------------
-- 3. Every SECURITY DEFINER function anon can reach is one of those two.
--    This is the shape that would defeat RLS, so it is asserted directly
--    rather than inferred from 2.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from information_schema.role_routine_grants g
     join pg_proc p on p.proname = g.routine_name
     join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where g.specific_schema = 'public'
      and g.grantee = 'anon'
      and g.privilege_type = 'EXECUTE'
      and p.prosecdef
      and g.routine_name not in ('invite_card', 'join_waitlist')),
  0,
  'no unintended SECURITY DEFINER function is anon-executable'
);

-- ---------------------------------------------------------------------------
-- 4. RLS is on for every base table in public.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'every public base table has row level security enabled'
);

-- ---------------------------------------------------------------------------
-- 5. No policy admits anon or PUBLIC. A grant is only contained for as long as
--    this holds, so the two are asserted together or neither means anything.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from pg_policies
    where schemaname = 'public'
      and roles::text[] && array['anon', 'public']),
  0,
  'no RLS policy in public admits anon or PUBLIC'
);

-- ---------------------------------------------------------------------------
-- 6. Neither client role can bypass RLS.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_roles
    where rolname in ('anon', 'authenticated') and rolbypassrls),
  0,
  'neither anon nor authenticated carries BYPASSRLS'
);

-- ---------------------------------------------------------------------------
-- 7. The RPCs the client actually calls are reachable by authenticated.
--    log_outfit_wear is included deliberately: it is superseded by
--    wear_outfit_tx and called from nowhere in the current client, but old
--    binaries in the field still call it, and a database built from this repo
--    granted it to no role at all until the normalisation migration.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from information_schema.role_routine_grants
    where specific_schema = 'public'
      and grantee = 'authenticated'
      and privilege_type = 'EXECUTE'
      and routine_name in ('wear_outfit_tx', 'unwear_outfit_tx', 'log_outfit_wear',
                           'plan_outfit_tx', 'apply_outfit_reaction')),
  5,
  'authenticated may execute the five shipped outfit RPCs, log_outfit_wear included'
);

-- ---------------------------------------------------------------------------
-- 8. service_role executes every public function, explicitly rather than by
--    ambient default — the Edge Functions run as this role.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not has_function_privilege('service_role', p.oid, 'EXECUTE')),
  0,
  'service_role may execute every function in public'
);

-- ---------------------------------------------------------------------------
-- 9. The server grants NO trial. The trial is StoreKit's now
--    (20260901000000): a 7-day introductory offer on cinch.standard.annual,
--    reported through the webhook like any purchase. This section used to
--    assert the opposite — that handle_new_subscription wrote interval
--    '14 days' — and is inverted on purpose: a restored pre-transition
--    definition must fail the suite, because a silent server trial on top of
--    a StoreKit trial is a double grant.
--
--    Asserted functionally, on a real signup, rather than by grepping the
--    definition: the requirement is the row that gets written, not the words
--    used to write it.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
values ('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0', 'grant-matrix@example.test');

select is(
  (select count(*)::int from subscriptions
    where user_id = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0'
      and plan = 'free' and trial_ends_at is null),
  1,
  'a new account starts free with NO server trial — the trial is StoreKit''s to grant'
);

-- ---------------------------------------------------------------------------
-- 10. effective_plan precedence: a paid row beats a live trial.
--
--     The pre-transition fold let ANY live trial_ends_at read as `pro`,
--     which masked a paid Standard purchase for the rest of the trial
--     window. Now a paid plan wins outright, and a live trial lifts only a
--     'free' row — legacy promotional access, honoured to its recorded
--     expiry and no further.
-- ---------------------------------------------------------------------------
update subscriptions
   set plan = 'standard', trial_ends_at = now() + interval '10 days'
 where user_id = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0';

select is(
  effective_plan('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0'),
  'standard'::subscription_plan,
  'a paid plan row wins over a live trial — a purchase takes effect the moment it lands'
);

update subscriptions
   set plan = 'free', trial_ends_at = now() + interval '10 days'
 where user_id = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0';

select is(
  effective_plan('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0'),
  'pro'::subscription_plan,
  'a live trial still lifts a free row to pro — legacy promotional access is honoured'
);

update subscriptions
   set plan = 'free', trial_ends_at = now() - interval '1 day'
 where user_id = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0';

select is(
  effective_plan('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0'),
  'free'::subscription_plan,
  'an expired legacy trial lifts nothing'
);

-- ---------------------------------------------------------------------------
-- 11. paywall_impressions is owner-only, insert and select, nothing else.
--     The table is the reinstall-proof memory behind the client-side paywall
--     frequency caps; a user who could write another user''s impressions
--     could silence — or spam — their paywalls.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
values ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', 'impressions-other@example.test');

-- A row the second user owns, to prove the first cannot see it.
insert into paywall_impressions (user_id, placement)
values ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', 'general_promo');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into paywall_impressions (user_id, placement)
    values ('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0', 'general_promo')$$,
  'an account can record its own paywall impression'
);

select throws_ok(
  $$insert into paywall_impressions (user_id, placement)
    values ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', 'general_promo')$$,
  '42501',
  null,
  'and cannot record an impression against anybody else'
);

select is(
  (select count(*)::int from paywall_impressions),
  1,
  'select shows only the caller''s own impressions'
);

reset role;

-- ---------------------------------------------------------------------------
-- 16. No client role holds a privilege RLS does not govern. TRUNCATE empties
--     a table regardless of policy; TRIGGER and REFERENCES are DDL-time
--     rights. Nineteen tables carried all three from the platform default
--     until 20260903000200 (2026-09-02 audit).
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')),
  0,
  'no client role may TRUNCATE, TRIGGER or REFERENCES any public table'
);

-- ---------------------------------------------------------------------------
-- 17. The quota ledger is read-only to clients. Every write goes through
--     claim_ai_quota and the service role (20260903000100).
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('ai_calls', 'ai_usage_counters')
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'clients hold no DML on ai_calls or ai_usage_counters'
);

select * from finish();
rollback;
