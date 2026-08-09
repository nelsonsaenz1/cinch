-- ===========================================================================
-- Make blocking mean what the Blocked People screen says it means.
--
-- Atlas 29 (BL-01) states, as a fact about what already happened:
--
--     "Blocking removed their votes from your looks and took them off every
--      event you host. They cannot see your closet, and you will not see
--      theirs."
--
-- Only the second sentence was true. `on_block_sever_graph()` (20260807100000)
-- deletes rows from `follows` and nothing else, and
-- `event_content_block_filter` (20260807120000) then hides the pair's posts,
-- votes and comments from EACH OTHER through RLS.
--
-- Hiding is not retracting. A vote is a NUMBER OTHER PEOPLE SEE: screening it
-- out of the blocker's own read left the tally standing for every other
-- attendee, attributed in part to an account the owner of that look had just
-- blocked. And the blocked account stayed a joined member of events the
-- blocker hosts — visible in the attendee list to everybody except the host
-- who blocked them.
--
-- Telling somebody their harasser's votes were retracted, on the one screen
-- whose whole job is to be believed, is the worst available place in this app
-- to be wrong. So the trigger grows to match the sentence.
--
-- SCOPED EXACTLY TO WHAT THE COPY PROMISES, and no further. See
-- docs/design/system-safety-contract.md §2 for the three things this
-- deliberately does NOT do, each with its reason:
--
--   * It does not delete their comments. Those are already invisible to the
--     blocker, and deleting another person's words across an event other
--     people are reading is a bigger act than a block was asked to be. The
--     screen's copy is corrected to say votes instead.
--   * It does not remove the BLOCKER from events the blocked person hosts.
--     The atlas promises one direction; ejecting someone from an occasion
--     they had joined, as a side effect of blocking, is a surprise.
--   * It does not restore anything on unblock. BL-02's confirmation says so
--     in as many words, and that sentence is the reason this is safe to do:
--     the user is told it is irreversible before it happens.
--
-- Ground rules held (20260807100000 §0): no `to anon`, explicit grants only,
-- `(select auth.uid())` where a policy is involved, SECURITY DEFINER only
-- where the caller provably cannot do the write under their own RLS — which
-- is the case here twice over: a blocker may not delete another user's vote
-- row, and may not update another user's membership row.
-- ===========================================================================

create or replace function on_block_sever_graph() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. The follow edge, both directions. Unchanged from 20260807100000.
  delete from public.follows
   where (follower_id = new.blocker_id and followee_id = new.blocked_id)
      or (follower_id = new.blocked_id and followee_id = new.blocker_id);

  -- 2. Their votes on the blocker's own looks.
  --
  -- Only on posts the BLOCKER authored — this is "their votes on YOUR looks",
  -- not a purge of everything they ever voted on. `one_vote_per_event` means
  -- deleting the row genuinely frees them to vote again if they are ever
  -- unblocked and rejoin, which is the correct end state: nothing is
  -- restored, and nothing is permanently forbidden either.
  delete from public.event_outfit_votes v
   using public.event_outfit_posts p
   where v.post_id = p.id
     and p.user_id = new.blocker_id
     and v.voter_id = new.blocked_id;

  -- 3. Their membership of every event the blocker hosts.
  --
  -- `removed` rather than a delete: the enum already carries the state, and a
  -- row that records "was here, was removed" is the difference between an
  -- audit trail and a mystery. Guarded on the current state so a re-block
  -- cannot churn `updated_at` on rows that already say `removed`, and so a
  -- declined invitation is not silently rewritten into an ejection.
  update public.event_members m
     set state = 'removed', updated_at = now()
    from public.events e
   where m.event_id = e.id
     and e.host_id = new.blocker_id
     and m.user_id = new.blocked_id
     and m.state in ('invited', 'joined');

  return new;
end; $$;

-- The trigger itself is unchanged and still points at this function; only the
-- body moved. Restated for the same reason the house pattern always restates:
-- the grant surface of a SECURITY DEFINER function is worth re-reading in the
-- file that last touched it.
revoke execute on function on_block_sever_graph() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill.
--
-- Blocks made before this migration never had these side effects, so the
-- screen would have been lying retroactively about every one of them. Run the
-- same two statements once across the existing block table.
-- ---------------------------------------------------------------------------

delete from public.event_outfit_votes v
 using public.event_outfit_posts p, public.user_blocks b
 where v.post_id = p.id
   and p.user_id = b.blocker_id
   and v.voter_id = b.blocked_id;

update public.event_members m
   set state = 'removed', updated_at = now()
  from public.events e, public.user_blocks b
 where m.event_id = e.id
   and e.host_id = b.blocker_id
   and m.user_id = b.blocked_id
   and m.state in ('invited', 'joined');
