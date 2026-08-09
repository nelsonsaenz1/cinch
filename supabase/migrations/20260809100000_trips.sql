-- ===========================================================================
-- Packing — the saved trip.
--
-- Three surfaces in atlas 28 need a trip to outlive the screen that answered
-- it, and none of them can work today because nothing is stored:
--
--   K-01  "Your last trip — four days in Lisbon — came out at eleven pieces
--          and nine looks."     (the gate quoting the user's own history)
--   K-05  "Save to Plan"
--   K-06  "Open last list", and the reminder-that-became-a-save
--
-- Same ground rules as every table since Migration A: no anon anywhere,
-- explicit grants only, `(select auth.uid())`, per-command policies, an index
-- on every policy-filtered column. See
-- docs/design/membership-packing-contract.md §8.
--
-- PRIVATE BY CONSTRUCTION. A trip names where somebody will be and when, which
-- is the most sensitive row in this database — more so than a garment or a
-- comment. There is no sharing path, no public view, and no policy for anyone
-- but the owner. If sharing is ever wanted it gets its own migration and its
-- own argument.
-- ===========================================================================

create table trips (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,

  -- The destination, as the geocoder answered. Denormalised on purpose: a trip
  -- is a record of what was asked for, and it must not change its meaning
  -- because a gazetteer was updated afterwards.
  place_name        text not null check (char_length(place_name) between 1 and 120),
  place_country     text not null default '' check (char_length(place_country) <= 80),
  place_admin1      text not null default '' check (char_length(place_admin1) <= 80),
  -- Two decimals, ~1.1km, matching what the client sends to Open-Meteo and what
  -- the privacy manifest claims. Storing more precision than we transmit would
  -- make the manifest's Coarse Location claim false.
  latitude          numeric(5, 2) not null check (latitude between -90 and 90),
  longitude         numeric(6, 2) not null check (longitude between -180 and 180),

  -- Calendar days, not timestamps. "12 September" is a date in the
  -- destination's calendar; stored as an instant it becomes the 11th for
  -- anybody reading from a zone behind it, and the whole point of asking was to
  -- forecast the right days.
  starts_on         date not null,
  ends_on           date not null,
  constraint trips_dates_ordered check (ends_on >= starts_on),
  -- Open-Meteo's archive is the fallback for anything beyond the forecast
  -- horizon, and a "trip" of a year is not a trip.
  constraint trips_length_sane check (ends_on - starts_on <= 90),

  companions        text not null check (
    companions in ('solo', 'partner', 'friends', 'family', 'work')
  ),
  -- Cinch friends travelling too. No foreign key: a trip should not lose its
  -- companions because somebody deleted their account, and these are read for
  -- display only — the styling engine reads `companions` above.
  friend_ids        uuid[] not null default '{}',

  -- Closed vocabularies, enforced here as well as in the client, because a row
  -- with a vibe the app has never heard of renders as nothing at all.
  vibes             text[] not null check (
    array_length(vibes, 1) between 1 and 6
    and vibes <@ array['warm-city', 'work', 'long-dinners', 'beach', 'wedding', 'walking']
  ),
  parts             text[] not null check (
    array_length(parts, 1) between 1 and 4
    and parts <@ array['daytime', 'evening', 'gym', 'travel']
  ),

  -- ---------------------------------------------------------------------
  -- The result, written when the memo is saved and null until then.
  --
  -- A trip row exists from the moment the questionnaire is answered — that is
  -- what makes "your answers are saved, nothing to type again" true after a
  -- timeout (K-06's fourth failure). The counts arrive later.
  -- ---------------------------------------------------------------------
  piece_count       smallint check (piece_count is null or piece_count >= 0),
  look_count        smallint check (look_count is null or look_count >= 0),
  item_ids          uuid[] not null default '{}',
  -- The day-by-day plan as rendered: dates, parts, item ids, and the prose.
  -- Denormalised for the same reason as the place — reopening a saved list must
  -- show what it showed, not what today's engine would produce from today's
  -- closet.
  memo              jsonb,
  -- Whether the weather behind it was a real forecast or archive normals. K-06
  -- has to be able to say which, and a reopened list must keep saying it.
  weather_source    text not null default 'none' check (
    weather_source in ('none', 'forecast', 'normals')
  ),

  saved_at          timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Every policy below filters on user_id; K-01 and "open last list" both want
-- the newest first.
create index trips_user_recent_idx on trips (user_id, created_at desc);
-- K-01 quotes the last trip that actually produced a list, which is not
-- necessarily the last one started.
create index trips_user_saved_idx on trips (user_id, saved_at desc)
  where saved_at is not null;

alter table trips enable row level security;

create trigger trips_set_updated_at
  before update on trips for each row execute function set_updated_at();

-- Owner-only, one policy per command. No anon role appears anywhere.
create policy "trips: owner can select" on trips
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "trips: owner can insert" on trips
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "trips: owner can update" on trips
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "trips: owner can delete" on trips
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table trips to authenticated;
