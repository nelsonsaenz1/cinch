-- ===========================================================================
-- Fixes from the 2026-08-05 backend review.
--
-- Four unrelated small defects, one migration, because each is a handful of
-- lines and they shipped in the same review:
--
--   1. The `alter default privileges … revoke` passes (20260805213000/220000)
--      made EXECUTE-by-PUBLIC a thing of the past — but the three RPCs the
--      APP calls only ever held EXECUTE through that legacy PUBLIC grant.
--      This repo's convention for changing an RPC is drop-and-recreate (done
--      three times already), and a recreated function is now born with NO
--      grant: the app would get "permission denied for function" at runtime
--      with nothing in CI to catch it. Make the grants explicit.
--
--   2. The deprecated 3-arg claim_ai_quota wrapper. The redeployed functions
--      all call the 4-arg form; the wrapper is an overload a future
--      rpc('claim_ai_quota', …) typo can silently resolve to, spending
--      against a daily bucket no plan uses. Drop it.
--
--   3. set_updated_at() was missed by BOTH EXECUTE-revoke enumerations —
--      the exact incompleteness those migrations were written to end.
--
--   4. items_user_id_count_idx (20260805160000) duplicates items_user_id_idx
--      (20260803154431) — the guard didn't fire because the names differ.
--      Two identical btrees on the hottest insert path; drop the newcomer.
--
-- Plus two defence-in-depth lines for `subscriptions`, which was created
-- after the older tables got their explicit revokes but before the default-
-- privilege change, so it still carried the wholesale grants RLS was hiding.
-- ===========================================================================

-- 1. Explicit grants for everything the client actually calls over RPC.
grant execute on function apply_outfit_reaction(uuid[], smallint, jsonb, jsonb, jsonb, jsonb, text[], uuid, text, text, integer)
  to authenticated;
grant execute on function wear_outfit_tx(uuid, uuid[], text, text, jsonb, outfit_source)
  to authenticated;
grant execute on function plan_outfit_tx(uuid, uuid[], date, text, text, jsonb)
  to authenticated;
grant execute on function claim_command(uuid, uuid, text) to authenticated;
grant execute on function current_ai_consent_version() to authenticated;

-- 2. The dead overload.
drop function if exists claim_ai_quota(uuid, text, integer);

-- 3. The missed trigger function.
revoke execute on function set_updated_at() from public, anon, authenticated;

-- 4. The duplicate index.
drop index if exists items_user_id_count_idx;

-- Defence in depth for the newest table: RLS already closes it, but every
-- other user table also carries the explicit revoke, and `updated_at` should
-- not depend on every writer remembering to set it.
revoke all on subscriptions from anon;
create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();
