-- ===========================================================================
-- The four visibility flags, enforced where it counts.
--
-- `20260808110000_friend_closet_privacy_layer.sql` wired `closet_hidden` and
-- the three stat flags into `friend_items` and `friend_closet_meta`, and then
-- no UI ever set them. The control now exists, which makes these the first
-- tests to ever flip one.
--
-- The client mirrors this rule in `visibility-flags.ts` so it can draw the
-- right switch states without a database. This file is the rule itself: if the
-- two ever disagree, this one wins and the client is the bug.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

-- Two mutual friends. `is_friend` is two `follows` rows plus no block.
insert into auth.users (id, email)
values ('71717171-7171-4171-8171-717171717171', 'vis-owner@example.test'),
       ('72727272-7272-4272-8272-727272727272', 'vis-friend@example.test');

insert into public.profiles (user_id, username)
values ('71717171-7171-4171-8171-717171717171', 'visowner'),
       ('72727272-7272-4272-8272-727272727272', 'visfriend');

insert into public.follows (follower_id, followee_id)
values ('71717171-7171-4171-8171-717171717171', '72727272-7272-4272-8272-727272727272'),
       ('72727272-7272-4272-8272-727272727272', '71717171-7171-4171-8171-717171717171');

insert into public.items (id, user_id, category)
values ('73737373-7373-4373-8373-737373737373',
        '71717171-7171-4171-8171-717171717171', 'top');

-- ---------------------------------------------------------------------------
-- 1 · The defaults this packet must not move
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.profiles
    where user_id = '71717171-7171-4171-8171-717171717171'
      and not closet_hidden and not stat_pieces_hidden
      and not stat_wears_hidden and not stat_cost_per_wear_hidden),
  1,
  'a new profile defaults to visible on all four flags'
);

-- ---------------------------------------------------------------------------
-- 2 · The friend can see it, before anything is hidden
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"72727272-7272-4272-8272-727272727272","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from public.friend_items
    where user_id = '71717171-7171-4171-8171-717171717171'),
  1,
  'a mutual friend sees the piece while the closet is visible'
);

select isnt(
  (select pieces from public.friend_closet_meta
    where user_id = '71717171-7171-4171-8171-717171717171'),
  null,
  'the piece count crosses while visible'
);

-- ---------------------------------------------------------------------------
-- 3 · Only the owner may flip a flag
-- ---------------------------------------------------------------------------

-- The friend tries. RLS filters the row out rather than raising, so this is a
-- silent no-op and the assertion has to be made where the row is readable.
update public.profiles set closet_hidden = true
 where user_id = '71717171-7171-4171-8171-717171717171';

-- Read it back AS THE OWNER. `profiles` RLS shows the caller their own row plus
-- public ones, and this owner is private, so asking as the friend returns no
-- row at all and would assert null against false — passing or failing for a
-- reason that has nothing to do with the write.
select set_config(
  'request.jwt.claims',
  '{"sub":"71717171-7171-4171-8171-717171717171","role":"authenticated"}',
  true
);

select is(
  (select closet_hidden from public.profiles
    where user_id = '71717171-7171-4171-8171-717171717171'),
  false,
  'a friend cannot hide somebody else''s closet — RLS scopes the write to the owner'
);

-- ---------------------------------------------------------------------------
-- 4 · The owner hides one stat: it, and only it, stops crossing
--     (already acting as the owner from the read-back above)
-- ---------------------------------------------------------------------------

select lives_ok(
  $$update public.profiles set stat_cost_per_wear_hidden = true
     where user_id = '71717171-7171-4171-8171-717171717171'$$,
  'the owner can hide cost per wear'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"72727272-7272-4272-8272-727272727272","role":"authenticated"}',
  true
);

select is(
  (select cost_per_wear from public.friend_closet_meta
    where user_id = '71717171-7171-4171-8171-717171717171'),
  null,
  'cost per wear stops crossing the moment it is hidden'
);

select isnt(
  (select pieces from public.friend_closet_meta
    where user_id = '71717171-7171-4171-8171-717171717171'),
  null,
  'hiding cost per wear does not hide the piece count'
);

select is(
  (select count(*)::int from public.friend_items
    where user_id = '71717171-7171-4171-8171-717171717171'),
  1,
  'hiding a stat does not hide the closet'
);

-- ---------------------------------------------------------------------------
-- 5 · The owner hides the closet: everything goes with it
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"71717171-7171-4171-8171-717171717171","role":"authenticated"}',
  true
);

update public.profiles set closet_hidden = true
 where user_id = '71717171-7171-4171-8171-717171717171';

select set_config(
  'request.jwt.claims',
  '{"sub":"72727272-7272-4272-8272-727272727272","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from public.friend_items
    where user_id = '71717171-7171-4171-8171-717171717171'),
  0,
  'a hidden closet serves no items to a friend'
);

select is(
  (select coalesce(pieces::text, 'null') || '/' || coalesce(wears_logged::text, 'null')
     from public.friend_closet_meta
    where user_id = '71717171-7171-4171-8171-717171717171'),
  'null/null',
  'a hidden closet nulls the stats that were never individually hidden'
);

-- ---------------------------------------------------------------------------
-- 6 · Showing it again restores exactly what was not separately hidden
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"71717171-7171-4171-8171-717171717171","role":"authenticated"}',
  true
);

update public.profiles set closet_hidden = false
 where user_id = '71717171-7171-4171-8171-717171717171';

select set_config(
  'request.jwt.claims',
  '{"sub":"72727272-7272-4272-8272-727272727272","role":"authenticated"}',
  true
);

select is(
  (select coalesce(pieces::text, 'null') || '/' || coalesce(cost_per_wear::text, 'null')
     from public.friend_closet_meta
    where user_id = '71717171-7171-4171-8171-717171717171'),
  (select pieces::text from public.friend_closet_meta
    where user_id = '71717171-7171-4171-8171-717171717171') || '/null',
  'unhiding the closet restores the piece count and leaves cost per wear hidden'
);

select * from finish();
rollback;
