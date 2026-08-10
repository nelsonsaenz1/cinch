-- ===========================================================================
-- Activity — one page for the five things that already happen.
--
-- Atlas 32's claim is that "the counts already exist server-side and surface
-- today only as inline dots". That is true of the DATA and false of the READ:
-- every one of the five row kinds is a real table, and not one of them can be
-- read from the recipient's side in a single query.
--
--   friend added you        follows                (readable, but unilateral)
--   asked to borrow         borrow_requests        (owner-readable)
--   invited you             event_members          (member-readable)
--   voted on your look      event_outfit_votes     (via your own posts)
--   called it a good call   closet_likes           ← THE PROBLEM
--
-- `closet_likes: own can select` (20260804200000) lets the person who LIKED a
-- thing read the row, and nobody else. The owner of the garment being admired
-- cannot see the compliment at all. That is the correct policy for a table
-- whose rows are one person's taste, and it is also the reason this function
-- is `security definer`: the caller provably cannot perform this read under
-- their own RLS, which is the house's only standing justification for it.
--
-- The definer surface is kept honest by construction: `v_user` is taken from
-- `auth.uid()` and never from an argument, and every branch of the union is
-- filtered to rows whose SUBJECT is v_user. There is no argument that can
-- widen it, so there is no argument that can be abused.
--
-- See docs/design/diary-boards-activity-contract.md §5.2.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. The dot. Not a count.
--
-- AV-02, in as many words: "you will see a dot on Today — and nowhere else."
-- A timestamp is all a dot needs, and storing a count would invite one to be
-- rendered. AV's own rules forbid it twice: "No counts. The tab shows a dot,
-- never a number", and "no unread pill on each row".
-- ---------------------------------------------------------------------------

alter table profiles
  add column if not exists activity_seen_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Dismissals.
--
-- What the atlas called "Decline" on a friend request. `follows` is unilateral
-- and public: there is no pending request, so there is nothing to decline and
-- nothing to transmit. The button is "Not now" and it takes the row off YOUR
-- page — the same promise the Friends page's waved-off requests and the Lately
-- mute already make, and for the same reason: a rejection nobody is told about
-- is a kindness, and one they ARE told about is a product we did not agree to
-- build. See contract §4.3.
--
-- Server-side rather than AsyncStorage — unlike `muted`, which is deliberately
-- device-local — because a row dismissed on the phone and back on the iPad is
-- the thing that makes an inbox feel broken.
-- ---------------------------------------------------------------------------

create table activity_dismissals (
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in (
    'follow_in', 'follow_back', 'borrow_request', 'borrow_returned',
    'event_invite', 'votes', 'compliment'
  )),
  -- Deliberately text, not uuid: two of the seven kinds have no single-column
  -- identity (`closet_likes` has no primary key, `event_members` is a
  -- composite), and a synthetic key keeps the union honest instead of forcing
  -- an id column onto tables that were right without one.
  subject_key  text not null check (char_length(subject_key) between 1 and 128),
  dismissed_at timestamptz not null default now(),
  primary key (user_id, kind, subject_key)
);

alter table activity_dismissals enable row level security;

create policy "activity_dismissals: owner can select" on activity_dismissals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "activity_dismissals: owner can insert" on activity_dismissals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "activity_dismissals: owner can delete" on activity_dismissals
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, delete on table activity_dismissals to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The feed.
--
-- Thirty days, newest first, enforced HERE. AV's rule — "no infinite history.
-- The list ends at thirty days; older answers live on the object itself" — is
-- a property of the page, and a bound the client applies is a bound the client
-- can forget to apply.
--
-- Blocked pairs are filtered with the existing `blocked_between`, so a block
-- takes effect on this page the moment it is made, without this function
-- knowing anything about how blocking works.
-- ---------------------------------------------------------------------------

create function activity_feed()
returns table (
  kind        text,
  subject_key text,
  actor_id    uuid,
  occurred_at timestamptz,
  item_id     uuid,
  outfit_id   uuid,
  event_id    uuid,
  post_id     uuid,
  tally       integer
)
language sql
security definer
set search_path = ''
stable
as $$
  with me as (select (select auth.uid()) as uid),
  -- Thirty days, once, so every branch below agrees on where the page ends.
  window_start as (select now() - interval '30 days' as t),
  rows as (
    -- Someone followed you. Two different sentences out of one table: if you
    -- already follow them it is news ("added you back — her closet is open to
    -- you"); if you do not, it is answerable ("wants to be friends").
    select
      case when exists (
        select 1 from public.follows back
         where back.follower_id = m.uid and back.followee_id = f.follower_id
      ) then 'follow_back' else 'follow_in' end            as kind,
      f.follower_id::text                                  as subject_key,
      f.follower_id                                        as actor_id,
      f.created_at                                         as occurred_at,
      -- Aliased because a UNION takes its column names from the first branch,
      -- and an unnamed `null::uuid` arrives as `?column?` — which the outer
      -- select then cannot refer to.
      null::uuid                                           as item_id,
      null::uuid                                           as outfit_id,
      null::uuid                                           as event_id,
      null::uuid                                           as post_id,
      null::integer                                        as tally
      from public.follows f, me m, window_start w
     where f.followee_id = m.uid
       and f.created_at >= w.t
       and not public.blocked_between(m.uid, f.follower_id)

    union all

    -- A friend asked for something of yours. Only while it is still pending:
    -- an answered request is not waiting for an answer, and AV-05 keeps the
    -- answered row on the page for the session rather than in the feed.
    select
      'borrow_request', b.id::text, b.requester_id, b.created_at,
      b.item_id, null::uuid, b.event_id, null::uuid, null::integer
      from public.borrow_requests b, me m, window_start w
     where b.owner_id = m.uid
       and b.status = 'pending'
       and b.created_at >= w.t
       and not public.blocked_between(m.uid, b.requester_id)

    union all

    -- ...and gave it back. `updated_at` rather than `created_at`: the news is
    -- the return, which happened when the status changed.
    select
      'borrow_returned', b.id::text, b.requester_id, b.updated_at,
      b.item_id, null::uuid, b.event_id, null::uuid, null::integer
      from public.borrow_requests b, me m, window_start w
     where b.owner_id = m.uid
       and b.status = 'returned'
       and b.updated_at >= w.t
       and not public.blocked_between(m.uid, b.requester_id)

    union all

    -- You were invited somewhere. `state = 'invited'` only — a joined or
    -- declined invitation has been answered, and `removed` is the state a
    -- block writes (20260809160000), which must never resurface as an invite.
    select
      'event_invite', mem.event_id::text,
      -- Who actually invited you, not who owns the occasion. AV-01 names a
      -- person — "Mara Whitfield invited you to Sunday lunch" — and on an event
      -- where attendees can invite, the host is frequently not that person.
      coalesce(mem.invited_by, e.host_id), mem.created_at,
      null::uuid, null::uuid, mem.event_id, null::uuid, null::integer
      from public.event_members mem
      join public.events e on e.id = mem.event_id, me m, window_start w
     where mem.user_id = m.uid
       and mem.state = 'invited'
       and mem.created_at >= w.t
       and not public.blocked_between(m.uid, coalesce(mem.invited_by, e.host_id))

    union all

    -- Friends voted on a look you posted. AGGREGATED per look, which is what
    -- makes the sentence "Three friends voted on your Wednesday plate" rather
    -- than three rows saying the same thing. The tally is the count; the
    -- timestamp is the most recent vote, so a look climbs back up the page as
    -- it is voted on.
    select
      'votes', p.id::text, null::uuid, max(v.created_at),
      null::uuid, p.outfit_id, p.event_id, p.id, count(*)::integer
      from public.event_outfit_votes v
      join public.event_outfit_posts p on p.id = v.post_id, me m, window_start w
     where p.user_id = m.uid
       and v.voter_id <> m.uid
       and v.created_at >= w.t
       and not public.blocked_between(m.uid, v.voter_id)
     group by p.id, p.outfit_id, p.event_id

    union all

    -- Somebody called a piece a good call. The row the owner cannot read for
    -- themselves, and the reason this function is definer.
    select
      'compliment',
      l.user_id::text || ':' || coalesce(l.item_id, l.outfit_id)::text,
      l.user_id, l.created_at,
      l.item_id, l.outfit_id, null::uuid, null::uuid, null::integer
      from public.closet_likes l, me m, window_start w
     where (
             l.item_id   in (select i.id from public.items   i where i.user_id = m.uid)
          or l.outfit_id in (select o.id from public.outfits o where o.user_id = m.uid)
           )
       and l.user_id <> m.uid
       and l.created_at >= w.t
       and not public.blocked_between(m.uid, l.user_id)
  )
  select r.kind, r.subject_key, r.actor_id, r.occurred_at,
         r.item_id, r.outfit_id, r.event_id, r.post_id, r.tally
    from rows r, me m
   where not exists (
     select 1 from public.activity_dismissals d
      where d.user_id = m.uid
        and d.kind = r.kind
        and d.subject_key = r.subject_key
   )
   order by r.occurred_at desc
   limit 200;
$$;

revoke execute on function activity_feed() from public, anon;
grant execute on function activity_feed() to authenticated;
