-- ===========================================================================
-- The `garments` storage bucket.
--
-- Bucket policies live on storage.objects and are entirely separate from table
-- RLS, which makes them the easiest half of the boundary to forget. Objects are
-- keyed {user_id}/{item_id}/{file} and the uploader writes three files:
--
--   original.jpg  the photograph as taken — includes the room it was taken in
--   thumb.jpg     cropped derivative
--   cutout.png    background-removed derivative
--
-- The invariant under test:
--
--   `original.jpg` is NEVER publicly readable, for any item, at any visibility.
--   Published derivatives are readable exactly when the item is public, not
--   archived, and its owner's profile is public.
--
-- Four roles, as everywhere else: anon, owner, unrelated authenticated user,
-- service_role.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'owner@example.test'),
       ('22222222-2222-4222-8222-222222222222', 'stranger@example.test');

insert into profiles (user_id, display_name, username, visibility)
values ('11111111-1111-4111-8111-111111111111', 'Owner', 'owner', 'public'),
       ('22222222-2222-4222-8222-222222222222', 'Stranger', 'stranger', 'private');

-- A public item, and a private one belonging to the same public profile.
insert into items (id, user_id, category, is_public, is_archived)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111', 'outerwear', true, false),
       ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '11111111-1111-4111-8111-111111111111', 'top', false, false);

insert into storage.objects (bucket_id, name, owner)
values
  -- Public item.
  ('garments', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/original.jpg', '11111111-1111-4111-8111-111111111111'),
  ('garments', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/thumb.jpg',    '11111111-1111-4111-8111-111111111111'),
  ('garments', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cutout.png',   '11111111-1111-4111-8111-111111111111'),
  -- Private item belonging to the same, public, profile.
  ('garments', '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc/original.jpg', '11111111-1111-4111-8111-111111111111'),
  ('garments', '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc/thumb.jpg',    '11111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------------
-- The bucket itself must not be marked public — a public bucket bypasses every
-- policy below and serves the originals over plain HTTP.
-- ---------------------------------------------------------------------------

select is(
  (select public from storage.buckets where id = 'garments'),
  false,
  'the garments bucket is private; publication is decided per object by policy'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*) from storage.objects
    where bucket_id = 'garments' and name like '%/original.jpg'),
  0::bigint,
  'anon can never read original.jpg — not for a public item, not for any item'
);

select is(
  (select count(*) from storage.objects
    where name = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/thumb.jpg'),
  1::bigint,
  'anon can read the thumb of a public item'
);

select is(
  (select count(*) from storage.objects
    where name = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cutout.png'),
  1::bigint,
  'anon can read the cutout of a public item'
);

select is(
  (select count(*) from storage.objects
    where name = '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc/thumb.jpg'),
  0::bigint,
  'a private item publishes nothing, even under a public profile'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('garments', '11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd/thumb.jpg')$$,
  '42501',
  null,
  'anon cannot write into the bucket at all'
);

reset role;

-- ---------------------------------------------------------------------------
-- The owner
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select is(
  (select count(*) from storage.objects
    where bucket_id = 'garments'
      and name like '11111111-1111-4111-8111-111111111111/%'),
  5::bigint,
  'the owner reads every object under their own prefix, originals included'
);

reset role;

-- ---------------------------------------------------------------------------
-- An unrelated authenticated user
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select count(*) from storage.objects
    where bucket_id = 'garments' and name like '%/original.jpg'),
  0::bigint,
  'a signed-in stranger cannot read anyone else''s originals'
);

select is(
  (select count(*) from storage.objects
    where name = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/thumb.jpg'),
  1::bigint,
  'a signed-in stranger sees a published derivative, same as anon'
);

select is(
  (select count(*) from storage.objects
    where name = '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc/thumb.jpg'),
  0::bigint,
  'a signed-in stranger cannot reach an unpublished derivative'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('garments', '11111111-1111-4111-8111-111111111111/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/thumb.jpg')$$,
  '42501',
  null,
  'a signed-in stranger cannot write into another user''s prefix'
);

reset role;

-- ---------------------------------------------------------------------------
-- service_role — the delete-account function has to be able to sweep the bucket
-- ---------------------------------------------------------------------------

set local role service_role;

select is(
  (select count(*) from storage.objects where bucket_id = 'garments'),
  5::bigint,
  'service_role sees the whole bucket'
);

reset role;

select * from finish();
rollback;
