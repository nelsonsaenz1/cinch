-- ===========================================================================
-- Private groups — membership, the roster boundary, the state machine and the
-- twelve seats.
--
-- The `database` CI job is the only thing in this repository that observes RLS
-- at all: a broken policy typechecks, bundles and ships. This file is therefore
-- the only place the group's central promise is ever actually checked —
-- "You will see who else is in it after you accept. Nothing of yours is shared
-- until then." That promise is STRICTER than the events precedent this schema
-- otherwise copies, so assertions 11-14 are the ones to read first — and 14
-- is how a count reaches an invitee without a roster reaching them with it.
--
-- THREE TRAPS THIS FILE IS WRITTEN AROUND, all three already paid for:
--
--   * `now()` is TRANSACTION-constant and this whole file is one transaction.
--     Nothing below builds a timeline or compares a stamped boundary against
--     `now()`; the only time-sensitive machinery in reach is the invite rate
--     limit (100/day per inviter) and the ~30 invitations here stay far under
--     it. (18_daily_social.sql:4-12.)
--   * A BLOCK PERMANENTLY SEVERS THE FOLLOW EDGES. `on_block_sever_graph`
--     deletes BOTH `follows` rows and unblocking does not restore them, so a
--     block is not reversible fixture state. Nothing here unblocks, and the two
--     people who get blocked (Wren, Marlow) are used for nothing afterwards
--     that depends on mutual friendship. Left implicit, that fact cost
--     18_daily_social.sql six failing assertions
--     (18_daily_social.sql:134-164).
--   * Profiles are made by `on_auth_user_created`. Nothing here inserts into
--     `public.profiles` — that is the duplicate-key error that cost
--     17_closet_visibility.sql two CI runs. The terms columns are UPDATEd on
--     the rows that trigger already created.
--
-- Fixture writes that are not themselves under test run under `reset role`
-- (the `follows` rows, which would otherwise meet `follows_require_terms`).
-- Everything a user is claimed to be able to do runs as that user, under
-- `authenticated`, through the real policies.
--
-- WHERE THIS DIVERGES FROM THE 22-CASE MATRIX IN THE PREPARATION DOC, and why:
-- cases 14-15 there read "twelfth invitation succeeds / thirteenth refused",
-- which counts the owner outside the cap. The owner is a member from birth and
-- the atlas says a group holds twelve PEOPLE, so the eleventh invitation is the
-- last that fits and the twelfth is refused. Assertions 46-47.
--
-- Preparation §5 also has no case for asking somebody back, because the model
-- it describes cannot: the primary key refuses a second INSERT and the owner
-- had no transition out of `removed`. Assertions 51-57 cover the path that
-- makes the model reversible, and 57 is the one that keeps twelve a cap while
-- it does.
--
-- And nothing in preparation §5 covers IDENTITY, because the audit did not
-- reach `social_profiles`. Members of a group are mutual friends of its owner,
-- not of each other, so a roster that cannot name its own people was the
-- default. Assertions 20-24, 35-36 and 58 are that branch and its edges.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(65);

-- ---------------------------------------------------------------------------
-- People. Nora owns; Priya accepts then leaves; Ellis is invited, declines,
-- accepts, and is removed; Sasha is a stranger who is nobody's mutual friend
-- except Priya's; Wren joins and is then blocked; Marlow is blocked before
-- ever being invited. Fourteen more exist only to fill seats.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('c1111111-1111-4111-8111-111111111111', 'pc-nora@example.test'),
  ('c2222222-2222-4222-8222-222222222222', 'pc-priya@example.test'),
  ('c3333333-3333-4333-8333-333333333333', 'pc-ellis@example.test'),
  ('c4444444-4444-4444-8444-444444444444', 'pc-sasha@example.test'),
  ('c5555555-5555-4555-8555-555555555555', 'pc-wren@example.test'),
  ('c6666666-6666-4666-8666-666666666666', 'pc-marlow@example.test');

insert into auth.users (id, email)
select ('c9000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       'pc-fill-' || i || '@example.test'
  from generate_series(1, 14) i;

-- `assert_social_terms` gates every insert into `circles` and `circle_members`,
-- so acceptance is a precondition rather than decoration. Scoped by email so
-- this cannot touch a row some other file created.
update public.profiles
   set social_terms_version = public.current_social_terms_version(),
       social_terms_at      = now()
 where user_id in (select id from auth.users where email like 'pc-%');

-- `handle_new_user` writes a profile with a user_id and nothing else, so every
-- display name here is null unless this file sets one. Two are set, because the
-- `social_profiles` assertions below have to show that an identity comes back
-- and not merely that a row does. `visibility` stays at its 'private' default
-- throughout, so the view's `public` branch never fires for anybody.
update public.profiles set display_name = 'Priya'
 where user_id = 'c2222222-2222-4222-8222-222222222222';
update public.profiles set display_name = 'Ellis'
 where user_id = 'c3333333-3333-4333-8333-333333333333';

-- Mutual friendship: Nora with everyone she will ever invite, and Priya with
-- Sasha so that assertion 25 fails for exactly one reason (Priya is not the
-- owner) rather than two.
insert into public.follows (follower_id, followee_id) values
  ('c1111111-1111-4111-8111-111111111111', 'c2222222-2222-4222-8222-222222222222'),
  ('c2222222-2222-4222-8222-222222222222', 'c1111111-1111-4111-8111-111111111111'),
  ('c1111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333333'),
  ('c3333333-3333-4333-8333-333333333333', 'c1111111-1111-4111-8111-111111111111'),
  ('c1111111-1111-4111-8111-111111111111', 'c5555555-5555-4555-8555-555555555555'),
  ('c5555555-5555-4555-8555-555555555555', 'c1111111-1111-4111-8111-111111111111'),
  ('c1111111-1111-4111-8111-111111111111', 'c6666666-6666-4666-8666-666666666666'),
  ('c6666666-6666-4666-8666-666666666666', 'c1111111-1111-4111-8111-111111111111'),
  ('c2222222-2222-4222-8222-222222222222', 'c4444444-4444-4444-8444-444444444444'),
  ('c4444444-4444-4444-8444-444444444444', 'c2222222-2222-4222-8222-222222222222');

insert into public.follows (follower_id, followee_id)
select 'c1111111-1111-4111-8111-111111111111'::uuid,
       ('c9000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid
  from generate_series(1, 14) i;
insert into public.follows (follower_id, followee_id)
select ('c9000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       'c1111111-1111-4111-8111-111111111111'::uuid
  from generate_series(1, 14) i;

-- ---------------------------------------------------------------------------
-- 1-6 · Creation and invitation, as Nora
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

insert into public.circles (id, owner_id, name)
values ('cccc1111-1111-4111-8111-111111111111',
        'c1111111-1111-4111-8111-111111111111', 'Sunday tennis');

select is(
  (select count(*)::int from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'),
  1,
  '1 · a new group has exactly one member — the owner row is not the client''s to write');

select is(
  (select role::text || '/' || state::text from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'
      and user_id   = 'c1111111-1111-4111-8111-111111111111'),
  'owner/joined',
  '2 · and that member is the owner, already joined');

-- No role or state given: this proves the column defaults, not just the policy.
select lives_ok(
  $$insert into public.circle_members (circle_id, user_id, invited_by)
    values ('cccc1111-1111-4111-8111-111111111111',
            'c2222222-2222-4222-8222-222222222222',
            'c1111111-1111-4111-8111-111111111111')$$,
  '3 · the owner invites a mutual friend');

select is(
  (select role::text || '/' || state::text from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'
      and user_id   = 'c2222222-2222-4222-8222-222222222222'),
  'member/invited',
  '4 · the invitation lands as an invitation, and as a member — never a second owner');

select throws_ok(
  $$insert into public.circle_members (circle_id, user_id, invited_by)
    values ('cccc1111-1111-4111-8111-111111111111',
            'c4444444-4444-4444-8444-444444444444',
            'c1111111-1111-4111-8111-111111111111')$$,
  '42501', null,
  '5 · somebody who is not a mutual friend cannot be invited — checked here, and only here');

-- Ellis and Wren are invited too; both are used below.
insert into public.circle_members (circle_id, user_id, invited_by) values
  ('cccc1111-1111-4111-8111-111111111111',
   'c3333333-3333-4333-8333-333333333333',
   'c1111111-1111-4111-8111-111111111111'),
  ('cccc1111-1111-4111-8111-111111111111',
   'c5555555-5555-4555-8555-555555555555',
   'c1111111-1111-4111-8111-111111111111');

select throws_ok(
  $$insert into public.circle_members (circle_id, user_id, state, invited_by)
    values ('cccc1111-1111-4111-8111-111111111111',
            'c9000000-0000-4000-8000-000000000014', 'joined',
            'c1111111-1111-4111-8111-111111111111')$$,
  '42501', null,
  '6 · an invitation cannot be written as an acceptance — joining is the invitee''s act');

-- ---------------------------------------------------------------------------
-- 7-10 · The stranger. Groups are invite-only: nobody can search for one, and
--       no one outside sees that it exists.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"c4444444-4444-4444-8444-444444444444","role":"authenticated"}', true);

select is((select count(*)::int from public.circles), 0,
  '7 · a stranger sees no group at all');
select is((select count(*)::int from public.circle_members), 0,
  '8 · and no roster');

-- The count is gated too, and the pair below is the anti-probing proof: a group
-- the caller may not see answers exactly what an id that was never created
-- answers, so nobody can walk uuids looking for one that reads differently.
select is(
  public.circle_member_count('cccc1111-1111-4111-8111-111111111111'), 0,
  '9 · a stranger cannot count one either');

select is(
  public.circle_member_count('cccc9999-9999-4999-8999-999999999999'), 0,
  '10 · which is the same 0 a group id that was never created returns — no existence oracle');

-- ---------------------------------------------------------------------------
-- The invitee. THE ATLAS RULE, and the one place this schema is deliberately
-- stricter than `event_members`, whose roster policy uses `can_see_event` and
-- hands an invitee the whole participant list.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.circles
    where id = 'cccc1111-1111-4111-8111-111111111111'),
  1,
  '11 · an invitee can see the group — an invitation you cannot see is not one');

select is(
  (select count(*)::int from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'),
  1,
  '12 · but exactly one membership row: their own');

select is(
  (select count(*)::int from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'
      and user_id  <> 'c3333333-3333-4333-8333-333333333333'),
  0,
  '13 · the roster is hidden until you accept — not even the owner''s row shows');

-- ...and yet PC-04 draws a member count above that very sentence. This is the
-- only thing that can serve it: three of the four rows in this group are
-- invitations waiting to be answered, and none of them is counted, so what the
-- invitee learns is how many people are in it and nothing whatever about who.
select is(
  public.circle_member_count('cccc1111-1111-4111-8111-111111111111'), 1,
  '14 · but an invitee IS told how many are in it — a number, never a name');

select is(
  (select invited_by::text from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'
      and user_id   = 'c3333333-3333-4333-8333-333333333333'),
  'c1111111-1111-4111-8111-111111111111',
  '15 · what an invitee does get is who asked them');

select lives_ok(
  $$update public.circle_members set state = 'declined'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c3333333-3333-4333-8333-333333333333'$$,
  '16 · an invitee may decline');

select lives_ok(
  $$update public.circle_members set state = 'joined'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c3333333-3333-4333-8333-333333333333'$$,
  '17 · and may still accept afterwards — declining is not final');

-- ---------------------------------------------------------------------------
-- 18-28 · Joining, being nameable, and what a member still may not do
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select lives_ok(
  $$update public.circle_members set state = 'joined'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c2222222-2222-4222-8222-222222222222'$$,
  '18 · an invitee accepts');

select set_config('request.jwt.claims',
  '{"sub":"c5555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
update public.circle_members set state = 'joined'
 where circle_id = 'cccc1111-1111-4111-8111-111111111111'
   and user_id   = 'c5555555-5555-4555-8555-555555555555';

select set_config('request.jwt.claims',
  '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'),
  4,
  '19 · once joined, a member sees the whole roster — the other half of the promise');

-- ---------------------------------------------------------------------------
-- Identity. A roster that can list people it cannot name is not a roster, and
-- members of a private group are mutual friends OF THE OWNER, not of each
-- other — so without the circle branch in `social_profiles` every member sees
-- their own friends by name and everybody else as a blank.
-- ---------------------------------------------------------------------------

select is(public.is_friend('c3333333-3333-4333-8333-333333333333'), false,
  '20 · Priya and Ellis are not mutual friends — nothing but the group connects them');

select is(
  (select display_name from public.social_profiles
    where user_id = 'c3333333-3333-4333-8333-333333333333'),
  'Ellis',
  '21 · and they can still put a name to each other, because both are joined here');

select set_config('request.jwt.claims',
  '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select is(
  (select display_name from public.social_profiles
    where user_id = 'c2222222-2222-4222-8222-222222222222'),
  'Priya',
  '22 · which reads the same way from the other side');

-- Priya blocks Wren. Priya owns no group, so `on_block_sever_graph` touches no
-- membership at all and the two stay co-joined in Nora's — which is what makes
-- the next pair a clean test of the view's top-level block screen rather than
-- of the cascade. Nothing after this needs Priya and Wren to be related.
select set_config('request.jwt.claims',
  '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
insert into public.user_blocks (blocker_id, blocked_id)
values ('c2222222-2222-4222-8222-222222222222',
        'c5555555-5555-4555-8555-555555555555');

select is(
  (select count(*)::int from public.social_profiles
    where user_id = 'c5555555-5555-4555-8555-555555555555'),
  0,
  '23 · a blocked pair stay nameless to each other, co-membership notwithstanding');

select is(
  (select state::text from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'
      and user_id   = 'c5555555-5555-4555-8555-555555555555'),
  'joined',
  '24 · while both are still joined — the cascade only reaches groups the blocker OWNS, and Priya owns none');

select throws_ok(
  $$insert into public.circle_members (circle_id, user_id, invited_by)
    values ('cccc1111-1111-4111-8111-111111111111',
            'c4444444-4444-4444-8444-444444444444',
            'c2222222-2222-4222-8222-222222222222')$$,
  '42501', null,
  '25 · a member cannot invite even their own mutual friend — only the owner does');

select throws_ok(
  $$update public.circle_members set role = 'owner'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c2222222-2222-4222-8222-222222222222'$$,
  '42501', null,
  '26 · and cannot promote themselves — role is immutable, by trigger');

select lives_ok(
  $$update public.circle_members set state = 'removed'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c3333333-3333-4333-8333-333333333333'$$,
  '27 · a member removing another member raises nothing at all...');

select is(
  (select state::text from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'
      and user_id   = 'c3333333-3333-4333-8333-333333333333'),
  'joined',
  '28 · ...because the policy matched no row, and nothing moved');

-- ---------------------------------------------------------------------------
-- 29-39 · What the OWNER may not do. The owner may only remove: being in a
--         group is something you agree to, and leaving is something you choose.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

insert into public.circle_members (circle_id, user_id, invited_by)
values ('cccc1111-1111-4111-8111-111111111111',
        'c9000000-0000-4000-8000-000000000013',
        'c1111111-1111-4111-8111-111111111111');

select throws_ok(
  $$update public.circle_members set state = 'joined'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c9000000-0000-4000-8000-000000000013'$$,
  '22023', null,
  '29 · the owner cannot accept an invitation on somebody else''s behalf');

select throws_ok(
  $$update public.circle_members set state = 'left'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c9000000-0000-4000-8000-000000000013'$$,
  '22023', null,
  '30 · nor dress an ejection up as a departure — `left` is not the owner''s to write');

select lives_ok(
  $$update public.circle_members set state = 'removed'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c3333333-3333-4333-8333-333333333333'$$,
  '31 · the owner removes a member');

-- The group now holds five rows in four different states — three joined, one
-- invitation still waiting, one just removed — which is the only arrangement
-- that can tell a joined-only count apart from a row count.
select is(
  public.circle_member_count('cccc1111-1111-4111-8111-111111111111'), 3,
  '32 · the count is joined members only — the waiting invitation and the removed row are both absent from it');

-- And PC-07's "Invitations · 2 waiting" needs nothing new: the owner is joined
-- from birth and cannot leave or be removed, so the roster policy hands them
-- every row in every state and the waiting count is a client-side filter over
-- data they already hold.
select is(
  (select count(*)::int from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'),
  5,
  '33 · while the owner still reads all five rows, invitations and exits included');

select set_config('request.jwt.claims',
  '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is(
  public.circle_member_count('cccc1111-1111-4111-8111-111111111111'), 3,
  '34 · a joined member who is not the owner is told the same number');

-- The identity branch is joined-to-joined, so it stops exactly where the roster
-- policy stops. Fill-13 has an invitation waiting in this same group and is a
-- mutual friend of nobody but Nora.
select is(
  (select count(*)::int from public.social_profiles
    where user_id = 'c9000000-0000-4000-8000-000000000013'),
  0,
  '35 · somebody still deciding is not named to a joined member');

select set_config('request.jwt.claims',
  '{"sub":"c9000000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.social_profiles
    where user_id = 'c2222222-2222-4222-8222-222222222222'),
  0,
  '36 · nor the joined member to them — an invitation is not yet a shared room');

select set_config('request.jwt.claims',
  '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'),
  1,
  '37 · a removed member keeps the single row that says so, and loses the roster');
select is(
  (select count(*)::int from public.circles
    where id = 'cccc1111-1111-4111-8111-111111111111'),
  0,
  '38 · and no longer sees the group');

select set_config('request.jwt.claims',
  '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$update public.circle_members set state = 'left'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c1111111-1111-4111-8111-111111111111'$$,
  '22023', null,
  '39 · the owner cannot leave their own group — they delete it, or it dissolves');

-- ---------------------------------------------------------------------------
-- 40-42 · Leaving, which is why there are five states and not four
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select lives_ok(
  $$update public.circle_members set state = 'left'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c2222222-2222-4222-8222-222222222222'$$,
  '40 · a member may leave');

select set_config('request.jwt.claims',
  '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is(
  (select state::text from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'
      and user_id   = 'c2222222-2222-4222-8222-222222222222'),
  'left',
  '41 · and the roster says they left, not that they were thrown out');

select set_config('request.jwt.claims',
  '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.circles
    where id = 'cccc1111-1111-4111-8111-111111111111'),
  0,
  '42 · somebody who left no longer sees the group');

-- ---------------------------------------------------------------------------
-- 43-45 · The block cascade, and the floor that does not exist
--
-- Nothing after this point re-uses Wren or Marlow: the block below deletes both
-- follow edges permanently and no unblock restores them.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

insert into public.user_blocks (blocker_id, blocked_id)
values ('c1111111-1111-4111-8111-111111111111',
        'c5555555-5555-4555-8555-555555555555');

select is(
  (select state::text from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'
      and user_id   = 'c5555555-5555-4555-8555-555555555555'),
  'removed',
  '43 · blocking a joined member removes them from the group the blocker owns');

insert into public.user_blocks (blocker_id, blocked_id)
values ('c1111111-1111-4111-8111-111111111111',
        'c6666666-6666-4666-8666-666666666666');

select throws_ok(
  $$insert into public.circle_members (circle_id, user_id, invited_by)
    values ('cccc1111-1111-4111-8111-111111111111',
            'c6666666-6666-4666-8666-666666666666',
            'c1111111-1111-4111-8111-111111111111')$$,
  '42501', null,
  '44 · and somebody the owner has blocked cannot be invited in the first place');

select is(
  (select count(*)::int from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'
      and state = 'joined'),
  1,
  '45 · the group has fallen to one joined member and is still perfectly legal — two is a liveness property, not an invariant');

-- ---------------------------------------------------------------------------
-- 46-50 · Twelve seats, counted at the invitation
-- ---------------------------------------------------------------------------

insert into public.circles (id, owner_id, name)
values ('cccc2222-2222-4222-8222-222222222222',
        'c1111111-1111-4111-8111-111111111111', 'Full house');

-- Seats 2 through 11. Nobody accepts: that is the point of assertion 35.
insert into public.circle_members (circle_id, user_id, invited_by)
select 'cccc2222-2222-4222-8222-222222222222'::uuid,
       ('c9000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       'c1111111-1111-4111-8111-111111111111'::uuid
  from generate_series(1, 10) i;

select lives_ok(
  $$insert into public.circle_members (circle_id, user_id, invited_by)
    values ('cccc2222-2222-4222-8222-222222222222',
            'c9000000-0000-4000-8000-000000000011',
            'c1111111-1111-4111-8111-111111111111')$$,
  '46 · the eleventh invitation takes the twelfth seat — the owner holds the first');

select throws_ok(
  $$insert into public.circle_members (circle_id, user_id, invited_by)
    values ('cccc2222-2222-4222-8222-222222222222',
            'c9000000-0000-4000-8000-000000000012',
            'c1111111-1111-4111-8111-111111111111')$$,
  '23514', null,
  '47 · the twelfth is refused — a group holds twelve people and the owner is one of them');

select is(
  (select count(*)::int from public.circle_members
    where circle_id = 'cccc2222-2222-4222-8222-222222222222'
      and state = 'joined'),
  1,
  '48 · and it is full with a single person joined — the cap counts invitations, so nobody loses a race they could not see');

select lives_ok(
  $$update public.circle_members set state = 'removed'
     where circle_id = 'cccc2222-2222-4222-8222-222222222222'
       and user_id   = 'c9000000-0000-4000-8000-000000000001'$$,
  '49 · the owner withdraws one invitation');

select lives_ok(
  $$insert into public.circle_members (circle_id, user_id, invited_by)
    values ('cccc2222-2222-4222-8222-222222222222',
            'c9000000-0000-4000-8000-000000000012',
            'c1111111-1111-4111-8111-111111111111')$$,
  '50 · a removed row consumes no seat, so the refused invitation now fits');

-- ---------------------------------------------------------------------------
-- 51-57 · Asking again
--
-- Without this the primary key is a trap. A re-invitation cannot INSERT over an
-- existing row, so one mis-tapped Remove would exclude somebody from a
-- twelve-seat group permanently, with no path back for either party — which is
-- not what "obvious and reversible" means, and PC-04 says the opposite for the
-- decline case outright ("You can be invited again later").
--
-- Assertion 57 is the one that matters most: the seat check has to cover the
-- UPDATE path, or an owner could refill a group past twelve simply by removing
-- somebody and asking them back.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$update public.circle_members set state = 'invited'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c3333333-3333-4333-8333-333333333333'$$,
  '51 · the owner asks back somebody they removed');

select set_config('request.jwt.claims',
  '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select lives_ok(
  $$update public.circle_members set state = 'joined'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c3333333-3333-4333-8333-333333333333'$$,
  '52 · and it is an invitation like any other — they still have to accept it themselves');

select set_config('request.jwt.claims',
  '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$update public.circle_members set state = 'invited'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c2222222-2222-4222-8222-222222222222'$$,
  '53 · somebody who LEFT can be asked back too — leaving is not a door that locks');

select is(
  (select count(*)::int from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'),
  5,
  '54 · asking again reuses the existing row — the roster does not grow a second one');

select is(
  (select count(*)::int from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'
      and state in ('invited', 'joined')),
  4,
  '55 · and an accepted re-invitation holds exactly one seat, never two');

select throws_ok(
  $$update public.circle_members set state = 'invited'
     where circle_id = 'cccc1111-1111-4111-8111-111111111111'
       and user_id   = 'c5555555-5555-4555-8555-555555555555'$$,
  '42501', null,
  '56 · but somebody who is no longer a mutual friend cannot be asked back — the block severed that, and no unblock restores it');

select throws_ok(
  $$update public.circle_members set state = 'invited'
     where circle_id = 'cccc2222-2222-4222-8222-222222222222'
       and user_id   = 'c9000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  '57 · and asking back into a full group is refused — the seat check covers the update path, or twelve was never a cap');

-- ---------------------------------------------------------------------------
-- 58-62 · A different group, and who may delete
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"c9000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
update public.circle_members set state = 'joined'
 where circle_id = 'cccc2222-2222-4222-8222-222222222222'
   and user_id   = 'c9000000-0000-4000-8000-000000000002';

-- Fill-2 is joined in the second group; Ellis is joined in the first, having
-- been asked back and accepted. Two joined members of two different groups, and
-- the branch names neither — co-membership has to be in the SAME group, or a
-- private group would leak its roster into every other one.
select is(
  (select count(*)::int from public.social_profiles
    where user_id = 'c3333333-3333-4333-8333-333333333333'),
  0,
  '58 · a joined member of a DIFFERENT group is not named');

select lives_ok(
  $$delete from public.circles where id = 'cccc2222-2222-4222-8222-222222222222'$$,
  '59 · a member deleting the group raises nothing...');

select is(
  (select count(*)::int from public.circles
    where id = 'cccc2222-2222-4222-8222-222222222222'),
  1,
  '60 · ...because only the owner may delete, and the group is still there');

select set_config('request.jwt.claims',
  '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$delete from public.circles where id = 'cccc1111-1111-4111-8111-111111111111'$$,
  '61 · the owner deletes the group');

-- Outside RLS on purpose: this has to be absence, not invisibility.
reset role;
select is(
  (select count(*)::int from public.circle_members
    where circle_id = 'cccc1111-1111-4111-8111-111111111111'),
  0,
  '62 · and every membership row goes with it, pending invitations included');

-- ---------------------------------------------------------------------------
-- 63-65 · The catalogue. No public surface, and no new data recipient.
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(t order by t)
     from unnest(array['circles','circle_members']) t
    where has_table_privilege('anon', 'public.' || quote_ident(t),
            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')),
  null,
  '63 · anon holds no privilege of any kind on either table — the signed-in-only decision, in the catalogue');

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('is_circle_member', 'is_circle_owner', 'can_see_circle',
                        'handle_new_circle', 'enforce_circle_size',
                        'circle_seats_taken', 'circle_member_count',
                        'assert_circle_member_transition')
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  null,
  '64 · and can execute none of them — including `circle_member_count`, which is the one function here the client calls directly');

select ok(
  not has_table_privilege('authenticated', 'public.circle_members', 'DELETE'),
  '65 · authenticated holds no DELETE on circle_members — leaving is a state, never an erasure');

select * from finish();
rollback;
