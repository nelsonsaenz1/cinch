-- ===========================================================================
-- Cinch Social, Migration A — blocks, reports, friendship derivation, borrowing.
--
-- Implements docs/social/architecture.md §2 (Migration A) verbatim. Ground
-- rules restated from §0, all verified against the migration history:
--
--   * No `to anon` policy anywhere. anon gets nothing in this feature.
--   * Every client grant is an explicit line at the bottom of this file.
--     Default privileges (20260805213000 + 20260806101000) mean new tables are
--     born with service_role access and NOTHING for the client roles.
--   * EXECUTE revokes target PUBLIC (20260805220000). Default function
--     privileges are already revoked-from-PUBLIC, so new functions are born
--     uncallable; the revokes below are belt-and-braces, the grants are the
--     deliberate lines.
--   * `(select auth.uid())`, per-command policies, `to authenticated`,
--     btree index on every policy-filtered column (20260803154431 conventions).
-- ===========================================================================

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
revoke execute on function is_friend(uuid)             from public, anon, authenticated;
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
  event_id      uuid,  -- FK to events(id) is added in Migration B (20260807101000):
                       -- the events table does not exist yet. The column exists
                       -- from birth so the row shape never changes.
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
-- requestable by THIS caller. References public.event_members and
-- public.is_event_member, both created in Migration B; plpgsql resolves
-- identifiers at execution, not creation, so this is safe to define first.
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
