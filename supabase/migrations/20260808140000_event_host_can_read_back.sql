-- ===========================================================================
-- A host can read back the occasion they just created.
--
-- Creating an occasion had never once succeeded in production — the `events`
-- table was empty — and the reason was not the INSERT. `events: host can
-- insert` passes; what failed was the RETURNING clause.
--
-- PostgREST writes `.insert(...).select('id')` as
--
--     INSERT INTO events (...) VALUES (...) RETURNING id
--
-- and RETURNING makes the statement a read as well as a write, so the SELECT
-- policy has to pass for the row being inserted. That policy called
-- `can_see_event(id)`, whose first disjunct is `is_event_host(p_event)` —
-- and `is_event_host` is a STABLE function that answers by *re-querying*
-- `public.events`.
--
-- A STABLE function sees the snapshot taken at the start of the current
-- statement. The row being inserted by that same statement is not in it. So
-- `is_event_host` returned false, the other two disjuncts were false as well
-- (the `on_event_created` trigger seats the host as a member only AFTER the
-- statement completes), and the host was refused sight of their own occasion
-- one microsecond after writing it. The error surfaces as
--
--     new row violates row-level security policy for table "events"
--
-- which reads like a WITH CHECK failure and sent every previous look at this
-- straight to the INSERT policy, where there was nothing wrong.
--
-- The fix is to answer the host question from the row already in hand rather
-- than by going back to the table for it. `host_id` is a column of the row
-- being checked; no snapshot is involved and no function is called.
--
-- This grants nothing new. `host_id = auth.uid()` is exactly the condition
-- `is_event_host(id)` was already testing — the disjunct is the same
-- permission, made evaluable at the moment it is actually needed.
-- `can_see_event` is left in place and unchanged: it still carries the invitee
-- and friends-visible paths, and it is still the right call everywhere the row
-- is not already at hand.
-- ===========================================================================

drop policy "events: visible to participants" on events;

create policy "events: visible to participants" on events
  for select to authenticated
  using (host_id = (select auth.uid()) or public.can_see_event(id));
