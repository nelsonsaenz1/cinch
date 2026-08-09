-- ---------------------------------------------------------------------------
-- The free closet is ten pieces, not thirty.
--
-- Thirty was a number that let someone photograph a wardrobe badly and never
-- see the product work. Ten is guided — 3 tops, 2 bottoms, 1 dress, 2 shoes,
-- 1 coat, 1 bag — and it is the smallest set the styling engine reliably builds
-- good outfits from. It makes fourteen outfits, computed rather than claimed.
-- See docs/design/free-tier-contract.md.
--
-- GRANDFATHERING NEEDS NO CODE. items_enforce_limit is a BEFORE INSERT trigger
-- (migration 20260805160000), so a closet already above ten is untouched and
-- keeps every garment; only the next insert refuses. That is the behaviour the
-- design wants — nothing is ever taken away, the door simply stops opening.
--
-- The refusal already raises `closet_limit_reached` with errcode
-- check_violation. The Wall (Directive 4) is the screen that catches it.
--
-- Standard and Pro are unchanged and restated here only because the function is
-- replaced whole.
-- ---------------------------------------------------------------------------

create or replace function item_limit_for_plan(p_plan subscription_plan)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan
           when 'free'     then 10
           when 'standard' then 150
           when 'pro'      then 1000
         end;
$$;

revoke execute on function item_limit_for_plan(subscription_plan) from public, anon, authenticated;
