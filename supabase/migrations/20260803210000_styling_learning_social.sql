-- Cinch — styling engine, preference learning, shopping, and public closets.
--
-- Three product surfaces land here at once because they share a spine: the
-- feature vector the styling engine produces. Outfit ranking consumes it,
-- preference learning updates against it, and the shopping engine inverts it
-- ("what item would score well with what you already own"). Splitting them
-- across migrations would mean three incompatible notions of taste.
--
-- Same RLS conventions as the initial schema: `(select auth.uid())` subselects,
-- an index on every policy column, `to authenticated`, one policy per command.
-- Public-read policies are new here and are called out individually, since they
-- are the only paths in the system where one user reads another's rows.

-- ---------------------------------------------------------------------------
-- items — columns the styling rules need
-- ---------------------------------------------------------------------------

create type garment_fit as enum ('fitted', 'regular', 'relaxed', 'oversized');
create type pattern_scale as enum ('none', 'micro', 'small', 'medium', 'large');

alter table items
  -- Drives the volume-balance rule. Inferred from subcategory text for items
  -- tagged before this shipped; the tagging model supplies it directly now.
  add column fit             garment_fit,
  add column pattern_scale   pattern_scale,
  -- Cached OKLCH for the dominant colours: [{L, C, h, neutrality, family}].
  -- Written on-device after pixel sampling so the Edge Function and any future
  -- SQL-side filtering read the same numbers the client scored with, rather
  -- than re-deriving them and drifting.
  add column color_analysis  jsonb,
  add column size            text,
  add column condition       text,
  -- Social surface. Both flags are required for a row to be world-readable:
  -- the item must opt in AND the profile must be public.
  add column is_public       boolean not null default false,
  add column sale_price      numeric(10, 2),
  add column sale_note       text;

create index items_public_idx on items (user_id, created_at desc)
  where is_public and not is_archived;

-- ---------------------------------------------------------------------------
-- style_profiles — the learned model, one row per user
--
-- Deliberately separate from `profiles`: this row is rewritten on every single
-- like, dislike and wear, while `profiles` is read on nearly every screen.
-- Keeping the hot-write data out of the hot-read row avoids needless bloat and
-- autovacuum churn on the table that can least afford it.
-- ---------------------------------------------------------------------------

create table style_profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,

  -- FeatureKey -> weight. Absent keys fall back to DEFAULT_WEIGHTS in TS, so a
  -- new feature can ship without a backfill.
  weights        jsonb   not null default '{}'::jsonb,

  -- {colorPairs, slotPairs, items, brands}, each a sparse map to -1..1.
  affinities     jsonb   not null default '{}'::jsonb,

  -- Drives UI honesty: below ~8 reactions the engine has learned almost
  -- nothing, and the app should say so rather than implying deep personalisation.
  feedback_count integer not null default 0,

  -- Cached output of describeWeights(), shown on the profile screen and
  -- injected into the stylist prompt.
  summary        text[]  not null default '{}',

  updated_at     timestamptz not null default now()
);

alter table style_profiles enable row level security;

create policy "style_profiles: owner can select" on style_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "style_profiles: owner can insert" on style_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "style_profiles: owner can update" on style_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "style_profiles: owner can delete" on style_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- outfit_reactions — the training signal
-- ---------------------------------------------------------------------------

create table outfit_reactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  outfit_id  uuid references outfits (id) on delete set null,

  -- Denormalised so a reaction survives the outfit being deleted. The training
  -- corpus must outlive any individual generated suggestion.
  item_ids   uuid[] not null default '{}',

  reaction   smallint not null check (reaction in (-1, 1)),
  reason     text,

  -- The feature vector at decision time, and the mean across the candidates it
  -- was shown beside.
  --
  -- Storing BOTH is what makes the signal learnable. If every option on screen
  -- scored 0.9 on weather, the fact that the chosen one also scored 0.9 says
  -- nothing about whether this person cares about weather — only the features
  -- where the pick DIFFERED from its alternatives carry information. Keeping
  -- the baseline also lets the whole model be replayed from scratch when the
  -- learning rule changes, instead of being frozen at whatever it was.
  features   jsonb not null default '{}'::jsonb,
  baseline   jsonb not null default '{}'::jsonb,

  -- 'today' | 'chat' | 'shuffle' | 'onboarding_quiz'
  source     text not null default 'today',
  created_at timestamptz not null default now()
);

create index outfit_reactions_user_id_idx on outfit_reactions using btree (user_id);
create index outfit_reactions_user_created_idx on outfit_reactions (user_id, created_at desc);

alter table outfit_reactions enable row level security;

create policy "outfit_reactions: owner can select" on outfit_reactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "outfit_reactions: owner can insert" on outfit_reactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "outfit_reactions: owner can delete" on outfit_reactions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- wardrobe_gaps + wishlist — the shopping engine
--
-- A gap is not "you own no yellow". It is a specific missing piece whose
-- addition would unlock the most new high-scoring outfits from clothes already
-- owned, priced in the band the user actually shops in. Recommending purchases
-- on any other basis is how styling apps turn into affiliate spam.
-- ---------------------------------------------------------------------------

create table wardrobe_gaps (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,

  category       item_category not null,
  subcategory    text,
  -- Target attributes, as the styling engine would score them.
  target_colors  jsonb not null default '[]'::jsonb,
  target_formality smallint check (target_formality between 1 and 5),
  target_warmth    smallint check (target_warmth between 1 and 5),

  -- How many additional outfits scoring above threshold this would unlock, and
  -- the mean score of those outfits. Both are computed by simulating the item
  -- into the closet and re-running generation.
  outfits_unlocked integer not null default 0,
  mean_score       numeric(4, 3),

  -- Derived from the percentiles of what the user has actually paid.
  price_low      numeric(10, 2),
  price_high     numeric(10, 2),

  rationale      text,
  dismissed      boolean not null default false,
  computed_at    timestamptz not null default now()
);

create index wardrobe_gaps_user_id_idx on wardrobe_gaps using btree (user_id);
create index wardrobe_gaps_user_rank_idx on wardrobe_gaps (user_id, outfits_unlocked desc)
  where not dismissed;

alter table wardrobe_gaps enable row level security;

create policy "wardrobe_gaps: owner can select" on wardrobe_gaps
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "wardrobe_gaps: owner can insert" on wardrobe_gaps
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "wardrobe_gaps: owner can update" on wardrobe_gaps
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "wardrobe_gaps: owner can delete" on wardrobe_gaps
  for delete to authenticated using ((select auth.uid()) = user_id);

create table wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  gap_id      uuid references wardrobe_gaps (id) on delete set null,

  title       text not null,
  brand       text,
  price       numeric(10, 2),
  currency    text not null default 'USD',
  url         text,
  image_url   text,
  merchant    text,

  -- Snapshot of how this scored against the closet when it was saved, so the
  -- list stays explicable later.
  fit_score   numeric(4, 3),
  rationale   text,

  purchased   boolean not null default false,
  -- Set when a purchased wishlist entry becomes a real closet item.
  item_id     uuid references items (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index wishlist_items_user_id_idx on wishlist_items using btree (user_id);

alter table wishlist_items enable row level security;

create policy "wishlist_items: owner can select" on wishlist_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "wishlist_items: owner can insert" on wishlist_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "wishlist_items: owner can update" on wishlist_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "wishlist_items: owner can delete" on wishlist_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Public closets
-- ---------------------------------------------------------------------------

create type profile_visibility as enum ('private', 'public');

alter table profiles
  add column username        text,
  add column bio             text,
  add column visibility      profile_visibility not null default 'private',
  add column follower_count  integer not null default 0,
  add column following_count integer not null default 0;

-- Case-insensitive uniqueness without requiring the citext extension.
create unique index profiles_username_key on profiles (lower(username))
  where username is not null;

-- Usernames are public identifiers, so the constraint is a product decision as
-- much as a technical one: 3-20 chars, alphanumeric plus underscore.
alter table profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-zA-Z0-9_]{3,20}$');

alter table outfits add column is_public boolean not null default false;
create index outfits_public_idx on outfits (user_id, created_at desc) where is_public;

-- Public read on profiles.
--
-- Exposes only what a public profile is for. The private columns on this table
-- (sizes, home_city, colour season, consent timestamps) are NOT protected by
-- this policy — RLS is row-level, not column-level — so the client must select
-- an explicit column list. `public_profiles` below is that list, and is what
-- the app actually reads.
create policy "profiles: public are readable" on profiles
  for select to anon, authenticated
  using (visibility = 'public');

create view public_profiles
with (security_invoker = true) as
  select user_id, username, display_name, avatar_url, bio, style_tags,
         follower_count, following_count, created_at
    from profiles
   where visibility = 'public';

-- Public read on items: the item must opt in AND its owner must be public.
create policy "items: public are readable" on items
  for select to anon, authenticated
  using (
    is_public
    and not is_archived
    and exists (
      select 1 from profiles p
       where p.user_id = items.user_id and p.visibility = 'public'
    )
  );

create policy "outfits: public are readable" on outfits
  for select to anon, authenticated
  using (
    is_public
    and exists (
      select 1 from profiles p
       where p.user_id = outfits.user_id and p.visibility = 'public'
    )
  );

-- outfit_items carries no content of its own, but it reveals which items form
-- a look — so it inherits the outfit's visibility rather than being open.
create policy "outfit_items: public are readable" on outfit_items
  for select to anon, authenticated
  using (
    exists (
      select 1 from outfits o
       join profiles p on p.user_id = o.user_id
       where o.id = outfit_items.outfit_id
         and o.is_public
         and p.visibility = 'public'
    )
  );

create table follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id)
);

create index follows_followee_idx on follows using btree (followee_id);

alter table follows enable row level security;

-- Follows are public information on a public profile — that is what makes a
-- follower list viewable at all.
create policy "follows: readable" on follows
  for select to anon, authenticated using (true);
create policy "follows: own can insert" on follows
  for insert to authenticated with check ((select auth.uid()) = follower_id);
create policy "follows: own can delete" on follows
  for delete to authenticated using ((select auth.uid()) = follower_id);

create table closet_likes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  item_id    uuid references items (id) on delete cascade,
  outfit_id  uuid references outfits (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Exactly one target.
  constraint closet_likes_one_target check (num_nonnulls(item_id, outfit_id) = 1)
);

create unique index closet_likes_item_key   on closet_likes (user_id, item_id)   where item_id   is not null;
create unique index closet_likes_outfit_key on closet_likes (user_id, outfit_id) where outfit_id is not null;
create index closet_likes_item_idx   on closet_likes (item_id);
create index closet_likes_outfit_idx on closet_likes (outfit_id);

alter table closet_likes enable row level security;

create policy "closet_likes: readable" on closet_likes
  for select to anon, authenticated using (true);
create policy "closet_likes: own can insert" on closet_likes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "closet_likes: own can delete" on closet_likes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- "Is this for sale?" — an inquiry, not a transaction.
--
-- Cinch deliberately does not process payments here. Taking a cut of a
-- peer-to-peer clothing sale inside an iOS app drags in Guideline 3.1.1 and a
-- payments stack; connecting two people who then settle it themselves does not.
create table item_inquiries (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references items (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  inquirer_id uuid not null references auth.users (id) on delete cascade,
  message     text,
  status      text not null default 'open' check (status in ('open', 'accepted', 'declined', 'closed')),
  created_at  timestamptz not null default now(),
  constraint item_inquiries_no_self check (owner_id <> inquirer_id)
);

create index item_inquiries_owner_idx    on item_inquiries using btree (owner_id);
create index item_inquiries_inquirer_idx on item_inquiries using btree (inquirer_id);

alter table item_inquiries enable row level security;

-- Both sides of the conversation can read it; nobody else can.
create policy "item_inquiries: participants can select" on item_inquiries
  for select to authenticated
  using ((select auth.uid()) in (owner_id, inquirer_id));
create policy "item_inquiries: inquirer can insert" on item_inquiries
  for insert to authenticated with check ((select auth.uid()) = inquirer_id);
create policy "item_inquiries: owner can update" on item_inquiries
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- Storage: public garment images
--
-- Table RLS says nothing about the bucket. Objects are keyed
-- {user_id}/{item_id}/{file}, so publicity is resolved by reading the item id
-- out of the second path segment and checking the row. This keeps the bucket
-- private by default while letting exactly the opted-in images be served.
-- ---------------------------------------------------------------------------

create policy "garments: public items are readable" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'garments'
    and array_length(storage.foldername(name), 1) >= 2
    -- Guard the cast: a malformed path must not raise, or every listing fails.
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and exists (
      select 1 from public.items i
       join public.profiles p on p.user_id = i.user_id
       where i.id = ((storage.foldername(name))[2])::uuid
         and i.is_public
         and not i.is_archived
         and p.visibility = 'public'
    )
  );

-- ---------------------------------------------------------------------------
-- Counter maintenance
-- ---------------------------------------------------------------------------

create or replace function sync_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where user_id = new.follower_id;
    update public.profiles set follower_count  = follower_count  + 1 where user_id = new.followee_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set following_count = greatest(0, following_count - 1) where user_id = old.follower_id;
    update public.profiles set follower_count  = greatest(0, follower_count  - 1) where user_id = old.followee_id;
  end if;
  return null;
end;
$$;

create trigger follows_sync_counts
  after insert or delete on follows
  for each row execute function sync_follow_counts();

create trigger style_profiles_set_updated_at
  before update on style_profiles
  for each row execute function set_updated_at();

-- A style profile for every user, same reasoning as the profiles trigger: the
-- app should never have to branch on "the row might not exist yet".
create or replace function handle_new_style_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.style_profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_style
  after insert on auth.users
  for each row execute function handle_new_style_profile();

-- Backfill for users who signed up before this migration.
insert into style_profiles (user_id)
select user_id from profiles
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Atomic reaction write
--
-- The reaction row and the updated model must land together. Two round trips
-- would let a dropped connection between them leave the model reflecting a
-- reaction that was never recorded — unfixable later, because the reaction is
-- the only evidence the update ever happened.
-- ---------------------------------------------------------------------------

create or replace function apply_outfit_reaction(
  p_outfit_id  uuid,
  p_item_ids   uuid[],
  p_reaction   smallint,
  p_features   jsonb,
  p_baseline   jsonb,
  p_weights    jsonb,
  p_affinities jsonb,
  p_summary    text[],
  p_reason     text default null,
  p_source     text default 'today'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.outfit_reactions
    (user_id, outfit_id, item_ids, reaction, reason, features, baseline, source)
  values
    (v_user, p_outfit_id, p_item_ids, p_reaction, p_reason, p_features, p_baseline, p_source);

  insert into public.style_profiles (user_id, weights, affinities, summary, feedback_count)
  values (v_user, p_weights, p_affinities, p_summary, 1)
  on conflict (user_id) do update
    set weights        = excluded.weights,
        affinities     = excluded.affinities,
        summary        = excluded.summary,
        feedback_count = public.style_profiles.feedback_count + 1;
end;
$$;
