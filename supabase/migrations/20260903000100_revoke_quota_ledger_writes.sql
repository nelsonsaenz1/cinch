-- ---------------------------------------------------------------------------
-- The quota ledger is not client-writable — full-app audit 2026-09-02
--
-- 20260819000000 §3 kept `insert, update, delete` on `ai_calls` and
-- `ai_usage_counters` for `authenticated` on the grounds that "the RLS
-- policies already admit" those verbs. They do not: both tables carry a
-- single owner-SELECT policy and nothing else, so every client write is
-- already refused by RLS. The grants were dead letter — but dead letter on
-- the table that decides who has used their AI allowance is one policy
-- mistake away from a client rewriting its own quota. The same shape was
-- caught and closed for `subscriptions` in 20260826010000; these two were
-- left behind. Every real write goes through `claim_ai_quota` and the Edge
-- Functions' service role, neither of which this touches.
--
-- DOWN (reversible):
--   grant insert, update, delete on public.ai_calls          to authenticated;
--   grant insert, update, delete on public.ai_usage_counters to authenticated;
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.ai_calls          from authenticated;
revoke insert, update, delete on public.ai_usage_counters from authenticated;
