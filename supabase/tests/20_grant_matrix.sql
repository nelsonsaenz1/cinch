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

select plan(9);

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
-- 9. The trial is fourteen days, in the function that actually writes it.
--
--    20260810150000_trial_is_twenty_one_days was written, never applied and
--    deleted; production has written interval '14 days' since 5 August. This
--    asserts the live definition rather than any document about it, so that
--    restoring the 21-day migration fails the suite instead of shipping.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'handle_new_subscription'
      and pg_get_functiondef(p.oid) like '%14 days%'
      and pg_get_functiondef(p.oid) not like '%21 days%'),
  1,
  'handle_new_subscription grants a 14-day trial and mentions no 21-day one'
);

select * from finish();
rollback;
