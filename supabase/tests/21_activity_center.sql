-- ===========================================================================
-- Activity Center — the recipient boundary, the fan-out, and the two verbs a
-- client is allowed.
--
-- The `database` CI job is the only thing in this repository that observes RLS
-- at all: a broken policy typechecks, bundles and ships. So this file is the
-- only place the surface's central promise is ever actually checked — "a row
-- exists for, and is readable by, exactly one recipient_id" — and the only
-- place the thing that promise depends on is checked either: that NO CLIENT CAN
-- WRITE A ROW. An inbox whose rows can be forged is not an inbox, it is a
-- delivery mechanism for whatever a stranger wants to say to you, and it would
-- fail silently and invisibly.
--
-- Assertions 1-4 are the ones to read first. They are catalogue facts rather
-- than probes — no INSERT grant, no INSERT policy — because the absence of a
-- verb is not a thing a probe can prove: a refused insert looks the same
-- whether the grant is missing or the policy merely happens to be false today.
--
-- THREE TRAPS THIS FILE IS WRITTEN AROUND, all three already paid for
-- elsewhere in this directory:
--
--   * Profiles are made by `on_auth_user_created`. Nothing here inserts into
--     `public.profiles` — that is the duplicate-key error that cost
--     17_closet_visibility.sql two CI runs. The terms columns are UPDATEd on
--     rows the trigger already created.
--   * `now()` is TRANSACTION-constant and this whole file is one transaction.
--     Nothing below builds a timeline. The one place it would matter — the
--     daily-social boundary, where `worn_at >= worn_outfits_shared_since` and
--     both are `now()` — is exactly why the reaction fixture works without
--     disabling a trigger, and is stated at the point it happens.
--   * `assert_social_terms` gates every insert into `circles` and
--     `circle_members`, so acceptance is a precondition rather than decoration.
--
-- Fixture writes that are not themselves under test run under `reset role`
-- (the `follows` rows, which would otherwise meet `follows_require_terms`).
-- Everything a user is claimed to be able to do runs as that user, under
-- `authenticated`, through the real policies — which is also what makes the
-- fan-out assertions meaningful: the rows they count were written by definer
-- triggers firing inside an ordinary user's transaction.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

-- ---------------------------------------------------------------------------
-- People. Ava owns a group; Bo is invited and accepts; Cy is already in it and
-- therefore learns that Bo arrived; Dee is invited and then un-invited, which
-- is AC-05. Ava also shares her looks, and Bo reacts to one.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ac-ava@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'ac-bo@example.test'),
  ('a0000000-0000-4000-8000-000000000003', 'ac-cy@example.test'),
  ('a0000000-0000-4000-8000-000000000004', 'ac-dee@example.test');

update public.profiles
   set social_terms_version = public.current_social_terms_version(),
       social_terms_at      = now()
 where user_id in (select id from auth.users where email like 'ac-%');

-- Mutual friendship with Ava, who is the only person who invites anybody here.
insert into public.follows (follower_id, followee_id) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004'),
  ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- 1-4 · The catalogue facts. No client may author an event.
-- ---------------------------------------------------------------------------

select is(
  (select relrowsecurity from pg_class
    where oid = 'public.activity_events'::regclass),
  true,
  '1 · activity_events has row level security enabled');

select is(
  has_table_privilege('authenticated', 'public.activity_events', 'INSERT'),
  false,
  '2 · authenticated has no INSERT grant — every row comes from the fan-out');

select is(
  has_table_privilege('anon', 'public.activity_events', 'SELECT'),
  false,
  '3 · anon cannot read the inbox at all');

select is(
  (select count(*)::int from pg_policy
    where polrelid = 'public.activity_events'::regclass
      and polcmd = 'a'),
  0,
  '4 · there is no INSERT policy — a client-authored event is unexpressible');

-- ---------------------------------------------------------------------------
-- 5-9 · The invitation fans out to the invitee, and to nobody else
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into public.circles (id, owner_id, name)
values ('c0000000-0000-4000-8000-00000000000a',
        'a0000000-0000-4000-8000-000000000001', 'Sunday Roasts');

-- Cy first, and accepted, so that Bo's later acceptance has an existing member
-- to be announced to.
insert into public.circle_members (circle_id, user_id, invited_by)
values ('c0000000-0000-4000-8000-00000000000a',
        'a0000000-0000-4000-8000-000000000003',
        'a0000000-0000-4000-8000-000000000001');

insert into public.circle_members (circle_id, user_id, invited_by)
values ('c0000000-0000-4000-8000-00000000000a',
        'a0000000-0000-4000-8000-000000000002',
        'a0000000-0000-4000-8000-000000000001');

-- Ava is the writer of both invitations and receives nothing for either: an
-- inbox that told you what you had just done would be a log, not an inbox.
select is(
  (select count(*)::int from public.activity_events),
  0,
  '5 · the inviter receives no row for an invitation she sent');

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.activity_events),
  1,
  '6 · the invitee reads exactly one row');

select is(
  (select event_type::text from public.activity_events),
  'circle.invite.received',
  '7 · and it is the invitation');

-- The denormalised name, which is what AC-05 renders after the group has
-- stopped being visible to this reader.
select is(
  (select payload ->> 'circle_name' from public.activity_events),
  'Sunday Roasts',
  '8 · the group name travels on the row, so a withdrawn invitation can be named');

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.activity_events),
  0,
  '9 · an unrelated user reads nothing — the row exists for one recipient only');

-- ---------------------------------------------------------------------------
-- 10-13 · Accepting: one row to the inviter, one to the room, and the
--         invitee's own notice goes inert
--
-- BO ACCEPTS FIRST, THEN CY, and the order is load-bearing. `circle.member
-- .joined` reaches every joined member EXCEPT the inviter, so the first person
-- into a group tells nobody — the owner is the only other member and they are
-- getting `circle.invite.accepted` instead. Only the second arrival has a room
-- to be announced to, which is what assertion 12 is checking.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
update public.circle_members set state = 'joined'
 where circle_id = 'c0000000-0000-4000-8000-00000000000a'
   and user_id   = 'a0000000-0000-4000-8000-000000000002';

select is(
  (select count(*)::int from public.activity_events
    where event_type = 'circle.invite.received' and revoked_at is not null),
  1,
  '10 · answering an invitation revokes the invitee''s own notice of it');

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
update public.circle_members set state = 'joined'
 where circle_id = 'c0000000-0000-4000-8000-00000000000a'
   and user_id   = 'a0000000-0000-4000-8000-000000000003';

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.activity_events
    where event_type = 'circle.invite.accepted'),
  2,
  '11 · the inviter is told about both acceptances, and only she is');

-- Bo was joined when Cy accepted. Ava was NOT sent a second row about Cy,
-- because `circle.invite.accepted` is the more specific of the two and two rows
-- for one arrival is the double-notification that makes people leave.
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.activity_events
    where event_type = 'circle.member.joined'),
  1,
  '12 · an existing member learns that somebody arrived');

select is(
  (select count(*)::int from public.activity_events
    where event_type = 'circle.invite.accepted'),
  0,
  '13 · but not that the invitation was accepted — that row is the inviter''s');

-- ---------------------------------------------------------------------------
-- 14-15 · AC-05 · a rescinded invitation is revoked, not deleted
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into public.circle_members (circle_id, user_id, invited_by)
values ('c0000000-0000-4000-8000-00000000000a',
        'a0000000-0000-4000-8000-000000000004',
        'a0000000-0000-4000-8000-000000000001');

update public.circle_members set state = 'removed'
 where circle_id = 'c0000000-0000-4000-8000-00000000000a'
   and user_id   = 'a0000000-0000-4000-8000-000000000004';

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.activity_events),
  1,
  '14 · the un-invited person still has the row — a notice that vanished would '
  'leave them wondering whether they imagined it');

select isnt(
  (select revoked_at from public.activity_events),
  null,
  '15 · and it is revoked, so AC-05 renders instead of a live Accept button');

-- ---------------------------------------------------------------------------
-- 16-20 · The two verbs a recipient has, and the eight columns they do not
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.activity_events
      (recipient_id, event_type, subject_type, subject_id)
    values ('a0000000-0000-4000-8000-000000000002', 'circle.invite.received',
            'circle', 'c0000000-0000-4000-8000-00000000000a')$$,
  '42501', null,
  '16 · a client cannot author an event, not even one addressed to itself');

select lives_ok(
  $$update public.activity_events set seen_at = now()
     where recipient_id = 'a0000000-0000-4000-8000-000000000002'$$,
  '17 · the recipient may stamp seen_at — this is the whole of "opening clears the dot"');

select throws_ok(
  $$update public.activity_events set event_type = 'circle.member.joined'
     where recipient_id = 'a0000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  '18 · but not rewrite what the event was');

select throws_ok(
  $$update public.activity_events set revoked_at = null
     where recipient_id = 'a0000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  '19 · and not un-revoke a withdrawn subject to bring its buttons back');

-- Re-assert the caller before writing.
--
-- `throws_ok` runs its statement inside a PL/pgSQL block with an EXCEPTION
-- handler, which is a subtransaction, and an aborted subtransaction restores
-- GUCs — `request.jwt.claims` among them — to whatever they were when it
-- opened. Tests 17-19 are three consecutive `throws_ok` calls, so by the time
-- control reaches this line `auth.uid()` is no longer reliably the recipient,
-- and the UPDATE below fails its WITH CHECK with "new row violates row-level
-- security policy" rather than the guard's own message. That failure is the
-- fixture losing its identity, not the policy being wrong.
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

-- The dismissal, and the fact the select policy hides it while the update
-- policy does not — which is exactly what makes the five-second undo possible.
update public.activity_events set dismissed_at = now()
 where recipient_id = 'a0000000-0000-4000-8000-000000000002'
   and event_type   = 'circle.invite.received';

select is(
  (select count(*)::int from public.activity_events
    where event_type = 'circle.invite.received'),
  0,
  '20 · a dismissed row leaves every read immediately');

-- ---------------------------------------------------------------------------
-- 21-22 · Nobody may touch anybody else's inbox
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

-- Cy runs the same two statements Bo just ran, against Bo's rows. Neither
-- raises — RLS filters rather than refuses — so the assertion is that nothing
-- moved.
update public.activity_events set seen_at = null
 where recipient_id = 'a0000000-0000-4000-8000-000000000002';
delete from public.activity_events
 where recipient_id = 'a0000000-0000-4000-8000-000000000002';

reset role;

-- Bo holds two rows: his own (now revoked, now dismissed) invitation notice,
-- and the arrival of Cy after him. Both were stamped at assertion 17.
select is(
  (select count(*)::int from public.activity_events
    where recipient_id = 'a0000000-0000-4000-8000-000000000002'
      and seen_at is not null),
  2,
  '21 · a stranger''s update reaches none of your rows');

select is(
  (select count(*)::int from public.activity_events
    where recipient_id = 'a0000000-0000-4000-8000-000000000002'),
  2,
  '22 · and a stranger''s delete removes none of them');

-- ---------------------------------------------------------------------------
-- 23-25 · Daily Social · the reaction, and taking it back
--
-- `now()` being transaction-constant is what makes this fixture legal without
-- disabling anything: `enforce_worn_outfits_boundary` stamps the boundary at
-- `now()`, the look is worn at `now()`, and the view demands
-- `worn_at >= boundary` — equal satisfies it. 18_daily_social.sql disables the
-- trigger because it is testing the boundary itself; this file is not.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

update public.profiles set worn_outfits_shared_since = now()
 where user_id = 'a0000000-0000-4000-8000-000000000001';

insert into public.outfits (id, user_id, name, worn_at)
values ('d0000000-0000-4000-8000-00000000000b',
        'a0000000-0000-4000-8000-000000000001', 'Thursday', now());

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

insert into public.daily_social_reactions (outfit_id, reactor_id, owner_id, reaction)
values ('d0000000-0000-4000-8000-00000000000b',
        'a0000000-0000-4000-8000-000000000002',
        'a0000000-0000-4000-8000-000000000001', 'sharp');

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  (select payload ->> 'reaction' from public.activity_events
    where event_type = 'daily.reaction.received'),
  'sharp',
  '23 · the look''s owner is told which of the three words was used');

-- Changing your mind updates the word and does not add a row: one live event
-- per pair, which is the same property the reactions table itself has.
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
update public.daily_social_reactions set reaction = 'cozy'
 where outfit_id = 'd0000000-0000-4000-8000-00000000000b';

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  (select payload ->> 'reaction' from public.activity_events
    where event_type = 'daily.reaction.received'),
  'cozy',
  '24 · reconsidering rewrites the word rather than adding a second row');

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
delete from public.daily_social_reactions
 where outfit_id = 'd0000000-0000-4000-8000-00000000000b';

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select isnt(
  (select revoked_at from public.activity_events
    where event_type = 'daily.reaction.received'),
  null,
  '25 · a reaction taken back revokes the notice — AC-05, for the other subject');

-- ---------------------------------------------------------------------------
-- 26 · Deleting the group takes its events with it
--
-- The other half of §7's revoke-or-cascade rule: when the CONTAINER goes there
-- is nothing left to explain, so the FK cascades rather than leaving a wall of
-- inert rows about a room that no longer exists.
-- ---------------------------------------------------------------------------

delete from public.circles where id = 'c0000000-0000-4000-8000-00000000000a';

reset role;

select is(
  (select count(*)::int from public.activity_events
    where circle_id = 'c0000000-0000-4000-8000-00000000000a'),
  0,
  '26 · deleting a group cascades every event that depended on it');

select * from finish();
rollback;
