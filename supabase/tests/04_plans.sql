-- The database copy of the closet-size limits. The TS copies are held together
-- by tests/plans.test.ts; this file covers the third copy, so no one of the
-- three can drift silently.
begin;
select plan(10);

select is(item_limit_for_plan('free'),     10,   'free closet limit');
select is(item_limit_for_plan('standard'), 150,  'standard closet limit');
select is(item_limit_for_plan('pro'),      1000, 'pro closet limit');

-- The total ceiling: every row, stored pieces included (20260808170000).
select is(item_total_limit_for_plan('free'),     30,   'free stored limit');
select is(item_total_limit_for_plan('standard'), 450,  'standard stored limit');
select is(item_total_limit_for_plan('pro'),      3000, 'pro stored limit');

-- Storing a piece has to free an active slot, which is only true while the
-- total sits strictly above the active limit. Equal ceilings would silently
-- restore the dead end this migration removed.
select ok(
  item_total_limit_for_plan('free') > item_limit_for_plan('free'),
  'free: storing a piece can make room'
);
select ok(
  item_total_limit_for_plan('standard') > item_limit_for_plan('standard'),
  'standard: storing a piece can make room'
);
select ok(
  item_total_limit_for_plan('pro') > item_limit_for_plan('pro'),
  'pro: storing a piece can make room'
);

-- The deprecated 3-arg claim_ai_quota must stay gone (20260805231500).
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'claim_ai_quota'),
  1,
  'exactly one claim_ai_quota overload remains'
);

select * from finish();
rollback;
