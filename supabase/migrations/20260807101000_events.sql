-- ===========================================================================
-- Cinch Social, Migration B — events and event membership.
--
-- Implements docs/social/architecture.md §2 (Migration B) verbatim. Same
-- ground rules as Migration A (20260807100000): no anon anywhere, explicit
-- grants only, EXECUTE revokes target PUBLIC, `(select auth.uid())`,
-- per-command policies, an index on every policy-filtered column.
--
-- Venue fields are a snapshot from device-local search, not a managed entity
-- (architecture.md §1.6): name, address, the raw search payload, and an
-- optional pasted reservation link. No venue table, no platform API.
-- ===========================================================================

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
-- Policy expressions evaluate with the caller's privileges (same reasoning as
-- is_friend in Migration A). Born uncallable via default privileges; the
-- revokes are belt-and-braces, the grants are the deliberate lines.
revoke execute on function is_event_member(uuid) from public, anon, authenticated;
revoke execute on function is_event_host(uuid)   from public, anon, authenticated;
revoke execute on function can_see_event(uuid)   from public, anon, authenticated;
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
