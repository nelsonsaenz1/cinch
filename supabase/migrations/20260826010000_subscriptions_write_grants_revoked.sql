-- ===========================================================================
-- subscriptions: the client may READ its own row and do nothing else.
--
-- Found during the 2026-08-21 "no work-arounds" audit: the table still
-- carried default table-level grants to `authenticated` for every verb.
-- Functionally closed — RLS is enabled and the only policy is owner-SELECT,
-- so INSERT/UPDATE/DELETE were refused — but the grants were one dropped
-- policy away from a signed-in client writing itself a plan, and TRUNCATE is
-- not governed by RLS at all. The plan column is what every paywall gate
-- keys on; it gets the same explicit-grant discipline as the 20260819
-- normalisation gave the older tables. The Superwall webhook writes through
-- the service role, which is untouched.
-- ===========================================================================

revoke insert, update, delete, truncate, references, trigger
  on public.subscriptions from authenticated;
revoke all privileges on public.subscriptions from anon;
