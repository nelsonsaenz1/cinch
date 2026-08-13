-- The control plane stops being world-readable to anyone with an account.
--
-- WHAT WAS TRUE BEFORE
--
-- `ai_config` carried blanket table grants to `anon` and `authenticated`, from
-- the original 2026-08-03 schema, and its only RLS policy is a permissive
-- SELECT with `qual = true`. So every signed-in user could read the whole
-- roster: which model each workload uses, its token ceiling, its timeout, and
-- now its rescue model and validator policy.
--
-- That is not a leak of user data, and nothing about it was being exploited.
-- It is a leak of operational posture — the exact list an adversary would want
-- before probing which workload is cheapest to make expensive — and it exists
-- for no reason at all: NOTHING IN THE APP READS THIS TABLE. Every reader is an
-- Edge Function holding the service-role key, which bypasses grants entirely.
--
-- WHY A REVOKE AND NOT A POLICY CHANGE
--
-- RLS was already the only thing standing between a client key and this table,
-- and defence that rests on a single permissive policy is one careless `create
-- policy` away from being no defence. Removing the grant means the table is
-- unreachable through PostgREST whatever the policies later say — the same
-- shape `catalogue_demand_daily` was built with in the first place, applied
-- retroactively to the table that predates that decision.
--
-- `ai_calls` deliberately KEEPS its grants. The privacy screen reads it to
-- answer "what has been sent about me", which is a promise the app makes and
-- has to be able to keep from a client key.

revoke all on table public.ai_config from anon, authenticated;

-- The permissive read policy is now unreachable — no grant, no PostgREST route
-- — but leaving it in place would misdescribe the table to the next reader.
drop policy if exists "ai_config: readable by authenticated" on public.ai_config;

-- RLS stays on regardless. A table in an exposed schema with RLS off is a
-- finding in every advisor run, and the grant could be restored by a future
-- migration that does not know why it was taken away.
alter table public.ai_config enable row level security;

comment on table public.ai_config is
  'Server-owned model configuration. Service-role only: no grants to anon or '
  'authenticated, and no client code reads it. See '
  'supabase/functions/_shared/ai-config.ts.';
