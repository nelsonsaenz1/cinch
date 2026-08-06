-- ===========================================================================
-- Cinch Social, Migration D — projection views, grants, storage, realtime,
-- rate limits, tier gating.
--
-- Implements docs/social/architecture.md §2 (Migration D). One deliberate
-- mechanical deviation from the doc's sketch, called out at the storage
-- section below; every WHERE clause and grant is otherwise verbatim.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Projection views. All SECURITY DEFINER (the default; spelled out because it
-- is load-bearing): the WHERE clause is the access control. SELECT-only
-- grants, authenticated only. NEVER a write grant; NEVER security_invoker.
-- auth.uid() resolves from the request JWT regardless of the definer role, so
-- these views are per-caller even though they run as their owner.
-- (20260805213000 proved by probe that a write grant on a definer view is a
-- write against the base table with RLS off. These views add to the advisor's
-- accepted security_definer_view ERRORs; that is the documented pattern.)
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
-- An unborrowable item still appears (architecture.md §1.4) — the UI reads
-- `borrowable` and simply renders no request affordance; the borrow trigger
-- is the enforcing copy.
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

-- Un-park the reviewed public projections, for signed-in users only
-- (architecture.md §1.5): this feature is a signed-in social layer, there is
-- no logged-out surface, and granting authenticated only keeps every anon
-- tripwire in tests/01–03 armed. anon stays parked.
grant select on public_profiles, public_items, public_outfits,
                public_outfit_items, public_like_counts
  to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: derivatives only, ever ({user}/{item}/thumb.jpg|cutout.png|plate.png;
-- original.jpg is NEVER shared — 20260804200000). Three read paths.
--
-- DELIBERATE DEVIATION from the architecture doc's DDL sketch, same policy
-- semantics: the sketch inlined `exists (select … from public.items …)` in
-- each storage policy. A policy subquery executes as the CALLING user, so the
-- referenced tables' own RLS applies — and items/profiles/outfit_items/
-- event_outfit_posts are owner- or member-scoped, which would filter every
-- subquery to empty and make all three policies dead letters. This exact
-- mechanic is already documented in this repo: tests/03 asserts that a
-- stranger's storage-policy subquery "rightly finds no public item" ever
-- since the base-table public policies fell (20260804200000).
--
-- The house pattern for exactly this problem is a SECURITY DEFINER predicate
-- (is_friend, is_event_member — Migrations A/B). So each policy's row check
-- lives in one definer function whose body is the sketch's subquery, verbatim.
-- The path-shape checks stay inline in the policy.
-- ---------------------------------------------------------------------------

create function item_is_published(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.items i
     join public.profiles p on p.user_id = i.user_id
     where i.id = p_item
       and i.is_public and not i.is_archived and p.visibility = 'public');
$$;

create function item_owned_by_friend(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.items i
     where i.id = p_item
       and not i.is_archived
       and public.is_friend(i.user_id));
$$;

create function item_posted_to_my_event(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_outfit_posts ep
     join public.outfit_items oi on oi.outfit_id = ep.outfit_id
     where oi.item_id = p_item
       and public.is_event_member(ep.event_id));
$$;

-- Storage policies evaluate with the caller's privileges, so authenticated
-- needs EXECUTE (the is_friend reasoning, again).
revoke execute on function item_is_published(uuid)        from public, anon, authenticated;
revoke execute on function item_owned_by_friend(uuid)     from public, anon, authenticated;
revoke execute on function item_posted_to_my_event(uuid)  from public, anon, authenticated;
grant execute on function item_is_published(uuid)         to authenticated;
grant execute on function item_owned_by_friend(uuid)      to authenticated;
grant execute on function item_posted_to_my_event(uuid)   to authenticated;

create policy "garments: public derivatives readable when signed in" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garments'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and storage.filename(name) in ('thumb.jpg', 'cutout.png', 'plate.png')
    and public.item_is_published(((storage.foldername(name))[2])::uuid));

create policy "garments: friends read derivatives" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garments'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and storage.filename(name) in ('thumb.jpg', 'cutout.png', 'plate.png')
    and public.item_owned_by_friend(((storage.foldername(name))[2])::uuid));

create policy "garments: event co-members read posted derivatives" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garments'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and storage.filename(name) in ('thumb.jpg', 'cutout.png', 'plate.png')
    and public.item_posted_to_my_event(((storage.foldername(name))[2])::uuid));

-- ---------------------------------------------------------------------------
-- Realtime. Only the two tables an open event screen must see move live.
-- Postgres Changes runs each subscriber's RLS, so members-only stays
-- members-only over the socket too. (event_members deliberately NOT published
-- for MVP — architecture.md §5.)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table event_outfit_votes, event_comments;

-- ---------------------------------------------------------------------------
-- Rate limits (architecture.md §6). One trigger per write surface, counting
-- recent rows — no counter table needed at this scale; the policy indexes
-- above cover the counting queries. These are abuse controls in the plans.ts
-- sense: set well above honest usage, errcode 54000 so the client can say
-- "slow down" rather than "upgrade".
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

-- ---------------------------------------------------------------------------
-- Tier gating: hosting is the only social act with real fan-out cost.
-- The client copy of these numbers lives next to PLAN_ITEM_LIMITS in
-- src/features/billing/plans.ts — change one, change the other (the pgTAP
-- suite and tests/plans.test.ts are the tripwires).
-- ---------------------------------------------------------------------------
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
-- enforce_event_limit calls effective_plan() inside a SECURITY DEFINER
-- function, so the caller needs no EXECUTE on effective_plan — the existing
-- service-role-only grant on it is untouched.
revoke execute on function event_limit_for_plan(subscription_plan) from public, anon, authenticated;
revoke execute on function enforce_event_limit() from public, anon, authenticated;
create trigger events_enforce_limit before insert on events
  for each row execute function enforce_event_limit();
