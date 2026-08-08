-- ===========================================================================
-- The social graph boundary: blocks, friendship derivation, friend closets,
-- borrowing. (docs/social/architecture.md §8, first file.)
--
-- Friendship is DERIVED — mutual follow edges, screened by user_blocks — and
-- friend closet reads go through the `friend_items` definer view, never a
-- policy on `items`. The failure modes under test:
--
--   * anon acquiring any path into the new tables or views;
--   * a one-way follow being treated as a friendship;
--   * a non-friend reading rows from `friend_items`;
--   * `friend_items` projecting a private column (price, original photo,
--     wear history) — the CIN-01 leak, re-fenced for the friend surface;
--   * a borrow request landing against an unborrowable item, a spoofed owner
--     being believed, or a stranger borrowing at all;
--   * a block leaving either follow edge (or the friendship) alive.
--
-- Roles, as everywhere: anon, the participants, an unrelated authenticated
-- user. Seeds run as postgres; the probes run as the role under test.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- ---------------------------------------------------------------------------
-- Seed. Alice and Bob are mutual friends; Carol follows Alice one-way.
-- Alice owns a borrowable item and an unborrowable one.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'alice@example.test'),
       ('22222222-2222-4222-8222-222222222222', 'bob@example.test'),
       ('33333333-3333-4333-8333-333333333333', 'carol@example.test');

-- `on conflict … do update`, not a plain insert: handle_new_user() is an
-- AFTER INSERT trigger on auth.users and has ALREADY created each profile row
-- by the time this runs.
insert into profiles (user_id, display_name, username, visibility)
values ('11111111-1111-4111-8111-111111111111', 'Alice', 'alice', 'private'),
       ('22222222-2222-4222-8222-222222222222', 'Bob',   'bob',   'private'),
       ('33333333-3333-4333-8333-333333333333', 'Carol', 'carol', 'private')
on conflict (user_id) do update
  set display_name = excluded.display_name, username = excluded.username, visibility = excluded.visibility;

insert into items (id, user_id, category, borrowable, purchase_price,
                   image_path, thumb_path, cutout_path)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111', 'top', true, 89.00,
        '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/original.jpg',
        '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/thumb.jpg',
        '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cutout.png'),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '11111111-1111-4111-8111-111111111111', 'bag', false, 1290.00,
        null, null, null);

insert into follows (follower_id, followee_id)
values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'),
       ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),
       ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------------
-- anon: nothing in this feature, table or view. 42501, not zero rows.
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  'select * from user_blocks', '42501', null,
  'anon cannot read user_blocks'
);
select throws_ok(
  'select * from content_reports', '42501', null,
  'anon cannot read content_reports'
);
select throws_ok(
  'select * from borrow_requests', '42501', null,
  'anon cannot read borrow_requests'
);
select throws_ok(
  'select * from friend_items', '42501', null,
  'anon holds no grant on the friend_items view'
);
select throws_ok(
  'select * from social_profiles', '42501', null,
  'anon holds no grant on the social_profiles view'
);

reset role;

-- ---------------------------------------------------------------------------
-- Friendship is mutual, and only mutual.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select is(
  public.is_friend('22222222-2222-4222-8222-222222222222'),
  true,
  'mutual follow edges derive a friendship'
);

select is(
  public.is_friend('33333333-3333-4333-8333-333333333333'),
  false,
  'a one-way follow toward me is not a friendship'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

select is(
  public.is_friend('11111111-1111-4111-8111-111111111111'),
  false,
  'a one-way follow from me is not a friendship either'
);

reset role;

-- ---------------------------------------------------------------------------
-- The friend closet: presentation columns for friends, nothing for others.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select count(*) from friend_items
    where user_id = '11111111-1111-4111-8111-111111111111'),
  2::bigint,
  'a friend sees the whole closet — the unborrowable item included (§1.4: absent from borrow surfaces, not from the closet)'
);

select is(
  (select borrowable from friend_items
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  false,
  'the view exposes borrowable so the UI renders no request affordance'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

select is(
  (select count(*) from friend_items
    where user_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'a non-friend reads zero rows from friend_items — one-way follow grants nothing'
);

reset role;

-- wear_count and last_worn_at cross since 20260808110000 — the Friend Closet
-- atlas overrode the original no-wear-history rule ("wear counts stay, because
-- they are the part of the number that is about wearing rather than
-- spending"). Prices, originals and raw AI output still never travel; tests/09
-- owns the wear-column and hidden-closet assertions.
select is(
  (select array_agg(column_name::text order by column_name)
     from information_schema.columns
    where table_schema = 'public'
      and table_name = 'friend_items'
      and column_name in ('purchase_price', 'purchase_date',
                          'image_path', 'ai_tags')),
  null,
  'friend_items projects no price, no original image, no raw AI output'
);

-- ---------------------------------------------------------------------------
-- Borrowing: the database is the enforcing copy, not the UI's filtering.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select throws_ok(
  $$insert into borrow_requests (item_id, owner_id, requester_id, message)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222', 'may I?')$$,
  '42501',
  null,
  'a borrow request against borrowable = false is refused even for a friend'
);

select lives_ok(
  $$insert into borrow_requests (item_id, owner_id, requester_id, message)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '33333333-3333-4333-8333-333333333333',  -- spoofed owner
            '22222222-2222-4222-8222-222222222222', 'for thursday')$$,
  'a friend can request a borrowable item (owner_id supplied wrong on purpose)'
);

select is(
  (select owner_id from borrow_requests
    where item_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and requester_id = '22222222-2222-4222-8222-222222222222'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'the trigger derives owner_id from the item — the spoofed value was overwritten'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

select throws_ok(
  $$insert into borrow_requests (item_id, owner_id, requester_id)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '11111111-1111-4111-8111-111111111111',
            '33333333-3333-4333-8333-333333333333')$$,
  '42501',
  null,
  'a non-friend with no shared event cannot borrow at all'
);

reset role;

-- ---------------------------------------------------------------------------
-- A block severs the graph — both edges, the derivation, and the closet view.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into user_blocks (blocker_id, blocked_id)
    values ('22222222-2222-4222-8222-222222222222',
            '11111111-1111-4111-8111-111111111111')$$,
  'the blocker inserts their own block row'
);

reset role;

select is(
  (select count(*) from follows
    where (follower_id = '11111111-1111-4111-8111-111111111111'
           and followee_id = '22222222-2222-4222-8222-222222222222')
       or (follower_id = '22222222-2222-4222-8222-222222222222'
           and followee_id = '11111111-1111-4111-8111-111111111111')),
  0::bigint,
  'blocking tears down BOTH follow edges, including the one the blocker could not delete under their own RLS'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  public.is_friend('11111111-1111-4111-8111-111111111111'),
  false,
  'the friendship derivation is false after the block'
);

select is(
  (select count(*) from friend_items
    where user_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'the ex-friend closet view is empty on the next fetch — no server-side cache purge needed'
);

reset role;

select * from finish();
rollback;
