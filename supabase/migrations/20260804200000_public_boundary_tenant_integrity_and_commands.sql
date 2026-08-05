-- ---------------------------------------------------------------------------
-- Public boundary, tenant integrity, and transactional commands
--
-- Remediates CIN-01 (public RLS exposed private columns and original photos),
-- CIN-04 (no server-side AI quota), CIN-05 (non-atomic, non-idempotent wear and
-- plan writes), and CIN-08 (junction rows could reference other tenants' rows).
--
-- The through-line: authorization was being asked to do jobs it cannot do.
-- Row-level security cannot hide a column, a client convention cannot be an
-- authorization boundary, and three sequential client writes cannot be atomic.
-- Each section below moves one of those jobs to something that can actually
-- hold it — a projection view, a composite foreign key, a transaction.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- 1. The public boundary  (CIN-01, Critical)
--
-- The previous design put a `visibility = 'public'` SELECT policy on the BASE
-- tables and relied on the client selecting a narrow column list. RLS filters
-- rows, not columns, so anon could ask `profiles` for `sizes`, `home_city`,
-- and `ai_consent_at` directly and be served them. The safe view existed but
-- nothing revoked the base table underneath it.
--
-- The fix inverts it: base tables become private to their owner, full stop,
-- and everything public is served through explicit projection views that
-- physically cannot return a column they do not name.
-- ===========================================================================

drop policy if exists "profiles: public are readable"     on profiles;
drop policy if exists "items: public are readable"        on items;
drop policy if exists "outfits: public are readable"      on outfits;
drop policy if exists "outfit_items: public are readable" on outfit_items;

-- Defence in depth. Even with no policy granting them rows, `anon` should not
-- hold a table-level privilege on tables that carry private columns — Supabase
-- grants these wholesale at project creation, so they must be taken back
-- explicitly.
revoke all on profiles     from anon;
revoke all on items        from anon;
revoke all on outfits      from anon;
revoke all on outfit_items from anon;

-- The projection views.
--
-- These are deliberately SECURITY DEFINER (the PostgreSQL default for views,
-- spelled out here because it is load-bearing rather than incidental): the view
-- runs as its owner and therefore sees past the owner-only policies above. That
-- is precisely why the visibility predicate must live INSIDE each view. A view
-- that forgot its WHERE clause here would publish the whole table.
drop view if exists public_profiles;
create view public_profiles
with (security_invoker = false) as
  select user_id, username, display_name, avatar_url, bio, style_tags,
         follower_count, following_count, created_at
    from profiles
   where visibility = 'public';

-- Garment presentation only. No purchase price, no purchase date, no wear
-- history, no raw ai_tags, and no image_path — the original photograph is not
-- part of what "public closet" means.
create view public_items
with (security_invoker = false) as
  select i.id, i.user_id, i.category, i.subcategory, i.colors, i.pattern,
         i.material, i.brand, i.seasons, i.occasions, i.description,
         i.is_for_sale, i.thumb_path, i.cutout_path, i.created_at
    from items i
    join profiles p on p.user_id = i.user_id
   where i.is_public
     and not i.is_archived
     and p.visibility = 'public';

create view public_outfits
with (security_invoker = false) as
  select o.id, o.user_id, o.name, o.occasion, o.created_at
    from outfits o
    join profiles p on p.user_id = o.user_id
   where o.is_public
     and p.visibility = 'public';

create view public_outfit_items
with (security_invoker = false) as
  select oi.outfit_id, oi.item_id, oi.role, oi.position
    from outfit_items oi
    join outfits o  on o.id = oi.outfit_id
    join profiles p on p.user_id = o.user_id
   where o.is_public
     and p.visibility = 'public';

grant select on public_profiles, public_items, public_outfits, public_outfit_items
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The social graph is not public data either.
--
-- `follows` and `closet_likes` were readable by anon with `using (true)` —
-- every row, including the user ids of everyone who liked anything. Only the
-- COUNTS were ever wanted. Profiles already carry denormalised follower and
-- following counts (exposed by public_profiles above), so the raw edge table
-- needs no public read at all.
-- ---------------------------------------------------------------------------

drop policy if exists "follows: readable"      on follows;
drop policy if exists "closet_likes: readable" on closet_likes;

-- You can see the edges you are party to; nobody enumerates the graph.
create policy "follows: participants can select" on follows
  for select to authenticated
  using ((select auth.uid()) in (follower_id, followee_id));

create policy "closet_likes: own can select" on closet_likes
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on follows      from anon;
revoke all on closet_likes from anon;

-- Aggregates, which is all the UI ever needed.
create view public_like_counts
with (security_invoker = false) as
  select item_id, outfit_id, count(*)::bigint as likes
    from closet_likes
   group by item_id, outfit_id;

grant select on public_like_counts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: publish derivatives, never originals.
--
-- The old policy authorized ANY object under an opted-in item folder. Objects
-- are keyed {user_id}/{item_id}/{file} and the writer uploads original.jpg,
-- thumb.jpg, and cutout.png — so "public closet" was also publishing the
-- original photograph, which is the frame that includes the room it was taken
-- in. Only the two derived, cropped renditions are publishable.
-- ---------------------------------------------------------------------------

drop policy if exists "garments: public items are readable" on storage.objects;

create policy "garments: published derivatives are readable" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'garments'
    and array_length(storage.foldername(name), 1) >= 2
    -- Guard the cast: a malformed path must not raise, or every listing fails.
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and storage.filename(name) in ('thumb.jpg', 'cutout.png')
    and exists (
      select 1 from public.items i
       join public.profiles p on p.user_id = i.user_id
       where i.id = ((storage.foldername(name))[2])::uuid
         and i.is_public
         and not i.is_archived
         and p.visibility = 'public'
    )
  );


-- ===========================================================================
-- 2. Tenant integrity  (CIN-08, High)
--
-- Every junction policy validated only the row's own `user_id` — never that
-- the rows it POINTS AT belong to that user. An authenticated user could
-- therefore attach someone else's public item to their own outfit, or file an
-- inquiry naming an arbitrary owner. Public ids are discoverable by design, so
-- this was reachable rather than theoretical.
--
-- Composite foreign keys are the fix wherever the referenced row must belong
-- to the same user: `(item_id, user_id) -> items (id, user_id)` is impossible
-- to satisfy across tenants, and the database enforces it without a policy
-- having to remember to.
-- ===========================================================================

-- Referencable composite keys. These are additional unique constraints; the
-- primary keys are untouched.
alter table items          add constraint items_id_user_key          unique (id, user_id);
alter table outfits        add constraint outfits_id_user_key        unique (id, user_id);
alter table wardrobe_gaps  add constraint wardrobe_gaps_id_user_key  unique (id, user_id);

-- Repair before constrain.
--
-- Adding these constraints against pre-existing bad rows would abort the
-- migration, so any row that already violates tenancy is removed first. In a
-- correct history these delete nothing; they exist so that deployment is not
-- gambling on that being true.
delete from outfit_items oi
 where not exists (select 1 from outfits o where o.id = oi.outfit_id and o.user_id = oi.user_id)
    or not exists (select 1 from items   i where i.id = oi.item_id   and i.user_id = oi.user_id);

delete from style_feedback sf
 where (sf.outfit_id is not null
        and not exists (select 1 from outfits o where o.id = sf.outfit_id and o.user_id = sf.user_id))
    or (sf.item_id is not null
        and not exists (select 1 from items i where i.id = sf.item_id and i.user_id = sf.user_id));

delete from outfit_calendar c
 where c.outfit_id is not null
   and not exists (select 1 from outfits o where o.id = c.outfit_id and o.user_id = c.user_id);

delete from outfit_reactions r
 where r.outfit_id is not null
   and not exists (select 1 from outfits o where o.id = r.outfit_id and o.user_id = r.user_id);

delete from wishlist_items w
 where (w.item_id is not null
        and not exists (select 1 from items i where i.id = w.item_id and i.user_id = w.user_id))
    or (w.gap_id is not null
        and not exists (select 1 from wardrobe_gaps g where g.id = w.gap_id and g.user_id = w.user_id));

-- Now the constraints. MATCH SIMPLE (the default) means a NULL in any column
-- of the pair skips the check, which is exactly right for the nullable
-- references below: "no outfit recorded" stays legal, "someone else's outfit"
-- does not.
alter table outfit_items
  add constraint outfit_items_outfit_same_user
    foreign key (outfit_id, user_id) references outfits (id, user_id) on delete cascade,
  add constraint outfit_items_item_same_user
    foreign key (item_id, user_id) references items (id, user_id) on delete cascade;

alter table style_feedback
  add constraint style_feedback_outfit_same_user
    foreign key (outfit_id, user_id) references outfits (id, user_id) on delete set null,
  add constraint style_feedback_item_same_user
    foreign key (item_id, user_id) references items (id, user_id) on delete set null;

alter table outfit_calendar
  add constraint outfit_calendar_outfit_same_user
    foreign key (outfit_id, user_id) references outfits (id, user_id) on delete set null;

alter table outfit_reactions
  add constraint outfit_reactions_outfit_same_user
    foreign key (outfit_id, user_id) references outfits (id, user_id) on delete set null;

alter table wishlist_items
  add constraint wishlist_items_item_same_user
    foreign key (item_id, user_id) references items (id, user_id) on delete set null,
  add constraint wishlist_items_gap_same_user
    foreign key (gap_id, user_id) references wardrobe_gaps (id, user_id) on delete set null;

-- ---------------------------------------------------------------------------
-- Likes and inquiries point at OTHER people's rows on purpose, so a composite
-- key cannot express their rule. Theirs is "the target must actually be
-- published", which needs a trigger.
-- ---------------------------------------------------------------------------

create or replace function assert_like_target_is_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.item_id is not null and not exists (
    select 1 from public.items i
     join public.profiles p on p.user_id = i.user_id
     where i.id = new.item_id and i.is_public and not i.is_archived
       and p.visibility = 'public'
  ) then
    raise exception 'that item is not public' using errcode = '42501';
  end if;

  if new.outfit_id is not null and not exists (
    select 1 from public.outfits o
     join public.profiles p on p.user_id = o.user_id
     where o.id = new.outfit_id and o.is_public and p.visibility = 'public'
  ) then
    raise exception 'that outfit is not public' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger closet_likes_target_must_be_public
  before insert or update on closet_likes
  for each row execute function assert_like_target_is_public();

-- Inquiries: derive the owner from the item rather than trusting the caller,
-- and require the item to be genuinely listed. Previously a user could file an
-- inquiry naming any owner for any item, which surfaces in that owner's inbox.
create or replace function assert_inquiry_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select i.user_id into v_owner
    from public.items i
    join public.profiles p on p.user_id = i.user_id
   where i.id = new.item_id
     and i.is_public
     and i.is_for_sale
     and not i.is_archived
     and p.visibility = 'public';

  if v_owner is null then
    raise exception 'that item is not listed for sale' using errcode = '42501';
  end if;

  -- Authoritative, not advisory: whatever the client sent is replaced.
  new.owner_id := v_owner;

  if new.owner_id = new.inquirer_id then
    raise exception 'you cannot enquire about your own item' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger item_inquiries_target_must_be_listed
  before insert on item_inquiries
  for each row execute function assert_inquiry_target();

-- ---------------------------------------------------------------------------
-- `unique (user_id, planned_date, outfit_id)` does not constrain note-only
-- rows, because PostgreSQL treats every NULL as distinct — so the same day
-- could collect unlimited duplicate notes the moment that path is used.
-- ---------------------------------------------------------------------------
create unique index outfit_calendar_note_only_key
  on outfit_calendar (user_id, planned_date)
  where outfit_id is null;


-- ===========================================================================
-- 3. Transactional, idempotent commands  (CIN-05, High)
--
-- Wearing an outfit was three independent client writes: insert the outfit,
-- insert its items, call log_outfit_wear. Losing signal between any two left
-- an empty outfit, an uncounted wear, or a plan with no calendar row — and the
-- retry made a SECOND outfit, while a retried wear double-incremented every
-- item's wear_count, quietly corrupting cost-per-wear and freshness scoring.
--
-- Both flows collapse into one function each, which is one transaction, keyed
-- by a client-generated operation id so a retry returns the original result
-- instead of doing the work twice.
-- ===========================================================================

create table command_log (
  op_id      uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  result_id  uuid,
  claimed_at timestamptz not null default now()
);

create index command_log_user_idx on command_log using btree (user_id);

alter table command_log enable row level security;

create policy "command_log: owner can select" on command_log
  for select to authenticated using ((select auth.uid()) = user_id);

/**
 * Claim an operation id, or discover it was already claimed.
 *
 * `on conflict do update` rather than `do nothing` is deliberate: the update
 * takes a row lock, so two concurrent submissions of the same operation id
 * serialise instead of both seeing "no existing row" and both doing the work.
 */
create or replace function claim_command(p_op_id uuid, p_user_id uuid, p_kind text)
returns table (already_done boolean, existing_result uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner  uuid;
  v_result uuid;
begin
  insert into public.command_log (op_id, user_id, kind)
  values (p_op_id, p_user_id, p_kind)
  on conflict (op_id) do update set claimed_at = public.command_log.claimed_at
  returning user_id, result_id into v_owner, v_result;

  if v_owner <> p_user_id then
    raise exception 'operation id belongs to another user' using errcode = '42501';
  end if;

  -- result_id is NULL on a fresh claim and set once the work commits, so a
  -- non-null value is proof the original attempt finished.
  return query select v_result is not null, v_result;
end;
$$;

/**
 * Wear an outfit: create it, attach its garments, count the wears — atomically.
 *
 * SECURITY INVOKER on purpose. Every write inside still passes through RLS as
 * the calling user, so this function grants no authority the caller did not
 * already have; it only makes the sequence atomic. The composite foreign keys
 * added above are what stop another tenant's item being attached, and the
 * explicit ownership check below exists to turn that constraint violation into
 * a sentence a human can read.
 */
create or replace function wear_outfit_tx(
  p_op_id     uuid,
  p_item_ids  uuid[],
  p_name      text          default null,
  p_reasoning text          default null,
  p_context   jsonb         default null,
  p_source    outfit_source default 'ai'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_outfit uuid;
  v_done   boolean;
  v_prior  uuid;
  v_owned  integer;
  v_asked  integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_op_id is null then
    raise exception 'an operation id is required' using errcode = '22004';
  end if;
  if coalesce(array_length(p_item_ids, 1), 0) = 0 then
    raise exception 'an outfit needs at least one item' using errcode = '22004';
  end if;

  select already_done, existing_result into v_done, v_prior
    from public.claim_command(p_op_id, v_user, 'wear_outfit');
  if v_done then
    return v_prior;
  end if;

  select count(distinct x) into v_asked from unnest(p_item_ids) x;
  select count(*) into v_owned
    from public.items where id = any(p_item_ids) and user_id = v_user;
  if v_owned <> v_asked then
    raise exception 'one or more of those items is not yours' using errcode = '42501';
  end if;

  insert into public.outfits (user_id, name, reasoning, context_snapshot, generated_by, worn_at)
  values (v_user, p_name, p_reasoning, p_context, p_source, now())
  returning id into v_outfit;

  insert into public.outfit_items (outfit_id, item_id, user_id, position)
  select v_outfit, x.id, v_user, x.ord
    from unnest(p_item_ids) with ordinality as x(id, ord);

  update public.items
     set wear_count   = wear_count + 1,
         last_worn_at = now()
   where id = any(p_item_ids)
     and user_id = v_user;

  update public.command_log set result_id = v_outfit where op_id = p_op_id;

  return v_outfit;
end;
$$;

/** Plan an outfit onto a date. Same contract as wear, minus the wear counting. */
create or replace function plan_outfit_tx(
  p_op_id        uuid,
  p_item_ids     uuid[],
  p_planned_date date,
  p_name         text default null,
  p_note         text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_outfit uuid;
  v_done   boolean;
  v_prior  uuid;
  v_owned  integer;
  v_asked  integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_op_id is null then
    raise exception 'an operation id is required' using errcode = '22004';
  end if;
  if p_planned_date is null then
    raise exception 'a date is required' using errcode = '22004';
  end if;
  if coalesce(array_length(p_item_ids, 1), 0) = 0 then
    raise exception 'an outfit needs at least one item' using errcode = '22004';
  end if;

  select already_done, existing_result into v_done, v_prior
    from public.claim_command(p_op_id, v_user, 'plan_outfit');
  if v_done then
    return v_prior;
  end if;

  select count(distinct x) into v_asked from unnest(p_item_ids) x;
  select count(*) into v_owned
    from public.items where id = any(p_item_ids) and user_id = v_user;
  if v_owned <> v_asked then
    raise exception 'one or more of those items is not yours' using errcode = '42501';
  end if;

  insert into public.outfits (user_id, name, generated_by)
  values (v_user, p_name, 'ai')
  returning id into v_outfit;

  insert into public.outfit_items (outfit_id, item_id, user_id, position)
  select v_outfit, x.id, v_user, x.ord
    from unnest(p_item_ids) with ordinality as x(id, ord);

  -- Re-planning the same day replaces the plan rather than stacking onto it.
  insert into public.outfit_calendar (user_id, outfit_id, planned_date, note)
  values (v_user, v_outfit, p_planned_date, p_note)
  on conflict (user_id, planned_date, outfit_id) do update set note = excluded.note;

  update public.command_log set result_id = v_outfit where op_id = p_op_id;

  return v_outfit;
end;
$$;

-- log_outfit_wear is superseded by wear_outfit_tx. It is left in place so an
-- older installed build does not start erroring mid-rollout, but it is no
-- longer the supported path — it can neither be made idempotent nor made
-- atomic with the inserts that must accompany it.
comment on function log_outfit_wear(uuid) is
  'Deprecated: use wear_outfit_tx, which is atomic and idempotent. Kept only for older clients still in the field.';


-- ===========================================================================
-- 4. Server-side AI quota  (CIN-04, High)
--
-- The three AI functions required a signed-in user and nothing else. Any
-- account could call them in a loop; the UI's own throttling is not a billing
-- control. This is the ceiling the Edge Functions consult BEFORE they call the
-- provider, so an abusive caller costs a database row rather than a model call.
-- ===========================================================================

create table ai_usage_counters (
  user_id uuid    not null references auth.users (id) on delete cascade,
  day     date    not null default current_date,
  kind    text    not null,
  calls   integer not null default 0,
  primary key (user_id, day, kind)
);

alter table ai_usage_counters enable row level security;

-- Readable by the owner so the app can show "you have used N of M today".
-- Writes happen only through the function below, under the service role.
create policy "ai_usage_counters: owner can select" on ai_usage_counters
  for select to authenticated using ((select auth.uid()) = user_id);

/**
 * Atomically consume one unit of a user's daily allowance.
 *
 * The whole decision is one statement: the conditional `do update` increments
 * only while the user is under the limit, so the RETURNING clause comes back
 * empty exactly when they are over it. Two concurrent calls cannot both see
 * "one left" and both proceed, which a read-then-write check would allow.
 */
create or replace function claim_ai_quota(
  p_user_id     uuid,
  p_kind        text,
  p_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calls integer;
  v_used  integer;
begin
  insert into public.ai_usage_counters (user_id, day, kind, calls)
  values (p_user_id, current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update
    set calls = public.ai_usage_counters.calls + 1
    where public.ai_usage_counters.calls < p_daily_limit
  returning calls into v_calls;

  if v_calls is not null then
    return jsonb_build_object('allowed', true, 'used', v_calls, 'limit', p_daily_limit);
  end if;

  select calls into v_used
    from public.ai_usage_counters
   where user_id = p_user_id and day = current_date and kind = p_kind;

  return jsonb_build_object('allowed', false, 'used', coalesce(v_used, 0), 'limit', p_daily_limit);
end;
$$;

-- Only the Edge Functions (service role) may spend quota. A client that could
-- call this directly could also drain its own allowance, or worse, someone
-- else's — the function takes the user id as an argument by necessity.
revoke all on function claim_ai_quota(uuid, text, integer) from public, anon, authenticated;
grant execute on function claim_ai_quota(uuid, text, integer) to service_role;


-- ===========================================================================
-- 5. Chat session ordering  (CIN-18)
--
-- chat_sessions.updated_at had a trigger for direct updates, but inserting a
-- MESSAGE never touched the session — so "most recent conversation" ordered by
-- a timestamp that stopped moving the moment the session was created.
-- ===========================================================================

create or replace function touch_chat_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_sessions
     set updated_at = now()
   where id = new.session_id;
  return new;
end;
$$;

create trigger chat_messages_touch_session
  after insert on chat_messages
  for each row execute function touch_chat_session();
