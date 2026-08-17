-- ===========================================================================
-- Daily Social — the read path, the boundary, and the pair-private reaction.
--
-- WHY THE TIMELINE IS BUILT WITH THE TRIGGER DISABLED
--
-- `now()` is TRANSACTION time and this whole file is one transaction, so every
-- boundary the trigger stamps is the same instant, and a look "worn while off"
-- would share that instant and satisfy `worn_at >= boundary`. The test would
-- pass for the wrong reason and the bug it exists to catch would walk straight
-- through it. So the VIEW's boundary logic is tested against an explicit
-- timeline written with the trigger disabled, and the TRIGGER's own behaviour —
-- that a client cannot choose the instant — is tested separately with it on.
--
-- Profiles come from `on_auth_user_created` (initial_schema.sql:347). Nothing
-- here inserts into `profiles`; that is the duplicate-key error that cost
-- 17_closet_visibility.sql two CI runs.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('81818181-8181-4181-8181-818181818181', 'ds-recent@example.test'),
  ('82828282-8282-4282-8282-828282828282', 'ds-viewer@example.test'),
  ('83838383-8383-4383-8383-838383838383', 'ds-stranger@example.test'),
  ('84848484-8484-4484-8484-848484848484', 'ds-old@example.test');

-- Both owners are mutual with the viewer. The stranger follows nobody.
insert into public.follows (follower_id, followee_id) values
  ('81818181-8181-4181-8181-818181818181', '82828282-8282-4282-8282-828282828282'),
  ('82828282-8282-4282-8282-828282828282', '81818181-8181-4181-8181-818181818181'),
  ('84848484-8484-4484-8484-848484848484', '82828282-8282-4282-8282-828282828282'),
  ('82828282-8282-4282-8282-828282828282', '84848484-8484-4484-8484-848484848484');

insert into public.items (id, user_id, category) values
  ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', '81818181-8181-4181-8181-818181818181', 'top'),
  ('a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', '81818181-8181-4181-8181-818181818181', 'bottom');

-- The explicit timeline. Trigger off so the boundaries are ours, not now().
alter table public.profiles disable trigger profiles_worn_outfits_boundary;

update public.profiles set worn_outfits_shared_since = now() - interval '1 hour'
 where user_id = '81818181-8181-4181-8181-818181818181';
update public.profiles set worn_outfits_shared_since = now() - interval '30 days'
 where user_id = '84848484-8484-4484-8484-848484848484';

insert into public.outfits (id, user_id, name, worn_at) values
  -- recent owner: one before the boundary, one after
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', '81818181-8181-4181-8181-818181818181',
   'Before The Boundary', now() - interval '2 hours'),
  ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', '81818181-8181-4181-8181-818181818181',
   'After The Boundary', now() - interval '30 minutes'),
  -- old owner: both after a very old boundary, one outside the 7-day window
  ('b3b3b3b3-b3b3-43b3-83b3-b3b3b3b3b3b3', '84848484-8484-4484-8484-848484848484',
   'Older Than A Week', now() - interval '8 days'),
  ('b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4', '84848484-8484-4484-8484-848484848484',
   'Inside The Window', now() - interval '1 day'),
  -- never worn
  ('b5b5b5b5-b5b5-45b5-85b5-b5b5b5b5b5b5', '81818181-8181-4181-8181-818181818181',
   'Never Worn', null);

insert into public.outfit_items (outfit_id, item_id, user_id) values
  ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
   '81818181-8181-4181-8181-818181818181'),
  ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
   '81818181-8181-4181-8181-818181818181');

alter table public.profiles enable trigger profiles_worn_outfits_boundary;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"82828282-8282-4282-8282-828282828282","role":"authenticated"}', true);

-- ---------------------------------------------------------------------------
-- 1-8 · The read path
-- ---------------------------------------------------------------------------

select is((select count(*)::int from public.friend_worn_outfits
            where name = 'Before The Boundary'), 0,
  '1 · a look worn BEFORE the owner opted in never crosses');

select is((select count(*)::int from public.friend_worn_outfits
            where name = 'After The Boundary'), 1,
  '2 · a look worn after the boundary does cross');

select is((select count(*)::int from public.friend_worn_outfits
            where name = 'Older Than A Week'), 0,
  '3 · past the boundary but older than seven days still never crosses');

select is((select count(*)::int from public.friend_worn_outfits
            where name = 'Inside The Window'), 1,
  '4 · inside both windows, it crosses');

select is((select count(*)::int from public.friend_worn_outfits
            where name = 'Never Worn'), 0,
  '5 · a planned but unworn outfit never crosses');

select is((select count(*)::int from public.friend_worn_outfit_items
            where outfit_id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'), 2,
  '6 · both visible pieces of a shared look cross');

-- A hidden piece is absent, and nothing anywhere counts what is missing.
reset role;
update public.items set is_archived = true
 where id = 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"82828282-8282-4282-8282-828282828282","role":"authenticated"}', true);

select is((select count(*)::int from public.friend_worn_outfit_items
            where outfit_id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'), 1,
  '7 · a hidden piece is simply absent — the look still renders, one piece fewer');

select is((select count(*)::int from public.friend_worn_outfits
            where name = 'After The Boundary'), 1,
  '8 · hiding a piece does not hide the look it was part of');

reset role;
update public.items set is_archived = false
 where id = 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2';
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 9-12 · Who may look at all
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"83838383-8383-4383-8383-838383838383","role":"authenticated"}', true);
select is((select count(*)::int from public.friend_worn_outfits), 0,
  '9 · a non-friend sees nothing');

select set_config('request.jwt.claims',
  '{"sub":"82828282-8282-4282-8282-828282828282","role":"authenticated"}', true);
insert into public.user_blocks (blocker_id, blocked_id)
values ('82828282-8282-4282-8282-828282828282', '81818181-8181-4181-8181-818181818181');
select is((select count(*)::int from public.friend_worn_outfits
            where user_id = '81818181-8181-4181-8181-818181818181'), 0,
  '10 · a block hides the looks');
delete from public.user_blocks
 where blocker_id = '82828282-8282-4282-8282-828282828282';

reset role;
update public.profiles set closet_hidden = true
 where user_id = '81818181-8181-4181-8181-818181818181';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"82828282-8282-4282-8282-828282828282","role":"authenticated"}', true);
select is((select count(*)::int from public.friend_worn_outfits
            where user_id = '81818181-8181-4181-8181-818181818181'), 0,
  '11 · a hidden closet hides its looks too');
reset role;
update public.profiles set closet_hidden = false
 where user_id = '81818181-8181-4181-8181-818181818181';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"82828282-8282-4282-8282-828282828282","role":"authenticated"}', true);

select is((select count(*)::int from public.friend_worn_outfits), 2,
  '12 · with everything restored, exactly the two allowed looks cross');

-- ---------------------------------------------------------------------------
-- 13-17 · Reactions, pair-private and three-valued
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.daily_social_reactions (outfit_id, reactor_id, owner_id, reaction)
    values ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
            '82828282-8282-4282-8282-828282828282',
            '81818181-8181-4181-8181-818181818181', 'sharp')$$,
  '13 · a friend can react to a visible look');

select throws_ok(
  $$insert into public.daily_social_reactions (outfit_id, reactor_id, owner_id, reaction)
    values ('b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4',
            '82828282-8282-4282-8282-828282828282',
            '84848484-8484-4484-8484-848484848484', 'meh')$$,
  '23514', null,
  '14 · a fourth reaction is refused by the check constraint');

select lives_ok(
  $$update public.daily_social_reactions set reaction = 'cozy'
     where outfit_id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'$$,
  '15 · changing your mind is an update');

select is((select count(*)::int from public.daily_social_reactions), 1,
  '16 · and there is still one row, so nothing can accumulate into a tally');

select set_config('request.jwt.claims',
  '{"sub":"83838383-8383-4383-8383-838383838383","role":"authenticated"}', true);
select is((select count(*)::int from public.daily_social_reactions), 0,
  '17 · a third party sees no reaction — it is private to the pair');

select set_config('request.jwt.claims',
  '{"sub":"81818181-8181-4181-8181-818181818181","role":"authenticated"}', true);
select is((select reaction from public.daily_social_reactions), 'cozy',
  '18 · the owner sees the reaction to their own look');

-- ---------------------------------------------------------------------------
-- 19-21 · The trigger: the client does not get to choose the instant
-- ---------------------------------------------------------------------------

-- Backdating. This is the attack the trigger exists to refuse: an owner writing
-- an old timestamp into their own row would expose their entire history.
update public.profiles set worn_outfits_shared_since = null
 where user_id = '81818181-8181-4181-8181-818181818181';
update public.profiles set worn_outfits_shared_since = timestamptz '2020-01-01'
 where user_id = '81818181-8181-4181-8181-818181818181';

select ok(
  (select worn_outfits_shared_since from public.profiles
    where user_id = '81818181-8181-4181-8181-818181818181')
  > now() - interval '1 minute',
  '19 · a backdated boundary is overridden with now()');

select set_config('request.jwt.claims',
  '{"sub":"82828282-8282-4282-8282-828282828282","role":"authenticated"}', true);
select is((select count(*)::int from public.friend_worn_outfits
            where user_id = '81818181-8181-4181-8181-818181818181'), 0,
  '20 · so backdating exposes no history at all');

-- On -> on is left alone, so an unrelated profile write cannot silently retract
-- looks a friend can already see.
select set_config('request.jwt.claims',
  '{"sub":"84848484-8484-4484-8484-848484848484","role":"authenticated"}', true);
update public.profiles set worn_outfits_shared_since = timestamptz '2035-01-01'
 where user_id = '84848484-8484-4484-8484-848484848484';

select set_config('request.jwt.claims',
  '{"sub":"82828282-8282-4282-8282-828282828282","role":"authenticated"}', true);
select is((select count(*)::int from public.friend_worn_outfits
            where name = 'Inside The Window'), 1,
  '21 · an on-to-on write leaves the boundary alone and retracts nothing');

-- ---------------------------------------------------------------------------
-- 22-24 · The count, which is the only way "nobody shares yet" and "a quiet
--         day" can be two different screens
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"83838383-8383-4383-8383-838383838383","role":"authenticated"}', true);
select is(public.friends_sharing_worn_outfits_count(), 0,
  '22 · somebody with no mutuals counts nobody');

select set_config('request.jwt.claims',
  '{"sub":"82828282-8282-4282-8282-828282828282","role":"authenticated"}', true);
select is(public.friends_sharing_worn_outfits_count(), 2,
  '23 · both sharing mutuals are counted, even the one with nothing to show');

-- Sharing off is a real transition through the trigger, not a fixture edit.
select set_config('request.jwt.claims',
  '{"sub":"84848484-8484-4484-8484-848484848484","role":"authenticated"}', true);
update public.profiles set worn_outfits_shared_since = null
 where user_id = '84848484-8484-4484-8484-848484848484';

select set_config('request.jwt.claims',
  '{"sub":"82828282-8282-4282-8282-828282828282","role":"authenticated"}', true);
select is(public.friends_sharing_worn_outfits_count(), 1,
  '24 · turning sharing off drops you out of the count immediately');

select * from finish();
rollback;
