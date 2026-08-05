-- ===========================================================================
-- The public boundary, column by column.
--
-- RLS is ROW level. A policy that says "public profiles are readable" hands out
-- the whole row, including the columns a public profile was never meant to
-- carry — home city, clothing sizes, AI consent timestamps, what you paid for
-- a jacket. The client selecting a narrow column list is a convention, not a
-- control: anyone with the anon key and curl selects `*`.
--
-- The intended invariant, asserted here:
--
--   Public data is exposed ONLY through the allowlisted projection views.
--   The base tables are not readable by anon at all — not even for a profile
--   that has deliberately been made public.
--
-- Four roles are exercised throughout: anon, the owner, an unrelated
-- authenticated user, and service_role.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

-- ---------------------------------------------------------------------------
-- Seed: a deliberately PUBLIC profile. This is the hard case — a private
-- profile leaking nothing proves very little.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'owner@example.test'),
       ('22222222-2222-4222-8222-222222222222', 'stranger@example.test');

-- `on conflict … do update`, not a plain insert: handle_new_user() is an
-- AFTER INSERT trigger on auth.users and has ALREADY created each profile row
-- by the time this runs. A plain insert dies on profiles_pkey before a single
-- assertion executes — which is why this suite had never passed.
insert into profiles (user_id, display_name, username, visibility,
                      sizes, home_city, ai_consent_at)
values ('11111111-1111-4111-8111-111111111111', 'Owner', 'owner', 'public',
        '{"shoe": "10", "waist": "32", "chest": "40"}'::jsonb,
        'Lisbon', now()),
       ('22222222-2222-4222-8222-222222222222', 'Stranger', 'stranger', 'public',
        '{"shoe": "8"}'::jsonb, 'Oslo', now())
on conflict (user_id) do update
  set display_name = excluded.display_name, username = excluded.username, visibility = excluded.visibility, sizes = excluded.sizes, home_city = excluded.home_city, ai_consent_at = excluded.ai_consent_at;

insert into items (id, user_id, category, is_public, is_archived,
                   purchase_price, brand, thumb_path, cutout_path, image_path)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111', 'outerwear', true, false,
        1290.00, 'Lemaire',
        '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/thumb.jpg',
        '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cutout.png',
        '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/original.jpg');

insert into outfits (id, user_id, name, is_public)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '11111111-1111-4111-8111-111111111111', 'Monday', true);

insert into outfit_items (outfit_id, item_id, user_id)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111');

insert into closet_likes (user_id, item_id)
values ('22222222-2222-4222-8222-222222222222',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into follows (follower_id, followee_id)
values ('22222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------------
-- Column privileges. Asserted on the catalogue as well as by behaviour, because
-- a grant is what would survive someone rewriting the policies.
-- ---------------------------------------------------------------------------

select ok(
  not has_column_privilege('anon', 'public.profiles', 'sizes', 'SELECT'),
  'anon has no SELECT privilege on profiles.sizes'
);

select ok(
  not has_column_privilege('anon', 'public.profiles', 'home_city', 'SELECT'),
  'anon has no SELECT privilege on profiles.home_city'
);

select ok(
  not has_column_privilege('anon', 'public.profiles', 'ai_consent_at', 'SELECT'),
  'anon has no SELECT privilege on profiles.ai_consent_at'
);

select ok(
  not has_column_privilege('anon', 'public.items', 'purchase_price', 'SELECT'),
  'anon has no SELECT privilege on items.purchase_price'
);

select ok(
  not has_column_privilege('anon', 'public.items', 'image_path', 'SELECT'),
  'anon has no SELECT privilege on items.image_path — the original photograph'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  'select sizes from profiles',
  '42501',
  null,
  'anon cannot read profiles.sizes even for a profile marked public'
);

select throws_ok(
  'select home_city from profiles',
  '42501',
  null,
  'anon cannot read profiles.home_city even for a profile marked public'
);

select throws_ok(
  'select ai_consent_at from profiles',
  '42501',
  null,
  'anon cannot read profiles.ai_consent_at even for a profile marked public'
);

select throws_ok(
  'select purchase_price from items',
  '42501',
  null,
  'anon cannot read items.purchase_price even for an item marked public'
);

select throws_ok(
  'select * from outfit_items',
  '42501',
  null,
  'anon cannot read the outfit_items base table'
);

select throws_ok(
  'select * from closet_likes',
  '42501',
  null,
  'anon cannot enumerate who liked what'
);

select throws_ok(
  'select * from follows',
  '42501',
  null,
  'anon cannot enumerate the social graph'
);

-- The projections are REVOKED while the social surface is deferred
-- (20260805213000). These assertions are the deliberate tripwire: the day the
-- feature ships and SELECT is granted back, they fail loudly and have to be
-- consciously rewritten to assert the row-level behaviour instead — which is
-- exactly the moment that behaviour needs re-verifying.

select throws_ok(
  'select * from public_profiles',
  '42501',
  null,
  'the public views are not granted while the social surface is deferred'
);

select throws_ok(
  'select * from public_items',
  '42501',
  null,
  'public_items is not granted while the social surface is deferred'
);

reset role;
select ok(
  not has_table_privilege('anon', 'public.public_profiles', 'SELECT'),
  'anon holds no SELECT on public_profiles in the catalogue either'
);
select ok(
  not has_table_privilege('anon', 'public.public_items', 'SELECT'),
  'anon holds no SELECT on public_items in the catalogue either'
);
set local role anon;

select is(
  (select array_agg(column_name::text order by column_name)
     from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_items'
      and column_name in ('purchase_price', 'purchase_date', 'wear_count',
                          'last_worn_at', 'image_path', 'ai_tags')),
  null,
  'public_items projects no price, no wear history, no original image, no raw AI output'
);

select is(
  (select array_agg(column_name::text order by column_name)
     from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_profiles'
      and column_name in ('sizes', 'home_city', 'ai_consent_at', 'color_season',
                          'preference_summary')),
  null,
  'public_profiles projects none of the private profile columns'
);

reset role;

-- ---------------------------------------------------------------------------
-- An unrelated authenticated user. Being signed in is not a promotion.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select count(*) from items
    where user_id = '11111111-1111-4111-8111-111111111111'
      and purchase_price is not null),
  0::bigint,
  'a signed-in stranger cannot read another user''s purchase prices'
);

select is(
  (select count(*) from profiles
    where user_id = '11111111-1111-4111-8111-111111111111'
      and sizes is not null),
  0::bigint,
  'a signed-in stranger cannot read another user''s sizes from the base table'
);

reset role;

-- ---------------------------------------------------------------------------
-- service_role. The Edge Functions run here and must be able to do their job.
-- ---------------------------------------------------------------------------

set local role service_role;

select is(
  (select count(*) from items
    where user_id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  'service_role reads every tenant, which is what the Edge Functions rely on'
);

reset role;

select * from finish();
rollback;
