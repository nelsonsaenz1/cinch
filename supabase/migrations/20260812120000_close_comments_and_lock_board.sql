-- Dependencies A and B — comment closure and the board lock, enforced by the
-- server instead of by the client.
--
-- Wave 3's Gap Feed and Social atlas draws two rules the app has been asserting
-- and the database has never held:
--
--   D-1  comments close when the occasion starts
--   D-2a picks freeze when the occasion starts
--
-- Both were client-side only. `event_comments`'s insert policy is identity plus
-- membership plus `not hidden and not reported` with NO time predicate
-- (20260807102000:126-130), and `event_outfit_votes` had `assert_vote_target()`
-- checking post existence, self-vote and membership — and nothing about time.
-- So the copy said "closed" and a patched client, a stale tab or a retry from a
-- queue could still write. `comment-thread.ts` refused to print "nothing new can
-- be added" for exactly this reason; that sentence becomes true with this file.
--
-- ── THE UNDATED CASE, WHICH IS THE WHOLE DECISION ──────────────────────────
--
-- `events.starts_at` is NULLABLE (20260808130000_events_optional_date.sql:30).
-- Every implementation of these two rules differs only in what it does with an
-- occasion that has no date, and the founder's ruling is: **undated events stay
-- open until an organizer sets a date.** So the predicate is
--
--     now() < coalesce(starts_at, 'infinity')
--
-- which is open forever while `starts_at` is null and closes the moment a host
-- fills one in. That is a real consequence and it is the intended one: an
-- occasion nobody has dated has no start to have passed, and refusing a comment
-- on the grounds of a deadline that does not exist would be the server
-- inventing one.
--
-- Note the ordering property this gives for free: setting a date in the PAST
-- closes the thread and the board immediately, which is what a host tidying up
-- after the fact would expect, and unsetting it (back to null) reopens both.
-- Neither is a special case in the code below; both fall out of the predicate.
--
-- ── WHAT IS NOT ENFORCED, DELIBERATELY ─────────────────────────────────────
--
-- Nothing here touches SELECT. A closed thread stays readable to the people who
-- were invited, and a locked board stays visible with its tallies — closing is
-- about writing, and the copy on both surfaces says so.
--
-- Nothing here touches UPDATE on comments either: the host's moderation
-- (`hidden`) must keep working after the occasion starts, because a comment
-- that needs hiding at 9pm does not stop needing it at 9:01.

-- ---------------------------------------------------------------------------
-- The shared predicate
-- ---------------------------------------------------------------------------

/**
 * True while an occasion has not started — including forever, when it has no
 * date at all.
 *
 * STABLE rather than IMMUTABLE: it reads a table and calls `now()`. SECURITY
 * DEFINER because the triggers below run for a member who may not be able to
 * select the `events` row under their own RLS, and the answer must not depend
 * on that. `search_path = ''` for the usual reason — a SECURITY DEFINER
 * function with a mutable search path is a privilege-escalation hole.
 *
 * A deleted event answers TRUE. It cannot arise through these triggers (both
 * tables cascade on `events`), and answering FALSE would mean a missing row
 * silently refused writes rather than failing loudly somewhere honest.
 */
create or replace function public.event_is_open(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select now() < coalesce(e.starts_at, 'infinity'::timestamptz)
       from public.events e
      where e.id = p_event_id),
    true
  );
$$;

revoke execute on function public.event_is_open(uuid) from public, anon;
-- Readable by the client so a screen can ask the same question the trigger
-- will, rather than deriving a second answer from a clock that may differ.
grant execute on function public.event_is_open(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- D-1 · comments close at starts_at
-- ---------------------------------------------------------------------------

/**
 * A `before insert` trigger rather than a `with check` on the insert policy.
 *
 * The policy route works, but every RLS refusal comes back as the same opaque
 * `42501`, which the client already spends on "join the event first". A thread
 * that closed and a membership that lapsed are different problems with
 * different remedies, and a user told the wrong one goes looking in the wrong
 * place. A trigger can raise its own SQLSTATE, so it does.
 *
 * `CL001` is a legal five-character SQLSTATE in a class PostgreSQL does not
 * assign. Its reserved classes are 00-09, 0A-0Z, 20-2F, 34, 38, 39, 3B, 3D, 3F,
 * 40, 42, 44, 53-58, 72, F0, HV, P0 and XX — none begins with `C` — so `CL`
 * cannot collide with a code Postgres raises on its own.
 */
create or replace function public.assert_comment_thread_open() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.event_is_open(new.event_id) then
    raise exception 'the occasion has started, so the thread is closed'
      using errcode = 'CL001';
  end if;
  return new;
end;
$$;

-- Replay-safe. `create trigger` has no `or replace` and no `if not exists`, so
-- a bare create fails `42710` on a second run — and it would fail AFTER the
-- `create or replace function` above, leaving the file half-applied. This
-- directory gets replayed (see docs/db/migration-history-audit.md), so the
-- drop is not hypothetical housekeeping.
drop trigger if exists event_comments_thread_open on public.event_comments;
create trigger event_comments_thread_open
  before insert on public.event_comments
  for each row execute function public.assert_comment_thread_open();

revoke execute on function public.assert_comment_thread_open() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- D-2a · the board locks at starts_at
-- ---------------------------------------------------------------------------

/**
 * `assert_vote_target()` gains the lock. It is already the `before insert`
 * trigger on this table and already derives `event_id` from the post, so the
 * check belongs here rather than in a second trigger racing it — and it must
 * run AFTER `new.event_id` is set, since the vote's own `event_id` is not
 * trusted.
 *
 * Recreated whole rather than patched, so the file reads as the function's
 * current definition. Everything above the new block is verbatim from
 * 20260807102000.
 */
create or replace function public.assert_vote_target() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_owner uuid;
begin
  select event_id, user_id into v_event, v_owner
    from public.event_outfit_posts where id = new.post_id;
  if v_event is null then
    raise exception 'no such post' using errcode = '42501';
  end if;
  new.event_id := v_event;                 -- authoritative
  if v_owner = new.voter_id then
    raise exception 'you cannot vote for your own outfit' using errcode = '22023';
  end if;
  if not public.is_event_member(v_event) then
    raise exception 'join the event before voting' using errcode = '42501';
  end if;
  -- D-2a. After the derivation, so it is asked about the real event.
  if not public.event_is_open(v_event) then
    raise exception 'the occasion has started, so the board is locked'
      using errcode = 'CL002';
  end if;
  return new;
end; $$;

/**
 * And the other half of a lock, which is easy to forget: RETRACTION.
 *
 * "One movable pick per viewer" was already server-enforced by
 * `one_vote_per_event`, and moving a pick is delete + insert — there is no
 * UPDATE policy on this table. So a lock that only guarded INSERT would let a
 * voter delete their pick after the start and leave the board with a tally
 * nobody can put back: a one-way edit past the moment the tallies are supposed
 * to be final.
 *
 * ── SCOPED TO THE VOTER'S OWN ACT, AND ONLY THAT ──────────────────────────
 *
 * `on_block_retract_votes` (20260809160000) deletes a blocked person's votes
 * on the blocker's looks, and it must keep working after an occasion starts:
 * a locked board must never be able to trap a harasser's pick on somebody's
 * look, and BL-01's headline claim — "blocking removed their votes from your
 * looks" — is a promise this app has already made. Safety outranks the freeze.
 *
 * The two are told apart by whose act it is. That delete runs with
 * `auth.uid()` as the BLOCKER and `old.voter_id` as the blocked person, so the
 * guard below simply does not apply to it; the same is true of the migration's
 * own backfill, where `auth.uid()` is null. A voter changing their mind about a
 * look is the only delete this refuses, which is the only delete the lock was
 * ever about.
 */
create or replace function public.assert_vote_retractable() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) = old.voter_id and not public.event_is_open(old.event_id) then
    raise exception 'the occasion has started, so the board is locked'
      using errcode = 'CL002';
  end if;
  return old;
end;
$$;

-- Replay-safe, for the reason given above the other trigger.
drop trigger if exists event_outfit_votes_retractable on public.event_outfit_votes;
create trigger event_outfit_votes_retractable
  before delete on public.event_outfit_votes
  for each row execute function public.assert_vote_retractable();

revoke execute on function public.assert_vote_retractable() from public, anon, authenticated;
