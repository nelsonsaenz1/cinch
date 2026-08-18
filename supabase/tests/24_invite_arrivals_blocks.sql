-- ===========================================================================
-- invite_arrivals() — what a private roster may still show after a block.
--
-- The function answers "who joined Cinch through my link". That fact is
-- permanent (`profiles.invited_by` is written once by `apply_invite` and never
-- cleared), which is exactly why the answer needs a guard the fact itself does
-- not have: a block is the app's strongest privacy promise and means mutual
-- invisibility everywhere else in this schema.
--
-- The four cases below are the whole of the intended semantics:
--
--   blocked either way   → absent
--   unfriended           → RETAINED, deliberately (see the migration header)
--   never blocked        → retained
--   deletion requested   → absent
--
-- The retention cases matter as much as the removals. A guard that quietly
-- removed unfriended arrivals would make the roster a friends list and would
-- contradict the page's own contract, which says an arrival never proves
-- friendship, mutual authorization or closet visibility.
--
-- Profiles come from `on_auth_user_created`; nothing here inserts into
-- `public.profiles`. `invited_by`/`invited_at` are written directly rather than
-- through `apply_invite`, because this file is about the READ: `apply_invite`
-- also inserts follow edges, and three of these cases need an arrival WITHOUT
-- a live friendship.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'ia-inviter@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'ia-blocked-by-me@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ia-blocked-me@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'ia-unfriended@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'ia-still-here@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'ia-bare@example.test'),
  ('77777777-7777-4777-8777-777777777777', 'ia-leaving@example.test'),
  ('88888888-8888-4888-8888-888888888888', 'ia-stranger@example.test');

-- Everybody except the stranger came in through the inviter's link.
update public.profiles
   set invited_by = '11111111-1111-4111-8111-111111111111',
       invited_at = now() - interval '1 day'
 where user_id in (
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333',
   '44444444-4444-4444-8444-444444444444',
   '55555555-5555-4555-8555-555555555555',
   '66666666-6666-4666-8666-666666666666',
   '77777777-7777-4777-8777-777777777777');

-- Names and handles for the ones that should read as people. `ia-bare` keeps
-- its nulls on purpose — that is the missing-fields case.
update public.profiles set display_name = 'Blocked By Me', username = 'blockedbyme'
 where user_id = '22222222-2222-4222-8222-222222222222';
update public.profiles set display_name = 'Blocked Me', username = 'blockedme'
 where user_id = '33333333-3333-4333-8333-333333333333';
update public.profiles set display_name = 'Unfriended', username = 'unfriended'
 where user_id = '44444444-4444-4444-8444-444444444444';
update public.profiles set display_name = 'Still Here', username = 'stillhere'
 where user_id = '55555555-5555-4555-8555-555555555555';
update public.profiles set display_name = null, username = null
 where user_id = '66666666-6666-4666-8666-666666666666';
update public.profiles set display_name = 'Leaving', username = 'leaving',
       deletion_requested_at = now()
 where user_id = '77777777-7777-4777-8777-777777777777';

-- `unfriended` was a real friendship and is not one any more: the edges exist
-- for `still-here` and are simply absent for `unfriended`. No block either way.
insert into public.follows (follower_id, followee_id) values
  ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555'),
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

-- ---------------------------------------------------------------------------
-- 1-3 · The baseline, before any block exists
-- ---------------------------------------------------------------------------

select is((select count(*)::int from public.invite_arrivals()), 5,
  '1 · every arrival except the one mid-deletion is listed');

select is((select count(*)::int from public.invite_arrivals()
            where user_id = '77777777-7777-4777-8777-777777777777'), 0,
  '2 · an account mid-deletion is already absent, as it always was');

select is((select count(*)::int from public.invite_arrivals()
            where user_id = '88888888-8888-4888-8888-888888888888'), 0,
  '3 · somebody who never used the link was never on the roster');

-- ---------------------------------------------------------------------------
-- 4-5 · Missing fields survive as nulls rather than dropping the row
--
-- The row is still an arrival; the client already declines to invent a name or
-- a handle for it. Dropping it here would lose a true fact to a cosmetic gap.
-- ---------------------------------------------------------------------------

select is((select count(*)::int from public.invite_arrivals()
            where user_id = '66666666-6666-4666-8666-666666666666'), 1,
  '4 · an arrival with no display name and no handle is still an arrival');

select is((select display_name is null and username is null
             from public.invite_arrivals()
            where user_id = '66666666-6666-4666-8666-666666666666'), true,
  '5 · and its missing fields arrive as nulls, not as invented strings');

-- ---------------------------------------------------------------------------
-- 6-7 · A block hides the arrival, whichever way round it was made
-- ---------------------------------------------------------------------------

reset role;
insert into public.user_blocks (blocker_id, blocked_id) values
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.invite_arrivals()
            where user_id = '22222222-2222-4222-8222-222222222222'), 0,
  '6 · somebody YOU blocked leaves your roster');

reset role;
insert into public.user_blocks (blocker_id, blocked_id) values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.invite_arrivals()
            where user_id = '33333333-3333-4333-8333-333333333333'), 0,
  '7 · somebody who blocked YOU leaves your roster too — the block is symmetric');

-- ---------------------------------------------------------------------------
-- 8-9 · What a block must NOT do
--
-- The two removals above must be the only ones. An unfriended arrival is still
-- an arrival: the fact is about the caller's link, not about a relationship,
-- and a row that vanished when a friendship ended would report that ending.
-- ---------------------------------------------------------------------------

select is((select count(*)::int from public.invite_arrivals()
            where user_id = '44444444-4444-4444-8444-444444444444'), 1,
  '8 · an arrival you are no longer friends with STAYS — the link fact is still true');

select is((select count(*)::int from public.invite_arrivals()
            where user_id = '55555555-5555-4555-8555-555555555555'), 1,
  '9 · and a friend who is neither blocked nor unfriended is untouched');

select is((select count(*)::int from public.invite_arrivals()), 3,
  '10 · so exactly the two blocked rows went, and nothing else did');

-- ---------------------------------------------------------------------------
-- 11-12 · Who may ask at all
--
-- The roster is a fact about the caller, so the caller has to be somebody.
-- `anon` may not execute it, and an authenticated stranger sees their own
-- empty roster rather than anybody else's.
-- ---------------------------------------------------------------------------

reset role;
select ok(
  not has_function_privilege('anon', 'public.invite_arrivals()', 'execute'),
  '11 · anon cannot execute the function at all');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
select is((select count(*)::int from public.invite_arrivals()), 0,
  '12 · a different caller gets their own roster, which is empty, never the inviter’s');

select * from finish();
rollback;
