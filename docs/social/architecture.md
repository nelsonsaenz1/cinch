# Cinch Social — Technical Architecture

Events ("dinner for 4 at Rosemary's"), attendee outfit posting and voting,
comments, a friend graph over the existing `follows` table, friend-closet
browsing, and borrow requests gated by a per-item `borrowable` flag.

This design extends the dormant social surface that already exists in the
schema. It was written against the full migration history (through
`20260806101000_service_role_grants.sql`) and the pgTAP suites in
`supabase/tests/01–04`. Every rule below that says "MUST" is a restatement of a
constraint from the 2026-08-04/05 security reviews, verified in the repo.

---

## 0. Ground rules (verified in the repo, non-negotiable)

1. **Dormant tables are extended, never dropped.** `follows`, `closet_likes`,
   `outfit_reactions`, `item_inquiries`, and the `public_profiles`,
   `public_items`, `public_outfits`, `public_outfit_items`,
   `public_like_counts` projection views all exist
   (`20260803210000`, `20260804200000`) and are the foundation here.
2. **Definer views get SELECT-only grants.** `20260805213000` proved (by probe)
   that a write grant on an auto-updatable definer view is a write against the
   base table with RLS off. Every view in this design gets exactly
   `grant select … to <role>` and nothing else. `security_invoker = true` is
   NEVER applied to `public_*` or any new projection view — definer rights plus
   the view's own `WHERE` clause **is** the access control. The five advisor
   ERRORs for `security_definer_view` are an accepted pattern (documented in
   `20260805213000`); the new views will add to that count and that is fine.
3. **No `to anon` (or any public-read) policy ever lands on a base table**
   (`profiles`, `items`, `outfits`, `outfit_items`, or any new table). All
   cross-user reads go through projection views, or through new tables that are
   *designed* for sharing and carry their own explicit `to authenticated` RLS.
4. **Every grant is an explicit migration line.** Default privileges are
   already locked down: new tables in `public` are born with service_role
   access and *nothing* for `anon`/`authenticated`
   (`20260805213000` + `20260806101000`). Each new table below therefore lists
   its exact grant lines, per-verb, following the `20260806100000` pattern.
   `anon` gets nothing anywhere in this feature.
5. **EXECUTE revokes target PUBLIC.** `20260805220000` documented why revoking
   from `anon, authenticated` alone is a no-op (they hold EXECUTE through the
   PUBLIC default). Default function privileges are already
   revoked-from-PUBLIC, so new functions are born uncallable; each function
   below lists its explicit `grant execute` line. Any belt-and-braces revoke is
   written `from public, anon, authenticated`.
6. **RLS conventions** from `20260803154431`: `(select auth.uid())` wrapped in
   a subselect, a btree index on every policy-filtered column,
   `to authenticated` on every policy, one policy per command, never `for all`.
7. **Tenant integrity via composite FKs** (`20260804200000`): wherever a new
   row must reference *the same user's* row, use
   `(x_id, user_id) references t (id, user_id)`. `items_id_user_key` and
   `outfits_id_user_key` already exist for this purpose.
8. **New tables get pgTAP boundary tests** in the style of `tests/01–03`:
   `throws_ok … '42501'` probes per role, `has_table_privilege` /
   `has_column_privilege` catalogue assertions, and catalogue sweeps filtered
   `c.relowner = 'postgres'::regrole` so realtime's transient tables cannot
   abort a run.

---

## 1. Decisions and their reasons

### 1.1 Friendship = mutual follow. No separate `friendships` table.

`follows` already exists with the right shape (composite PK, no-self check,
`followee_idx`, participant-only SELECT, counts denormalised onto `profiles`
by `sync_follow_counts()`, and explicit grants
`select, insert, delete` for `authenticated` in `20260806100000`).

A separate `friendships` table would duplicate the edge state machine and
create two sources of truth that can disagree ("we're friends but I don't
follow you"). Instead:

- **Follow** stays a one-way edge, insert/delete own edge, exactly as shipped.
- **Friend** is *derived*: `A` and `B` are friends iff both edges exist and
  neither has blocked the other. The derivation lives in one SECURITY DEFINER
  helper, `is_friend(uuid)`, used by every friend-scoped policy and view.
  A definer function is required anyway: policies on other tables cannot read
  `follows` under the caller's RLS without recursion/visibility problems.
- The follow-request UX ("add friend") maps to: I follow you (edge 1); your
  "requests" list is `followers I don't follow back`; accepting = following
  back (edge 2). No new state columns.

### 1.2 Event votes are a NEW table, not `outfit_reactions`.

`outfit_reactions` is the **personal ML training log**: it stores the caller's
own reaction to their own generated outfit, denormalised `item_ids`, and —
critically — the `features`/`baseline` vectors that let the style model be
replayed from scratch (`20260803210000`, `20260804202000`). Its RLS is
owner-only; its writes go through `apply_outfit_reaction()`, which also
mutates `style_profiles` under optimistic concurrency.

Event voting is a different object in every dimension: it targets *another
user's* post, it is event-scoped, it needs a uniqueness rule ("one vote"), it
must be readable by all event members, and it must never contaminate the
training corpus (a courtesy vote for a friend's dinner outfit is not a taste
signal). Overloading `outfit_reactions` would require loosening its RLS,
poisoning `style_profiles`, and inventing null-`features` rows the replay
logic would trip over. So: **`event_outfit_votes`**, event-scoped, with
`unique (event_id, voter_id)` — one vote per member per event ("pick the
winner"). Changing your vote is delete-then-insert. If the product spec wants
per-post approval voting instead, the change is dropping that unique index —
the schema does not need to move.

`closet_likes` similarly stays what it is (likes on *public* items/outfits,
enforced by `assert_like_target_is_public()`); it is not bent to event scope.

### 1.3 Friend closet reads go through new definer views, not new base-table policies.

Adding a `is_friend(user_id)` SELECT policy on `items` would hand a friend the
*whole row* — purchase price, purchase date, wear counts, raw `ai_tags`,
`image_path` (the original photo, with the room it was taken in). That is
exactly the column-leak the 2026-08-04 review fixed (CIN-01). Friend reads use
the same projection-view mechanism as public reads:

- `friend_items` — presentation columns only + `borrowable`, WHERE the owner
  is a friend of the caller.
- `social_profiles` — identity columns (user_id, username, display_name,
  avatar_url) for anyone the caller is *related to* (public, friend, follow
  edge, or co-member of an event), so rosters/comments/votes can be rendered
  without any base-table access.
- `event_post_items` — garment presentation columns for outfits posted into an
  event the caller belongs to, so attendees can render each other's looks
  without any grant on `outfits`/`outfit_items`/`items`.

These are `to authenticated` only. `anon` continues to hold nothing.

### 1.4 "Unborrowable" items: visible in the closet, absent from borrow surfaces.

`items.borrowable boolean not null default true`. Decision: an unborrowable
item **still appears** in a friend's closet view (it is part of the look of
the closet; hiding it makes closets look randomly incomplete and leaks the
flag's value by omission anyway), but:

- `friend_items` exposes the `borrowable` column so the UI renders it without
  a "request" affordance (no lock badge copy needed — it simply isn't
  requestable).
- Borrow *suggestions* filter `borrowable = true` client-side on
  `friend_items`.
- The database is the enforcing copy: a `borrow_requests` insert against a
  non-borrowable item is refused by trigger regardless of what the UI showed.

### 1.5 Existing `public_*` views ship for `authenticated` only.

The commented plan in `20260805213000` re-enables the views for
`anon, authenticated`. This feature is a signed-in social layer; there is no
logged-out surface in the app. Granting `authenticated` only:

- keeps every `anon` tripwire in `tests/01–03` green (they assert anon, not
  authenticated), minimising conscious test rewrites to the one storage
  assertion below;
- keeps the logged-out-web decision (and its scraping exposure) parked until a
  product actually needs it.

One `tests/03` assertion flips and must be consciously rewritten (see §8):
"a signed-in stranger sees no derivatives while the social surface is
deferred" becomes "a signed-in stranger sees exactly the published derivatives
of public items".

### 1.6 Venue: metadata columns + optional link. No reservation-platform API.

Per the research decision: venue data comes from device-local search (MapKit
local search via a small native module in `modules/`, or typed by hand) and is
*snapshotted* onto the event row — name, address, and the raw search payload in
`venue_meta jsonb` — plus an optional `reservation_url` the host pastes
(OpenTable/Resy/whatever). No server integration, no edge function, no venue
table: a venue on an event is context, not an entity we manage.

---

## 2. Schema DDL sketch

Four migrations, in this order. All conventions per §0.6.

### Migration A — `social_graph_blocks_borrow`

```sql
-- ---------------------------------------------------------------------------
-- Blocks. App Store Guideline 1.2 (UGC) requires the ability to block abusive
-- users. A block is one-way and silent; it severs the friend derivation and
-- excludes the pair from each other's social reads.
-- ---------------------------------------------------------------------------
create table user_blocks (
  blocker_id  uuid not null references auth.users (id) on delete cascade,
  blocked_id  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on user_blocks using btree (blocked_id);
alter table user_blocks enable row level security;

create policy "user_blocks: blocker can select" on user_blocks
  for select to authenticated using ((select auth.uid()) = blocker_id);
create policy "user_blocks: blocker can insert" on user_blocks
  for insert to authenticated with check ((select auth.uid()) = blocker_id);
create policy "user_blocks: blocker can delete" on user_blocks
  for delete to authenticated using ((select auth.uid()) = blocker_id);

-- Blocking tears down the follow edges in both directions (and with them the
-- friendship). SECURITY DEFINER because the blocker cannot delete the OTHER
-- user's follow edge under their own RLS.
create function on_block_sever_graph() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and followee_id = new.blocked_id)
      or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end; $$;
create trigger user_blocks_sever_graph
  after insert on user_blocks
  for each row execute function on_block_sever_graph();
revoke execute on function on_block_sever_graph() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reports. Guideline 1.2 also requires flagging objectionable content, and a
-- mechanism for the developer to act. Rows are write-once by the reporter and
-- worked by the operator (service_role / dashboard) only.
-- ---------------------------------------------------------------------------
create type report_subject as enum
  ('profile', 'item', 'outfit_post', 'comment', 'event');

create table content_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references auth.users (id) on delete cascade,
  subject      report_subject not null,
  subject_id   uuid not null,          -- id in the subject's table; no FK on
                                       -- purpose: a report must survive the
                                       -- reported thing being deleted.
  subject_user uuid,                    -- denormalised author, for triage
  reason       text not null check (char_length(reason) between 1 and 100),
  details      text check (char_length(details) <= 2000),
  status       text not null default 'open'
               check (status in ('open', 'actioned', 'dismissed')),
  created_at   timestamptz not null default now()
);
create index content_reports_reporter_idx on content_reports using btree (reporter_id);
create index content_reports_open_idx on content_reports (created_at) where status = 'open';
alter table content_reports enable row level security;

create policy "content_reports: reporter can select" on content_reports
  for select to authenticated using ((select auth.uid()) = reporter_id);
create policy "content_reports: reporter can insert" on content_reports
  for insert to authenticated with check ((select auth.uid()) = reporter_id);
-- no update/delete policies: triage is service_role's job.

-- ---------------------------------------------------------------------------
-- Friendship derivation + block screen. THE central predicate of the feature.
-- SECURITY DEFINER: policies on other tables must evaluate it without holding
-- rights on follows/user_blocks, and without RLS recursion.
-- ---------------------------------------------------------------------------
create function blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_blocks
     where (blocker_id = p_a and blocked_id = p_b)
        or (blocker_id = p_b and blocked_id = p_a));
$$;

create function is_friend(p_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_other is not null
     and p_other <> (select auth.uid())
     and not public.blocked_between((select auth.uid()), p_other)
     and exists (select 1 from public.follows
                  where follower_id = (select auth.uid()) and followee_id = p_other)
     and exists (select 1 from public.follows
                  where follower_id = p_other and followee_id = (select auth.uid()));
$$;

-- Policy expressions evaluate with the CALLER's privileges, so authenticated
-- needs EXECUTE. Default privileges already stripped PUBLIC; grant explicitly.
revoke execute on function blocked_between(uuid, uuid) from public, anon, authenticated;
grant  execute on function blocked_between(uuid, uuid) to authenticated;
grant  execute on function is_friend(uuid)             to authenticated;

-- ---------------------------------------------------------------------------
-- Borrowing.
-- ---------------------------------------------------------------------------
alter table items add column borrowable boolean not null default true;

create table borrow_requests (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references items (id) on delete cascade,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  requester_id  uuid not null references auth.users (id) on delete cascade,
  event_id      uuid references events (id) on delete set null,  -- added in
                -- Migration B via ALTER; listed here for completeness.
  message       text check (char_length(message) <= 500),
  status        text not null default 'pending'
                check (status in ('pending','approved','declined','canceled','returned')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint borrow_no_self check (owner_id <> requester_id)
);
create index borrow_requests_owner_idx     on borrow_requests using btree (owner_id);
create index borrow_requests_requester_idx on borrow_requests using btree (requester_id);
create index borrow_requests_item_idx      on borrow_requests using btree (item_id);
alter table borrow_requests enable row level security;
create trigger borrow_requests_set_updated_at
  before update on borrow_requests for each row execute function set_updated_at();

-- Same shape as assert_inquiry_target (20260804200000): derive the owner from
-- the item — never trust the caller — and require the item to be genuinely
-- requestable by THIS caller.
create function assert_borrow_target() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select i.user_id into v_owner
    from public.items i
   where i.id = new.item_id and i.borrowable and not i.is_archived;
  if v_owner is null then
    raise exception 'that item cannot be borrowed' using errcode = '42501';
  end if;
  new.owner_id := v_owner;                    -- authoritative, not advisory
  if new.owner_id = new.requester_id then
    raise exception 'you own this item' using errcode = '22023';
  end if;
  -- Reachability: a friend, or a co-member of the named event.
  if not public.is_friend(new.owner_id)
     and (new.event_id is null
          or not exists (select 1 from public.event_members m
                          where m.event_id = new.event_id
                            and m.user_id  = new.owner_id
                            and m.state    = 'joined')
          or not public.is_event_member(new.event_id)) then
    raise exception 'you can only borrow from friends or event co-attendees'
      using errcode = '42501';
  end if;
  if public.blocked_between(new.owner_id, new.requester_id) then
    raise exception 'that item cannot be borrowed' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger borrow_requests_target_must_be_borrowable
  before insert on borrow_requests
  for each row execute function assert_borrow_target();
revoke execute on function assert_borrow_target() from public, anon, authenticated;

create policy "borrow_requests: participants can select" on borrow_requests
  for select to authenticated
  using ((select auth.uid()) in (owner_id, requester_id));
create policy "borrow_requests: requester can insert" on borrow_requests
  for insert to authenticated with check ((select auth.uid()) = requester_id);
-- Owner answers; requester cancels. The trigger below pins who may reach
-- which status; the policy pins who may touch the row at all.
create policy "borrow_requests: participants can update" on borrow_requests
  for update to authenticated
  using ((select auth.uid()) in (owner_id, requester_id))
  with check ((select auth.uid()) in (owner_id, requester_id));

create function assert_borrow_transition() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.item_id <> old.item_id or new.owner_id <> old.owner_id
     or new.requester_id <> old.requester_id or new.event_id is distinct from old.event_id then
    raise exception 'only status may change' using errcode = '42501';
  end if;
  if (select auth.uid()) = old.owner_id then
    if not (old.status = 'pending'  and new.status in ('approved','declined'))
       and not (old.status = 'approved' and new.status = 'returned') then
      raise exception 'invalid transition' using errcode = '22023';
    end if;
  elsif (select auth.uid()) = old.requester_id then
    if not (old.status = 'pending' and new.status = 'canceled') then
      raise exception 'invalid transition' using errcode = '22023';
    end if;
  end if;
  return new;
end; $$;
create trigger borrow_requests_valid_transition
  before update on borrow_requests
  for each row execute function assert_borrow_transition();
revoke execute on function assert_borrow_transition() from public, anon, authenticated;

-- Explicit grants (default privileges give clients nothing).
grant select, insert, delete on user_blocks     to authenticated;
grant select, insert         on content_reports to authenticated;
grant select, insert, update on borrow_requests to authenticated;
```

### Migration B — `events`

```sql
create type event_visibility   as enum ('invite_only', 'friends');
create type event_member_role  as enum ('host', 'attendee');
create type event_member_state as enum ('invited', 'joined', 'declined', 'removed');

create table events (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid not null references auth.users (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 80),
  note             text check (char_length(note) <= 1000),
  occasion         text,                 -- feeds outfit generation context
  dress_code       text,
  starts_at        timestamptz not null,
  ends_at          timestamptz check (ends_at is null or ends_at > starts_at),
  party_size       smallint check (party_size between 1 and 100),
  visibility       event_visibility not null default 'invite_only',

  -- Venue: a snapshot from device-local search, not a managed entity.
  venue_name       text,
  venue_address    text,
  venue_meta       jsonb,                -- raw local-search payload (coords etc.)
  reservation_url  text check (reservation_url is null
                               or reservation_url ~* '^https://'),

  canceled_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index events_host_idx       on events using btree (host_id);
create index events_host_time_idx  on events (host_id, starts_at);
alter table events enable row level security;
create trigger events_set_updated_at
  before update on events for each row execute function set_updated_at();

create table event_members (
  event_id    uuid not null references events (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        event_member_role  not null default 'attendee',
  state       event_member_state not null default 'invited',
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_members_user_idx  on event_members using btree (user_id);
create index event_members_event_joined_idx
  on event_members (event_id) where state = 'joined';
alter table event_members enable row level security;
create trigger event_members_set_updated_at
  before update on event_members for each row execute function set_updated_at();

-- Membership predicates. SECURITY DEFINER is what breaks the RLS recursion:
-- event_members policies reference event membership, which would otherwise
-- re-enter event_members' own policies forever.
create function is_event_member(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.event_members
                  where event_id = p_event
                    and user_id  = (select auth.uid())
                    and state    = 'joined');
$$;
create function is_event_host(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events
                  where id = p_event and host_id = (select auth.uid()));
$$;
create function can_see_event(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_event_host(p_event)
      or exists (select 1 from public.event_members          -- any state: an
                  where event_id = p_event                    -- invitee must
                    and user_id  = (select auth.uid()))       -- see the invite
      or exists (select 1 from public.events e
                  where e.id = p_event
                    and e.visibility = 'friends'
                    and public.is_friend(e.host_id));
$$;
grant execute on function is_event_member(uuid) to authenticated;
grant execute on function is_event_host(uuid)   to authenticated;
grant execute on function can_see_event(uuid)   to authenticated;

-- The host is a member from birth; nothing may ever have to branch on
-- "the host might not have a member row" (same reasoning as handle_new_user).
create function handle_new_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.event_members (event_id, user_id, role, state, invited_by)
  values (new.id, new.host_id, 'host', 'joined', new.host_id)
  on conflict (event_id, user_id) do nothing;
  return new;
end; $$;
create trigger on_event_created after insert on events
  for each row execute function handle_new_event();
revoke execute on function handle_new_event() from public, anon, authenticated;

-- events policies
create policy "events: visible to participants" on events
  for select to authenticated using (public.can_see_event(id));
create policy "events: host can insert" on events
  for insert to authenticated with check ((select auth.uid()) = host_id);
create policy "events: host can update" on events
  for update to authenticated
  using ((select auth.uid()) = host_id)
  with check ((select auth.uid()) = host_id);
create policy "events: host can delete" on events
  for delete to authenticated using ((select auth.uid()) = host_id);

-- event_members policies
create policy "event_members: roster visible to participants" on event_members
  for select to authenticated
  using ((select auth.uid()) = user_id or public.can_see_event(event_id));
-- Two insert paths, one policy: the host invites someone, or a user adds
-- THEMSELVES to a friends-visible event. Everything else is refused.
create policy "event_members: host invites or friend self-joins" on event_members
  for insert to authenticated
  with check (
    (public.is_event_host(event_id)
       and state = 'invited' and role = 'attendee'
       and invited_by = (select auth.uid())
       and not public.blocked_between((select auth.uid()), user_id))
    or
    ((select auth.uid()) = user_id
       and state = 'joined' and role = 'attendee'
       and exists (select 1 from public.events e
                    where e.id = event_id
                      and e.visibility = 'friends'
                      and e.canceled_at is null
                      and public.is_friend(e.host_id)))
  );
-- Own row: accept/decline. Host: remove. Transitions pinned by trigger.
create policy "event_members: self or host can update" on event_members
  for update to authenticated
  using ((select auth.uid()) = user_id or public.is_event_host(event_id))
  with check ((select auth.uid()) = user_id or public.is_event_host(event_id));
create policy "event_members: self or host can delete" on event_members
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_event_host(event_id));

create function assert_member_transition() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.event_id <> old.event_id or new.user_id <> old.user_id
     or new.role <> old.role then
    raise exception 'only state may change' using errcode = '42501';
  end if;
  if (select auth.uid()) = old.user_id then
    if not (old.state in ('invited','declined') and new.state in ('joined','declined'))
       and new.state is distinct from old.state then
      raise exception 'invalid transition' using errcode = '22023';
    end if;
  else  -- host path (policy already guaranteed host)
    if new.state <> 'removed' then
      raise exception 'the host may only remove' using errcode = '22023';
    end if;
  end if;
  return new;
end; $$;
create trigger event_members_valid_transition
  before update on event_members
  for each row execute function assert_member_transition();
revoke execute on function assert_member_transition() from public, anon, authenticated;

-- Now the deferred column from Migration A:
alter table borrow_requests
  add constraint borrow_requests_event_fk
  foreign key (event_id) references events (id) on delete set null;
create index borrow_requests_event_idx on borrow_requests using btree (event_id);

grant select, insert, update, delete on events        to authenticated;
grant select, insert, update, delete on event_members to authenticated;
```

*(If the CLI orders migrations strictly, `borrow_requests` simply moves into
Migration B after `events` — the split above is presentational.)*

### Migration C — `event_outfits_votes_comments`

```sql
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

-- Votes. See §1.2 for why this is not outfit_reactions.
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
```

### Migration D — `social_views_grants_realtime_limits`

```sql
-- ---------------------------------------------------------------------------
-- Projection views. All SECURITY DEFINER (the default; spelled out because it
-- is load-bearing): the WHERE clause is the access control. SELECT-only
-- grants, authenticated only. NEVER a write grant; NEVER security_invoker.
-- auth.uid() resolves from the request JWT regardless of the definer role, so
-- these views are per-caller even though they run as their owner.
-- ---------------------------------------------------------------------------

-- Identity for anyone the caller is legitimately related to. This is what
-- rosters, votes, comments and friend lists render from — no base-table reads.
create view social_profiles
with (security_invoker = false) as
  select p.user_id, p.username, p.display_name, p.avatar_url
    from profiles p
   where p.user_id <> (select auth.uid())
     and not blocked_between((select auth.uid()), p.user_id)
     and (
       p.visibility = 'public'
       or is_friend(p.user_id)
       or exists (select 1 from follows f            -- either direction
                   where (f.follower_id = (select auth.uid()) and f.followee_id = p.user_id)
                      or (f.followee_id = (select auth.uid()) and f.follower_id = p.user_id))
       or exists (select 1 from event_members me     -- co-membership
                   join event_members them on them.event_id = me.event_id
                  where me.user_id = (select auth.uid())
                    and them.user_id = p.user_id)
     );

-- A friend's closet: presentation columns only (same list as public_items,
-- which is the reviewed definition of "what a shared garment is") plus
-- plate_path and borrowable. No prices, no wear history, no originals.
create view friend_items
with (security_invoker = false) as
  select i.id, i.user_id, i.category, i.subcategory, i.colors, i.pattern,
         i.material, i.brand, i.seasons, i.occasions, i.description,
         i.thumb_path, i.cutout_path, i.plate_path, i.borrowable, i.created_at
    from items i
   where not i.is_archived
     and is_friend(i.user_id);

-- The garments inside outfits posted to an event the caller belongs to.
create view event_post_items
with (security_invoker = false) as
  select ep.id as post_id, ep.event_id,
         oi.item_id, oi.position,
         i.user_id, i.category, i.subcategory, i.colors,
         i.thumb_path, i.cutout_path, i.plate_path, i.borrowable
    from event_outfit_posts ep
    join outfit_items oi on oi.outfit_id = ep.outfit_id
    join items i         on i.id = oi.item_id
   where is_event_member(ep.event_id);

-- Vote tallies without enumerating voters (voter identities are visible via
-- the votes table itself to members; this exists so list screens don't pay a
-- fan-out, mirroring public_like_counts).
create view event_vote_counts
with (security_invoker = false) as
  select v.event_id, v.post_id, count(*)::bigint as votes
    from event_outfit_votes v
   where is_event_member(v.event_id)
   group by v.event_id, v.post_id;

-- SELECT-only. authenticated only. (Rule: a write grant on a definer view is
-- a write against the base table with RLS off — 20260805213000.)
grant select on social_profiles, friend_items, event_post_items, event_vote_counts
  to authenticated;

-- Un-park the reviewed public projections, for signed-in users only (§1.5).
grant select on public_profiles, public_items, public_outfits,
                public_outfit_items, public_like_counts
  to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: derivatives only, ever ({user}/{item}/thumb.jpg|cutout.png|plate.png;
-- original.jpg is NEVER shared — 20260804200000). Three read paths:
-- ---------------------------------------------------------------------------
create policy "garments: public derivatives readable when signed in" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garments'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and storage.filename(name) in ('thumb.jpg', 'cutout.png', 'plate.png')
    and exists (
      select 1 from public.items i
       join public.profiles p on p.user_id = i.user_id
       where i.id = ((storage.foldername(name))[2])::uuid
         and i.is_public and not i.is_archived and p.visibility = 'public'));

create policy "garments: friends read derivatives" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garments'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and storage.filename(name) in ('thumb.jpg', 'cutout.png', 'plate.png')
    and exists (
      select 1 from public.items i
       where i.id = ((storage.foldername(name))[2])::uuid
         and not i.is_archived
         and public.is_friend(i.user_id)));

create policy "garments: event co-members read posted derivatives" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garments'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and storage.filename(name) in ('thumb.jpg', 'cutout.png', 'plate.png')
    and exists (
      select 1 from public.event_outfit_posts ep
       join public.outfit_items oi on oi.outfit_id = ep.outfit_id
       where oi.item_id = ((storage.foldername(name))[2])::uuid
         and public.is_event_member(ep.event_id)));

-- ---------------------------------------------------------------------------
-- Realtime. Only the two tables an open event screen must see move live.
-- Postgres Changes runs each subscriber's RLS, so members-only stays
-- members-only over the socket too.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table event_outfit_votes, event_comments;

-- ---------------------------------------------------------------------------
-- Rate limits (see §6). One trigger per write surface, counting recent rows —
-- no counter table needed at this scale; the policy indexes above cover the
-- counting queries.
-- ---------------------------------------------------------------------------
create function enforce_social_rate_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if tg_table_name = 'event_comments' then
    select count(*) into v_count from public.event_comments
     where user_id = new.user_id and created_at > now() - interval '1 hour';
    if v_count >= 30 then
      raise exception 'rate_limited: comments' using errcode = '54000',
        hint = 'You are commenting very fast. Take a breath.';
    end if;
  elsif tg_table_name = 'event_members' then
    select count(*) into v_count from public.event_members
     where invited_by = new.invited_by and created_at > now() - interval '1 day';
    if v_count >= 100 then
      raise exception 'rate_limited: invites' using errcode = '54000';
    end if;
  elsif tg_table_name = 'follows' then
    select count(*) into v_count from public.follows
     where follower_id = new.follower_id and created_at > now() - interval '1 day';
    if v_count >= 100 then
      raise exception 'rate_limited: follows' using errcode = '54000';
    end if;
  elsif tg_table_name = 'content_reports' then
    select count(*) into v_count from public.content_reports
     where reporter_id = new.reporter_id and created_at > now() - interval '1 day';
    if v_count >= 20 then
      raise exception 'rate_limited: reports' using errcode = '54000';
    end if;
  elsif tg_table_name = 'borrow_requests' then
    select count(*) into v_count from public.borrow_requests
     where requester_id = new.requester_id and created_at > now() - interval '1 day';
    if v_count >= 20 then
      raise exception 'rate_limited: borrow requests' using errcode = '54000';
    end if;
  end if;
  return new;
end; $$;
revoke execute on function enforce_social_rate_limits() from public, anon, authenticated;
create trigger event_comments_rate_limit  before insert on event_comments  for each row execute function enforce_social_rate_limits();
create trigger event_members_rate_limit   before insert on event_members   for each row execute function enforce_social_rate_limits();
create trigger follows_rate_limit         before insert on follows         for each row execute function enforce_social_rate_limits();
create trigger content_reports_rate_limit before insert on content_reports for each row execute function enforce_social_rate_limits();
create trigger borrow_requests_rate_limit before insert on borrow_requests for each row execute function enforce_social_rate_limits();

-- Tier gating: hosting is the only social act with real fan-out cost.
create function event_limit_for_plan(p_plan subscription_plan) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan when 'free' then 2 when 'standard' then 15 when 'pro' then 100 end;
$$;
create function enforce_event_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_limit integer; v_count integer;
begin
  v_limit := public.event_limit_for_plan(public.effective_plan(new.host_id));
  select count(*) into v_count from public.events
   where host_id = new.host_id and canceled_at is null
     and coalesce(ends_at, starts_at + interval '6 hours') > now();
  if v_count >= v_limit then
    raise exception 'event_limit_reached: % of % upcoming events', v_count, v_limit
      using errcode = 'check_violation', hint = 'Upgrade to host more events.';
  end if;
  return new;
end; $$;
revoke execute on function event_limit_for_plan(subscription_plan) from public, anon, authenticated;
revoke execute on function enforce_event_limit() from public, anon, authenticated;
create trigger events_enforce_limit before insert on events
  for each row execute function enforce_event_limit();
```

*(`enforce_event_limit` calls `effective_plan()` inside a SECURITY DEFINER
function, so the caller needs no EXECUTE on `effective_plan` — the existing
service-role-only grant on it is untouched.)*

---

## 3. RLS policy matrix

All policies `to authenticated`; `anon` holds nothing anywhere. `service_role`
bypasses RLS and holds table grants via the default-privilege migration
(`20260806101000`) — no per-table lines needed.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `events` | host, any member row (incl. invited), or friend-of-host when `visibility='friends'` (`can_see_event`) | own row as host (tier trigger) | host only | host only |
| `event_members` | own row, or anyone who can see the event | host inviting (`state='invited'`), or self-join on friends-visible event (`state='joined'`); block-screened | own row (invited→joined/declined) or host (→`removed`); trigger pins transitions | own row (leave) or host |
| `event_outfit_posts` | joined members | owner, must be joined member (trigger); composite FK forces own outfit | owner (caption) | owner or host |
| `event_outfit_votes` | joined members | voter; trigger derives `event_id`, forbids self-vote, requires membership; `unique(event_id, voter_id)` | — (none) | voter (change vote) |
| `event_comments` | joined members; `hidden` rows only to author + host | author, joined member, rate-limited | host only, and only the `hidden` column (column-level grant) | author or host |
| `borrow_requests` | owner or requester | requester; trigger derives owner, requires `borrowable`+friend/co-member, blocks screened | owner or requester; trigger pins per-role status transitions | — (cancel is a status) |
| `user_blocks` | blocker | blocker | — | blocker (unblock) |
| `content_reports` | reporter (own reports) | reporter, rate-limited | — (service_role triage) | — |
| `follows` *(existing, unchanged)* | participants | own edge (now rate-limited) | — | own edge |
| `closet_likes`, `item_inquiries`, `outfit_reactions` | **unchanged** — not part of this feature's surface | | | |
| `items` | owner (unchanged); friends read via `friend_items` view only | owner | owner (this is how `borrowable` is toggled — no new policy needed) | owner |
| `outfits`, `outfit_items` | owner (unchanged); event reads via `event_post_items` view only | owner | owner | owner |

### Read routing (who reads what through which surface)

| Need | Surface | Grant |
|---|---|---|
| Browse a public closet (signed in) | `public_profiles`, `public_items`, `public_outfits`, `public_outfit_items`, `public_like_counts` | `select` → `authenticated` (un-parked, §1.5) |
| Names/avatars for rosters, votes, comments, friend lists | `social_profiles` | `select` → `authenticated` |
| A friend's closet incl. `borrowable` | `friend_items` | `select` → `authenticated` |
| Garments inside event posts | `event_post_items` | `select` → `authenticated` |
| Vote tallies | `event_vote_counts` | `select` → `authenticated` |
| Event data, roster, posts, votes, comments, borrows | base tables above, direct, under their own RLS | per-verb grants listed in §2 |
| Images (thumb/cutout/plate only, never original.jpg) | signed URLs via existing `useSignedUrls` — the three new `storage.objects` SELECT policies make `createSignedUrls` succeed for public/friend/event paths | policies in Migration D |

### Complete grant summary (every line explicit, per `20260806100000` pattern)

```sql
-- Migration A
grant select, insert, delete on user_blocks     to authenticated;
grant select, insert         on content_reports to authenticated;
grant select, insert, update on borrow_requests to authenticated;
-- Migration B
grant select, insert, update, delete on events        to authenticated;
grant select, insert, update, delete on event_members to authenticated;
-- Migration C
grant select, insert, update, delete on event_outfit_posts to authenticated;
grant select, insert, delete         on event_outfit_votes to authenticated;
grant select, insert, delete         on event_comments     to authenticated;
grant update (hidden)                on event_comments     to authenticated;
-- Migration D (views: SELECT ONLY — never write verbs on definer views)
grant select on social_profiles, friend_items, event_post_items, event_vote_counts to authenticated;
grant select on public_profiles, public_items, public_outfits, public_outfit_items, public_like_counts to authenticated;
-- Functions callable by the client (directly or inside policy expressions)
grant execute on function blocked_between(uuid, uuid) to authenticated;
grant execute on function is_friend(uuid)             to authenticated;
grant execute on function is_event_member(uuid)       to authenticated;
grant execute on function is_event_host(uuid)         to authenticated;
grant execute on function can_see_event(uuid)         to authenticated;
-- anon: zero lines. Nothing for anon anywhere in this feature.
```

---

## 4. How a friend browses another closet (end to end)

1. Friends list: `social_profiles` filtered client-side to `is_friend` pairs —
   in practice the app selects `follows` (participant-visible) both ways and
   intersects, then hydrates identities from `social_profiles`.
2. Closet screen for friend `F`: `select * from friend_items where user_id = F
   order by created_at desc`. The view enforces friendship per-row; a revoked
   friendship or a block empties the result on the next fetch, no cache purge
   required server-side.
3. Images: existing `useSignedUrls` with `thumb_path`/`cutout_path`/
   `plate_path` from the view. The "friends read derivatives" storage policy
   authorizes the signing call under the caller's own JWT. `original.jpg` has
   no path through any policy.
4. `borrowable = false` items render in the grid **without** the borrow
   affordance (§1.4) and are excluded from borrow-suggestion ranking.
5. "Ask to borrow" inserts into `borrow_requests`; the trigger re-derives the
   owner, re-checks `borrowable`, friendship/co-membership, and blocks —
   the UI's filtering is presentation, not authorization.

---

## 5. Realtime vs polling

**Realtime (Postgres Changes, RLS-checked per subscriber):**
`event_outfit_votes` and `event_comments` only — the two tables that change
under a user's fingers while an event screen is open, driven by *other*
people. One channel per open event screen:

```ts
supabase.channel(`event:${eventId}`)
  .on('postgres_changes', { event: '*', schema: 'public',
      table: 'event_outfit_votes', filter: `event_id=eq.${eventId}` }, invalidateVotes)
  .on('postgres_changes', { event: '*', schema: 'public',
      table: 'event_comments', filter: `event_id=eq.${eventId}` }, invalidateComments)
  .subscribe();
```

Handlers **invalidate react-query keys** rather than patching caches — the
refetch re-reads through RLS/views, so a payload can never show someone a row
the query path wouldn't. Channel is subscribed only while an event screen is
focused, torn down on blur (Supabase free tier: 200 concurrent connections —
one channel per active viewer is well inside it; Pro raises it regardless,
which is already a release-blocker item).

**Polling / on-focus react-query (no realtime):** events list, event detail
metadata, rosters (`refetchOnFocus`, ~30s staleTime on the open detail),
friend closets, follows/friends, borrow requests (on-focus + pull-to-refresh),
public closets. None of these change at conversational speed; membership
changes are picked up by the vote/comment refetches' 403/empty results
naturally.

`event_members` is deliberately **not** in the publication for MVP: the roster
matters at invite time, not second-by-second, and every published table is
RLS-evaluation fan-out on the realtime worker.

---

## 6. Quota, abuse, tier gating

| Surface | Limit | Mechanism |
|---|---|---|
| Comments | 30 / hour / user | before-insert trigger (errcode `54000`) |
| Invites | 100 / day / inviter | same trigger family |
| Follows | 100 / day / follower | same |
| Reports | 20 / day / reporter | same |
| Borrow requests | 20 / day / requester | same |
| Hosting events | free 2 · standard 15 · pro 100 **upcoming, un-canceled** | `enforce_event_limit()` via `effective_plan()` (trial folds to pro, matching `use-plan.ts`) |
| Joining events, voting | uncapped (bounded by membership + one-vote-unique) | constraints |

Rationale: these are *abuse* controls in the `plans.ts` sense — set well above
any honest usage so the product never shows a limit UI for them; only event
hosting is a visible plan boundary (it has real fan-out cost and maps cleanly
to "who is this product for"). None of this touches `ai_usage_counters` /
`claim_ai_quota`, which remain AI-spend controls under the service role; the
client copy of the hosting numbers goes next to `PLAN_ITEM_LIMITS` in
`src/features/billing/plans.ts` with the same "change one, change the other"
comment discipline. Errors surface with stable errcodes (`54000` rate,
`check_violation` plan) so the client can branch to "slow down" vs "upgrade".

---

## 7. Notifications

**Out of MVP.** Nothing in the stack exists yet: no `expo-notifications`, no
token table, no sender. The moments that will want push, in priority order:
invite received → borrow request received/answered → comment on your post →
votes settling ("your outfit won"). Shipping requires: `push_tokens` table
(owner-write, service-role read), `expo-notifications` + APNs config in
`app.config.ts`/EAS, a `send-push` edge function (service role) fed by DB
webhooks on `event_members`/`borrow_requests`/`event_comments`, and quota on
sends. That is its own reviewed slice; the MVP substitutes in-app badges
(unanswered invites + pending borrows counted on the Plan tab and profile
sheet via the existing query layer). The schema above needs zero changes to
add push later — which is the test that it is safe to defer.

---

## 8. pgTAP boundary tests (Agent DB deliverable)

New files, following `tests/01–03` house style (four roles; `throws_ok` with
sqlstate `'42501'`; catalogue assertions; sweeps filtered
`relowner = 'postgres'::regrole`):

- **`05_social_graph_boundary.sql`** — blocks sever both follow edges;
  `is_friend` false for one-way follow, true for mutual, false again after
  block; anon `throws_ok '42501'` on `user_blocks`, `content_reports`,
  `borrow_requests`, `friend_items`, `social_profiles`; a NON-friend
  authenticated user reads zero rows from `friend_items`; a friend reads
  presentation columns but `has_column_privilege`-style assertion that
  `friend_items` projects no `purchase_price`/`image_path`/`wear_count`
  columns (information_schema check, as in `02`'s view-column sweeps);
  `borrow_requests` insert against `borrowable=false` throws `42501`; owner
  spoofing (`owner_id` set to someone else) is overwritten by the trigger.
- **`06_event_boundary.sql`** — non-member `throws_ok/zero-rows` on `events`,
  `event_members`, `event_outfit_posts`, `event_outfit_votes`,
  `event_comments`, `event_post_items`; invitee sees the event but not posts
  (`state='invited'` ≠ member); friend-visible event discoverable by friend,
  invisible to stranger; posting someone else's outfit fails on the composite
  FK (`23503`); self-vote throws `22023`; second vote in one event fails
  `23505`; hidden comment invisible to a third member, visible to author and
  host; host can flip `hidden` but an UPDATE touching `body` throws `42501`
  (column grant); **catalogue tripwires:** `has_table_privilege` asserts
  authenticated holds NO INSERT/UPDATE/DELETE on any of the four new views and
  on all five `public_*` views (the definer-view write hole, permanently
  fenced), and anon holds no privilege at all on any new table or view.
- **`07_social_storage.sql`** — friend signs a friend's `thumb.jpg`/`plate.png`
  (visible), friend CANNOT see `original.jpg` (count 0), stranger sees nothing
  friend-scoped, event co-member sees posted items' derivatives only.
- **Edited:** `tests/03_storage_bucket.sql` — the single deliberate tripwire
  that flips: "a signed-in stranger sees no derivatives while the social
  surface is deferred" is consciously rewritten to assert the stranger now
  sees exactly the public item's `thumb.jpg` (count 1) and still zero
  `original.jpg`. `tests/01/02` stay untouched — all their assertions are
  anon-scoped or base-table-scoped and remain true under this design (this was
  a design input, not luck: §1.5).
- **Catalogue sweep addition** (in `05`): every table created by this feature
  appears in the RLS-enabled sweep automatically (tests are written as
  invariants over the catalogue, per `01`'s preamble — no name lists to
  forget).

---

## 9. Open conflicts between the constraints and the founder's ask

1. **"View friends' closets" vs the projection-view rule.** Resolved, but with
   a product consequence to flag: friends see the *presentation* projection
   (same column set the security review approved for public items). If the
   founder expects friends to see prices, wear counts, or original photos,
   that is a deliberate widening of `friend_items` that must go back through
   review — the current design says no.
2. **"Attendees post outfit ideas" vs owner-only `outfits`.** An event post
   makes the outfit's *composition* (which garments, incl. private ones)
   visible to all event members via `event_post_items` and the storage policy
   — including garments the owner never marked public. This is the founder's
   intent read plainly ("post outfit ideas from their closets"), but it means
   posting to an event is an act of publication to that audience. The UI must
   say so at post time; the schema cannot soften it.
3. **Votes and `closet_likes`/`outfit_reactions`.** The ask said "vote on
   outfits" — deliberately NOT routed into either dormant table (§1.2). If a
   later ask wants event votes to feed the style-learning flywheel, that is a
   service-role batch job reading `event_outfit_votes`, never a widening of
   `outfit_reactions`.
4. **Realtime on RLS-heavy tables.** Vote/comment policies call
   `is_event_member()` per change per subscriber. Fine at launch scale; if an
   event ever has hundreds of members the fix is realtime *broadcast* from a
   definer function, not loosening RLS. Noted so nobody "optimizes" by adding
   a broad policy.
5. **Anon stays out entirely.** The founder's ask never mentions logged-out
   browsing, so the anon half of the parked social surface stays parked, and
   the `tests/02` anon tripwires stay armed. If marketing later wants shareable
   public closet links, that is the moment those tripwires are consciously
   rewritten — with the storage `anon` question re-opened alongside.
