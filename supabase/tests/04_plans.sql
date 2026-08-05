-- The database copy of the closet-size limits. The TS copies are held together
-- by tests/plans.test.ts; this file covers the third copy, so no one of the
-- three can drift silently.
begin;
select plan(4);

select is(item_limit_for_plan('free'),     30,   'free closet limit');
select is(item_limit_for_plan('standard'), 150,  'standard closet limit');
select is(item_limit_for_plan('pro'),      1000, 'pro closet limit');

-- The deprecated 3-arg claim_ai_quota must stay gone (20260805231500).
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'claim_ai_quota'),
  1,
  'exactly one claim_ai_quota overload remains'
);

select * from finish();
rollback;
