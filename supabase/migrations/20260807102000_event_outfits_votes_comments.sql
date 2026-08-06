-- ===========================================================================
-- Cinch Social, Migration C — outfit posts, votes, comments, moderation.
--
-- Implements docs/social/architecture.md §2 (Migration C) verbatim.
--
-- Votes are a NEW table, not outfit_reactions (architecture.md §1.2):
-- outfit_reactions is the personal ML training log — owner-only RLS, feature
-- vectors, replayable corpus. A courtesy vote on a friend's dinner outfit is
-- not a taste signal and must never contaminate it. event_outfit_votes is
-- event-scoped, member-readable, and `unique (event_id, voter_id)` — one vote
-- per member per event ("pick the winner"). Changing a vote is delete+insert.
-- ===========================================================================

create table event_outfit_posts (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  outfit_id   uuid not null references outfits (id) on delete cascade,
  caption     text check (char_length(caption) <= 280),
  created_at  timestamptz not null default now(),
  -- Tenant integrity (20260804200000 pattern): you can only post an outfit
  -- YOU own. Reuses outfits_id_user_key.
  constraint event_posts_outfit_same_user
    foreign key (outfit_id, user_id) references outfits (id, user_id)
    on delete cascade,
  -- An outfit appears in an event once.
  constraint event_posts_once unique (event_id, outfit_id)
);
create index event_outfit_posts_event_idx on event_outfit_posts (event_id, created_at);
create index event_outfit_posts_user_idx  on event_outfit_posts using btree (user_id);
alter table event_outfit_posts enable row level security;

create function assert_post_is_member() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_event_member(new.event_id) then
    raise exception 'join the event before posting' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger event_outfit_posts_member_only
  before insert on event_outfit_posts
  for each row execute function assert_post_is_member();
revoke execute on function assert_post_is_member() from public, anon, authenticated;

create policy "event_posts: members can select" on event_outfit_posts
  for select to authenticated using (public.is_event_member(event_id));
create policy "event_posts: owner can insert" on event_outfit_posts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "event_posts: owner can update" on event_outfit_posts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "event_posts: owner or host can delete" on event_outfit_posts
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_event_host(event_id));

-- Votes. See architecture.md §1.2 for why this is not outfit_reactions.
create table event_outfit_votes (
  post_id     uuid not null references event_outfit_posts (id) on delete cascade,
  event_id    uuid not null references events (id) on delete cascade,
  voter_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, voter_id),
  -- One vote per member per EVENT: this is a "pick the winner" contest.
  constraint one_vote_per_event unique (event_id, voter_id)
);
create index event_outfit_votes_event_idx on event_outfit_votes using btree (event_id);
create index event_outfit_votes_voter_idx on event_outfit_votes using btree (voter_id);
alter table event_outfit_votes enable row level security;

-- event_id is derived from the post, never trusted; and no self-votes.
create function assert_vote_target() returns trigger
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
  return new;
end; $$;
create trigger event_outfit_votes_target
  before insert on event_outfit_votes
  for each row execute function assert_vote_target();
revoke execute on function assert_vote_target() from public, anon, authenticated;

create policy "event_votes: members can select" on event_outfit_votes
  for select to authenticated using (public.is_event_member(event_id));
create policy "event_votes: voter can insert" on event_outfit_votes
  for insert to authenticated with check ((select auth.uid()) = voter_id);
create policy "event_votes: voter can delete" on event_outfit_votes
  for delete to authenticated using ((select auth.uid()) = voter_id);
-- No UPDATE policy: changing a vote is delete + insert.

-- Comments, with the moderation columns Guideline 1.2 requires acting on.
create table event_comments (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events (id) on delete cascade,
  post_id     uuid references event_outfit_posts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  reported    boolean not null default false,   -- flipped by report trigger
  hidden      boolean not null default false,   -- host/moderation kill switch
  created_at  timestamptz not null default now()
);
create index event_comments_event_idx on event_comments (event_id, created_at);
create index event_comments_post_idx  on event_comments using btree (post_id);
create index event_comments_user_idx  on event_comments using btree (user_id);
alter table event_comments enable row level security;

create policy "event_comments: members can select" on event_comments
  for select to authenticated
  using (public.is_event_member(event_id)
         and (not hidden
              or (select auth.uid()) = user_id      -- author sees own hidden
              or public.is_event_host(event_id)));  -- host sees what they hid
create policy "event_comments: member can insert" on event_comments
  for insert to authenticated
  with check ((select auth.uid()) = user_id
              and public.is_event_member(event_id)
              and not hidden and not reported);
-- The host's ONLY write on others' comments is the hidden flag — enforced by a
-- COLUMN-level grant (below) plus this policy. Authors do not edit comments.
create policy "event_comments: host can moderate" on event_comments
  for update to authenticated
  using (public.is_event_host(event_id))
  with check (public.is_event_host(event_id));
create policy "event_comments: author or host can delete" on event_comments
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_event_host(event_id));

-- A report against a comment marks it, and three distinct reporters hide it
-- until a human looks. Auto-hide-at-threshold is what "acting on reports
-- within 24h" degrades to gracefully when the operator is asleep.
create function on_report_mark_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.subject = 'comment' then
    update public.event_comments
       set reported = true,
           hidden   = hidden or (
             select count(distinct reporter_id) >= 3
               from public.content_reports
              where subject = 'comment' and subject_id = new.subject_id)
     where id = new.subject_id;
  end if;
  return new;
end; $$;
create trigger content_reports_mark_comment
  after insert on content_reports
  for each row execute function on_report_mark_comment();
revoke execute on function on_report_mark_comment() from public, anon, authenticated;

-- Grants. Note event_comments: UPDATE is granted on the ONE column the host
-- may flip; there is no path to rewriting someone's words.
grant select, insert, update, delete on event_outfit_posts to authenticated;
grant select, insert, delete         on event_outfit_votes to authenticated;
grant select, insert, delete         on event_comments     to authenticated;
grant update (hidden)                on event_comments     to authenticated;
