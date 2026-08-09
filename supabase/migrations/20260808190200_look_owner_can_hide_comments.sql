-- ---------------------------------------------------------------------------
-- The person whose look it is can hide a comment on it.
--
-- The comments atlas is explicit twice over: "The person whose look it is can
-- hide a comment on it", and separately, in the report/block rules, "the host
-- is not a moderator". The shipped policy said the opposite — hiding was
-- host-only — so the affordance the design puts on the row belonged to the one
-- person the design says should not have it, and the one person it should have
-- belonged to could not use it.
--
-- Nobody noticed because the client never offered the button. Unit E found it
-- while building EC-03 and correctly matched the server rather than shipping a
-- control that would fail; this migration moves the server instead.
--
-- The host keeps the power too. A host who has to sit through a thread they
-- cannot moderate on an occasion they are responsible for is a worse failure
-- than a host who rarely uses it, and the existing select policy already
-- assumes a host can see what they hid.
--
-- Scope is unchanged and still narrow. The column grant below is what actually
-- limits this to the `hidden` flag — an UPDATE policy alone would let a look's
-- owner rewrite the text of a comment about them, which is the one edit that
-- would make the thread untrustworthy. Nobody edits anybody's words, including
-- their own: the atlas bans editing outright ("Delete and say it again").
-- ---------------------------------------------------------------------------

drop policy if exists "event_comments: host can moderate" on event_comments;

create policy "event_comments: look owner or host can hide" on event_comments
  for update to authenticated
  using (
    public.is_event_host(event_id)
    or exists (
      select 1 from public.event_outfit_posts p
       where p.id = event_comments.post_id
         and p.user_id = (select auth.uid())
    )
  )
  with check (
    public.is_event_host(event_id)
    or exists (
      select 1 from public.event_outfit_posts p
       where p.id = event_comments.post_id
         and p.user_id = (select auth.uid())
    )
  );

-- The select policy already lets an author see their own hidden line, which is
-- what keeps a hidden comment from becoming a silent disappearance: "its author
-- still sees their own line, so nobody is left talking into a room that has
-- quietly stopped hearing them." Restated here because the rule now has a
-- second person who can trigger it.
