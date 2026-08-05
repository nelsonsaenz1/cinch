-- ---------------------------------------------------------------------------
-- command_log needs write policies, not just a read policy
--
-- Fixes a defect in 20260804200000, which enabled row level security on
-- command_log and then gave it exactly one policy: SELECT.
--
-- `claim_command`, `wear_outfit_tx`, and `plan_outfit_tx` are all SECURITY
-- INVOKER — deliberately, so that every write they make is still checked
-- against the calling user's own policies rather than quietly running with the
-- definer's authority. The consequence is that their INSERT into command_log
-- and their UPDATE of result_id execute as `authenticated`, and with no policy
-- permitting either, RLS refused them. Wearing or planning an outfit would have
-- failed outright with "new row violates row-level security policy".
--
-- Enabling RLS on a table and adding only the policies you happen to be
-- thinking about is the same shape of mistake as the public-read policy this
-- migration series exists to fix: authorization silently doing something other
-- than what the author assumed.
-- ---------------------------------------------------------------------------

create policy "command_log: owner can insert" on command_log
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Scoped to the owner on BOTH sides. `using` decides which rows are visible to
-- update, `with check` decides what they may become — without the latter a
-- caller could rewrite the row's user_id and take over someone else's
-- operation id.
create policy "command_log: owner can update" on command_log
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
