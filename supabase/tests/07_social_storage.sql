-- ===========================================================================
-- The `garments` bucket, social edition. (docs/social/architecture.md §8,
-- third file.)
--
-- Migration 20260807103000 added three SELECT policies for authenticated:
-- public derivatives, friends' derivatives, and derivatives of items inside
-- outfits posted to a shared event. All three allowlist the derived filenames
-- (thumb.jpg, cutout.png, plate.png) — original.jpg has no path through any
-- of them, for anyone, ever (20260804200000).
--
-- The owner here keeps a PRIVATE profile and PRIVATE items on purpose: every
-- positive read below must be earned by the friend or event policy alone,
-- never by the public one.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- ---------------------------------------------------------------------------
-- Seed. Olive owns everything; Fern is her mutual friend; Sky is a stranger;
-- Cora shares an event with her (and is NOT her friend).
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'olive@example.test'),
       ('22222222-2222-4222-8222-222222222222', 'fern@example.test'),
       ('33333333-3333-4333-8333-333333333333', 'sky@example.test'),
       ('44444444-4444-4444-8444-444444444444', 'cora@example.test');

insert into profiles (user_id, display_name, username, visibility)
values ('11111111-1111-4111-8111-111111111111', 'Olive', 'olive', 'private'),
       ('22222222-2222-4222-8222-222222222222', 'Fern',  'fern',  'private'),
       ('33333333-3333-4333-8333-333333333333', 'Sky',   'sky',   'private'),
       ('44444444-4444-4444-8444-444444444444', 'Cora',  'cora',  'private')
on conflict (user_id) do update
  set display_name = excluded.display_name, username = excluded.username, visibility = excluded.visibility;

insert into follows (follower_id, followee_id)
values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'),
       ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');

-- Two PRIVATE items: one posted into the event, one never posted.
insert into items (id, user_id, category, is_public, is_archived)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111', 'dress', false, false),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '11111111-1111-4111-8111-111111111111', 'bag', false, false);

insert into outfits (id, user_id, name)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '11111111-1111-4111-8111-111111111111', 'Thursday');

insert into outfit_items (outfit_id, item_id, user_id, position)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111', 1);

insert into storage.objects (bucket_id, name, owner)
values
  ('garments', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/original.jpg', '11111111-1111-4111-8111-111111111111'),
  ('garments', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/thumb.jpg',    '11111111-1111-4111-8111-111111111111'),
  ('garments', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cutout.png',   '11111111-1111-4111-8111-111111111111'),
  ('garments', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/plate.png',    '11111111-1111-4111-8111-111111111111'),
  ('garments', '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/original.jpg', '11111111-1111-4111-8111-111111111111'),
  ('garments', '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/thumb.jpg',    '11111111-1111-4111-8111-111111111111');

-- The event, and Cora on its roster. The post itself is written as Olive:
-- assert_post_is_member() reads auth.uid(), which is null under postgres.
insert into events (id, host_id, title, starts_at)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        '11111111-1111-4111-8111-111111111111',
        'Dinner', now() + interval '2 days');

insert into event_members (event_id, user_id, role, state, invited_by)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        '44444444-4444-4444-8444-444444444444',
        'attendee', 'joined', '11111111-1111-4111-8111-111111111111');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
insert into event_outfit_posts (id, event_id, user_id, outfit_id)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        '11111111-1111-4111-8111-111111111111',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
reset role;

-- ---------------------------------------------------------------------------
-- The friend: every derivative in the closet, never an original.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select count(*) from storage.objects
    where name in ('11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/thumb.jpg',
                   '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/plate.png')),
  2::bigint,
  'a friend reads a private item''s thumb and plate — the friend policy, not the public one'
);

select is(
  (select count(*) from storage.objects
    where name = '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/thumb.jpg'),
  1::bigint,
  'the friend scope is the whole un-archived closet, not just posted items'
);

select is(
  (select count(*) from storage.objects
    where bucket_id = 'garments' and name like '%/original.jpg'),
  0::bigint,
  'a friend can NEVER see an original photograph — the filename allowlist has no original.jpg'
);

reset role;

-- ---------------------------------------------------------------------------
-- The stranger: nothing. Private items, private profile, no relationship.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

select is(
  (select count(*) from storage.objects
    where bucket_id = 'garments'
      and name like '11111111-1111-4111-8111-111111111111/%'),
  0::bigint,
  'a stranger sees nothing friend- or event-scoped'
);

reset role;

-- ---------------------------------------------------------------------------
-- The event co-member: POSTED items' derivatives only.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);

select is(
  (select count(*) from storage.objects
    where name = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/thumb.jpg'),
  1::bigint,
  'an event co-member reads the derivative of a garment inside a posted look'
);

select is(
  (select count(*) from storage.objects
    where name = '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/thumb.jpg'),
  0::bigint,
  'co-membership grants nothing beyond the posted looks — the rest of the closet stays closed'
);

select is(
  (select count(*) from storage.objects
    where bucket_id = 'garments' and name like '%/original.jpg'),
  0::bigint,
  'the event path never serves originals either'
);

reset role;

-- ---------------------------------------------------------------------------
-- Controls: the owner and the service role still see everything.
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
  6::bigint,
  'the owner reads every object under her own prefix, originals included'
);

reset role;

set local role service_role;

select is(
  (select count(*) from storage.objects where bucket_id = 'garments'),
  6::bigint,
  'service_role sees the whole bucket'
);

reset role;

select * from finish();
rollback;
