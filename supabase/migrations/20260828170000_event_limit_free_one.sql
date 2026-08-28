-- Founder directive 2026-08-28: the free tier hosts ONE upcoming event, not
-- two. The trigger (enforce_event_limit) already reads this function on every
-- insert, so the cap tightens server-side with no other change. Standard and
-- Pro are untouched.
--
-- Applied to production via the Supabase MCP on 2026-08-28 (the ledger is
-- divergent by naming; never `db push` — see
-- docs/ops/supabase-migration-reconciliation-20260817.md).
create or replace function public.event_limit_for_plan(p_plan public.subscription_plan) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan when 'free' then 1 when 'standard' then 15 when 'pro' then 100 end;
$$;
