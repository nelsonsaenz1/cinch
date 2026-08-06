-- ===========================================================================
-- Event content, block filter. App Store Guideline 1.2 remediation.
--
-- A block is meant to be account-level and absolute: "every social read path
-- screens the pair out from then on" (20260807100000). It was not. Migration C
-- (20260807102000) gated event posts, votes and comments on membership ALONE —
--
--     using (public.is_event_member(event_id))
--
-- — so two women who had blocked each other still read each other's looks,
-- picks and words in full inside any event they both belonged to. `blocked_
-- between` was already the screen on the friend/profile surfaces (see
-- `social_profiles` in 20260807103000); the event surfaces simply never asked.
--
-- This migration asks, on all five event-content read paths: the three base
-- tables, and the two SECURITY DEFINER projection views whose WHERE clause IS
-- their access control and which therefore do not inherit the fixed policies.
--
-- Ground rules restated (20260807100000 §0), all held here:
--
--   * No `to anon` policy. anon gains nothing; the recreated policies are
--     `to authenticated`, exactly as the ones they replace were.
--   * Every client grant is an explicit line at the bottom of this file.
--   * The views keep `security_invoker = false` — their security is unchanged;
--     only their WHERE clause tightens.
--   * `(select auth.uid())`, per-command policies, and a btree index behind
--     every policy-filtered column. The three author columns filtered below
--     already carry theirs from Migration C (event_outfit_posts_user_idx,
--     event_outfit_votes_voter_idx, event_comments_user_idx) — no new index.
--
-- Policies are dropped and recreated rather than `alter policy`-ed: the house
-- pattern (20260804200000) is an explicit, commented CREATE, so the whole
-- predicate reads in one place instead of being reassembled from two files.
--
-- A null `auth.uid()` makes `blocked_between` false and `not blocked_between`
-- true — the membership check is still the gate for an unauthenticated caller,
-- and it already refuses her.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Posts. A blocked woman's look leaves the board in both directions: the block
-- is one-way to its author, but the screen is mutual by design (see
-- `blocked_between`, which is symmetric).
-- ---------------------------------------------------------------------------
drop policy if exists "event_posts: members can select" on event_outfit_posts;
create policy "event_posts: members can select" on event_outfit_posts
  for select to authenticated
  using (public.is_event_member(event_id)
         and not public.blocked_between((select auth.uid()), user_id));

-- ---------------------------------------------------------------------------
-- Votes. Her pick is her voice on someone else's look — it carries her name
-- ("Picked by Dana"), so it screens out with the rest of her.
-- ---------------------------------------------------------------------------
drop policy if exists "event_votes: members can select" on event_outfit_votes;
create policy "event_votes: members can select" on event_outfit_votes
  for select to authenticated
  using (public.is_event_member(event_id)
         and not public.blocked_between((select auth.uid()), voter_id));

-- ---------------------------------------------------------------------------
-- Comments. The block screen sits BESIDE the hidden-comment clause, not inside
-- it: `hidden` is the host's moderation switch with its author/host escape
-- hatches, and a blocked author must not reach the viewer through one of them.
-- ---------------------------------------------------------------------------
drop policy if exists "event_comments: members can select" on event_comments;
create policy "event_comments: members can select" on event_comments
  for select to authenticated
  using (public.is_event_member(event_id)
         and not public.blocked_between((select auth.uid()), user_id)
         and (not hidden
              or (select auth.uid()) = user_id      -- author sees own hidden
              or public.is_event_host(event_id)));  -- host sees what they hid

-- ---------------------------------------------------------------------------
-- The projection views. SECURITY DEFINER (20260807103000): they run as their
-- owner, so the policies above never fire for them and the WHERE clause is the
-- whole of their access control. Without these two lines the fix is half a
-- fix — `event_post_items` still serves every garment inside a blocked
-- woman's look, and `event_vote_counts` still tallies her pick.
--
-- `create or replace view` keeps the security setting, the column list and the
-- existing grants; the grants are re-issued at the bottom anyway, because a
-- grant this feature depends on should be readable in the file that needs it.
-- ---------------------------------------------------------------------------

create or replace view event_post_items
with (security_invoker = false) as
  select ep.id as post_id, ep.event_id,
         oi.item_id, oi.position,
         i.user_id, i.category, i.subcategory, i.colors,
         i.thumb_path, i.cutout_path, i.plate_path, i.borrowable
    from event_outfit_posts ep
    join outfit_items oi on oi.outfit_id = ep.outfit_id
    join items i         on i.id = oi.item_id
   where is_event_member(ep.event_id)
     and not blocked_between((select auth.uid()), ep.user_id);

-- The tally must agree with the voter list the caller can actually read, or a
-- board prints "3 picks" under two names. Filtering the voters, not the posts:
-- a blocked woman's OWN post is already gone above, and a post of somebody
-- else's that she picked stays — minus her pick.
create or replace view event_vote_counts
with (security_invoker = false) as
  select v.event_id, v.post_id, count(*)::bigint as votes
    from event_outfit_votes v
   where is_event_member(v.event_id)
     and not blocked_between((select auth.uid()), v.voter_id)
   group by v.event_id, v.post_id;

-- ---------------------------------------------------------------------------
-- One consequence of the vote screen, closed here rather than left to the UI:
-- a woman gets ONE pick per event (`one_vote_per_event`), and if she blocks
-- the author of the look she picked, that look leaves her board while the vote
-- row stays — spending her only pick on something she can no longer see or
-- retract. Blocking retracts the picks between the pair, in both directions,
-- the same way it severs the follow edges (`on_block_sever_graph`).
--
-- SECURITY DEFINER for the same reason that one is: neither woman may delete
-- the other's vote row under her own RLS.
-- ---------------------------------------------------------------------------
create function on_block_retract_event_votes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.event_outfit_votes v
   using public.event_outfit_posts p
   where p.id = v.post_id
     and ((v.voter_id = new.blocker_id and p.user_id = new.blocked_id)
       or (v.voter_id = new.blocked_id and p.user_id = new.blocker_id));
  return new;
end; $$;
create trigger user_blocks_retract_event_votes
  after insert on user_blocks
  for each row execute function on_block_retract_event_votes();
revoke execute on function on_block_retract_event_votes()
  from public, anon, authenticated;

-- Explicit grants. Unchanged from 20260807103000 and restated, not widened:
-- SELECT only, authenticated only, never anon, never a write grant on a
-- definer view (20260805213000).
grant select on event_post_items, event_vote_counts to authenticated;
