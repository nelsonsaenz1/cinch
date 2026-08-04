-- Cinch — initial schema
--
-- RLS conventions used throughout, all three load-bearing:
--   1. `(select auth.uid())` wrapped in a subselect, never bare `auth.uid()`.
--      The wrapper lets Postgres cache it as a per-statement initPlan instead of
--      re-evaluating per row (>100x on large tables).
--   2. A btree index on every column a policy filters on.
--   3. `to authenticated` on every policy, so anon short-circuits.
-- Separate policies per command — never `for all`.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type item_category as enum (
  'top', 'bottom', 'outerwear', 'footwear', 'dress',
  'accessory', 'bag', 'headwear', 'jewelry', 'other'
);

create type item_status as enum (
  'pending_upload',   -- row exists, media still uploading
  'pending_tag',      -- media uploaded, awaiting the tagging pass
  'tagged',           -- AI tags written
  'needs_review',     -- tagging failed; item is still usable
  'verified'          -- user confirmed or corrected the tags
);

create type outfit_source as enum ('ai', 'user');

create type feedback_action as enum ('accepted', 'rejected', 'edited', 'worn');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  display_name       text,
  avatar_url         text,
  gender_presentation text,
  style_tags         text[]      not null default '{}',
  color_season       text,
  sizes              jsonb       not null default '{}'::jsonb,
  home_city          text,
  units              text        not null default 'F' check (units in ('F', 'C')),
  -- Distilled from style_feedback on a schedule; injected into styling prompts.
  preference_summary text,
  preference_summary_updated_at timestamptz,
  onboarding_complete boolean    not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: owner can select" on profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles: owner can insert" on profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles: owner can update" on profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "profiles: owner can delete" on profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------

create table items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,

  -- Storage object paths, always prefixed {user_id}/{item_id}/ so the bucket
  -- policy below can authorize on the first path segment.
  image_path       text,          -- original
  cutout_path      text,          -- background-removed, transparent PNG
  thumb_path       text,          -- ~400px, generated on-device (Storage
                                  -- transforms are Pro-only and bill per origin image)

  status           item_status     not null default 'pending_upload',

  category         item_category   not null default 'other',
  subcategory      text,
  colors           jsonb           not null default '[]'::jsonb, -- [{hex, name}]
  pattern          text,
  material         text,
  brand            text,

  formality_score  smallint check (formality_score between 1 and 5),
  warmth_score     smallint check (warmth_score between 1 and 5),
  water_resistant  boolean         not null default false,

  seasons          text[]          not null default '{}',
  occasions        text[]          not null default '{}',
  description      text,

  purchase_price   numeric(10, 2),
  purchase_date    date,

  wear_count       integer         not null default 0 check (wear_count >= 0),
  last_worn_at     timestamptz,

  is_archived      boolean         not null default false,
  is_for_sale      boolean         not null default false,

  ai_tags          jsonb,          -- raw model output, kept for debugging + re-parsing
  user_verified    boolean         not null default false,

  created_at       timestamptz     not null default now(),
  updated_at       timestamptz     not null default now()
);

-- Policy column (rule 2).
create index items_user_id_idx on items using btree (user_id);
-- Grid queries: the closet screen filters archived and sorts by recency.
create index items_user_active_idx on items (user_id, created_at desc) where not is_archived;
-- The pending-tag sweep on app launch.
create index items_pending_tag_idx on items (user_id) where status in ('pending_tag', 'needs_review');
-- Array filters from the closet filter bar.
create index items_seasons_idx   on items using gin (seasons);
create index items_occasions_idx on items using gin (occasions);

alter table items enable row level security;

create policy "items: owner can select" on items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "items: owner can insert" on items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "items: owner can update" on items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "items: owner can delete" on items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- outfits
--
-- Deviation from the original spec, which had `item_ids[]` on the outfit row.
-- A junction table is used instead: item detail needs "which outfits does this
-- item appear in", which an array column can only answer with a full scan, and
-- the FK gives referential integrity when an item is deleted.
-- ---------------------------------------------------------------------------

create table outfits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text,
  occasion         text,
  generated_by     outfit_source not null default 'ai',
  -- Weather, events, and location as they were at generation time. Snapshotted
  -- so a saved outfit stays explicable months later.
  context_snapshot jsonb,
  reasoning        text,
  rating           smallint check (rating in (-1, 1)),
  rating_reason    text,
  worn_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index outfits_user_id_idx on outfits using btree (user_id);
create index outfits_user_created_idx on outfits (user_id, created_at desc);

alter table outfits enable row level security;

create policy "outfits: owner can select" on outfits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "outfits: owner can insert" on outfits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "outfits: owner can update" on outfits
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "outfits: owner can delete" on outfits
  for delete to authenticated using ((select auth.uid()) = user_id);

create table outfit_items (
  outfit_id uuid not null references outfits (id) on delete cascade,
  item_id   uuid not null references items (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  -- Multi-event days: an item may be the base look or the later swap.
  role      text not null default 'base' check (role in ('base', 'swap')),
  position  smallint not null default 0,
  primary key (outfit_id, item_id)
);

create index outfit_items_user_id_idx on outfit_items using btree (user_id);
create index outfit_items_item_id_idx on outfit_items using btree (item_id);

alter table outfit_items enable row level security;

create policy "outfit_items: owner can select" on outfit_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "outfit_items: owner can insert" on outfit_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "outfit_items: owner can update" on outfit_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "outfit_items: owner can delete" on outfit_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- outfit_calendar — planned outfits by date (week planner, packing)
-- ---------------------------------------------------------------------------

create table outfit_calendar (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  outfit_id    uuid references outfits (id) on delete set null,
  planned_date date not null,
  note         text,
  created_at   timestamptz not null default now(),
  unique (user_id, planned_date, outfit_id)
);

create index outfit_calendar_user_id_idx on outfit_calendar using btree (user_id);
create index outfit_calendar_user_date_idx on outfit_calendar (user_id, planned_date);

alter table outfit_calendar enable row level security;

create policy "outfit_calendar: owner can select" on outfit_calendar
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "outfit_calendar: owner can insert" on outfit_calendar
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "outfit_calendar: owner can update" on outfit_calendar
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "outfit_calendar: owner can delete" on outfit_calendar
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- chat
-- ---------------------------------------------------------------------------

create table chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_sessions_user_id_idx on chat_sessions using btree (user_id);

alter table chat_sessions enable row level security;

create policy "chat_sessions: owner can select" on chat_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "chat_sessions: owner can insert" on chat_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "chat_sessions: owner can update" on chat_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "chat_sessions: owner can delete" on chat_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

create table chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  -- Full content-block array, so tool_use / tool_result blocks round-trip
  -- back to the API unmodified on the next turn.
  content    jsonb not null,
  created_at timestamptz not null default now()
);

create index chat_messages_user_id_idx on chat_messages using btree (user_id);
create index chat_messages_session_idx on chat_messages (session_id, created_at);

alter table chat_messages enable row level security;

create policy "chat_messages: owner can select" on chat_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "chat_messages: owner can insert" on chat_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "chat_messages: owner can delete" on chat_messages
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- style_feedback — the personalization flywheel
-- ---------------------------------------------------------------------------

create table style_feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  outfit_id  uuid references outfits (id) on delete set null,
  item_id    uuid references items (id) on delete set null,
  action     feedback_action not null,
  reason     text,            -- 'too formal', 'hate this combo', 'weather is wrong', ...
  context    jsonb,
  created_at timestamptz not null default now()
);

create index style_feedback_user_id_idx on style_feedback using btree (user_id);
create index style_feedback_user_created_idx on style_feedback (user_id, created_at desc);

alter table style_feedback enable row level security;

create policy "style_feedback: owner can select" on style_feedback
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "style_feedback: owner can insert" on style_feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "style_feedback: owner can delete" on style_feedback
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at      before update on profiles      for each row execute function set_updated_at();
create trigger items_set_updated_at         before update on items         for each row execute function set_updated_at();
create trigger chat_sessions_set_updated_at before update on chat_sessions for each row execute function set_updated_at();

-- A profile row for every new auth user, so the app never has to branch on
-- "profile might not exist yet".
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Logging a wear is two writes that must not drift apart.
create or replace function log_outfit_wear(p_outfit_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.outfits
     set worn_at = now()
   where id = p_outfit_id;

  update public.items
     set wear_count   = wear_count + 1,
         last_worn_at = now()
   where id in (select item_id from public.outfit_items where outfit_id = p_outfit_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage
--
-- Bucket policies are entirely separate from table RLS — easy to forget while
-- focused on the tables above. Objects are keyed {user_id}/{item_id}/{file},
-- so authorization reads the first path segment.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('garments', 'garments', false)
on conflict (id) do nothing;

create policy "garments: owner can read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "garments: owner can upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'garments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "garments: owner can update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'garments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "garments: owner can delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'garments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
