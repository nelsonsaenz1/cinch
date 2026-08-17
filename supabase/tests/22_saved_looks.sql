-- ===========================================================================
-- Saved looks — the boundary, the recheck, and the three things a save is not
-- allowed to be.
--
-- The `database` CI job is the only thing in this repository that observes RLS
-- at all: a broken policy typechecks, bundles and ships. So this file is the
-- only place the feature's central promises are ever actually checked, and
-- there are three of them:
--
--   1. A SAVE IS PRIVATE. Nobody but its owner can select, update or delete it
--      — assertions 12-15. Client-side filtering is not a promise; this is.
--   2. A SAVE CANNOT REACH WHAT ITS OWNER CANNOT SEE. The insert is refused for
--      an inaccessible source — 5, 6, 7 — and, once made, the row cannot be
--      re-pointed at a different one — 20-22. Without the second half the first
--      is a gate with a door beside it.
--   3. AVAILABILITY IS RECOMPUTED, NEVER REMEMBERED. 16-19 revoke a source that
--      was legitimately saved and read the same row back as `unavailable`, with
--      the note and the snapshot intact. This is the assertion a cached boolean
--      would fail, and the reason there is no such column.
--
-- Plus the structural one the design record asks for in as many words:
-- assertion 1, no foreign key from `saved_looks` to any garment relation.
--
-- TRAPS THIS FILE IS WRITTEN AROUND, all three already paid for by its
-- predecessors:
--
--   * `now()` is TRANSACTION-constant and this whole file is one transaction.
--     `friend_worn_outfits` has a seven-day window and a sharing boundary, so
--     the fixture writes `worn_outfits_shared_since` with the boundary trigger
--     DISABLED — otherwise the stamp and the wear share an instant and the
--     window is satisfied for the wrong reason (18_daily_social.sql:4-12).
--   * Profiles are made by `on_auth_user_created`. Nothing here inserts into
--     `public.profiles` — that is the duplicate-key error that cost
--     17_closet_visibility.sql two CI runs.
--   * `assert_social_terms` gates `events`, `event_members` and
--     `event_outfit_posts`, so acceptance is a precondition rather than
--     decoration. It does NOT gate `saved_looks`, deliberately and tested at
--     assertion 24: a save is a private note to yourself, not content anybody
--     else can read, so the gate that exists for shared surfaces would be a
--     terms wall in front of a diary.
--
-- Fixture writes that are not themselves under test run under `reset role`.
-- Everything a user is claimed to be able to do runs as that user, under
-- `authenticated`, through the real policies.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

-- ---------------------------------------------------------------------------
-- People. Ren keeps things; Ada shares a daily look and later stops; Kit hosts
-- an event Ren joins; Sasha is a stranger to everybody.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('51515151-5151-4151-8151-515151515151', 'sl-ren@example.test'),
  ('52525252-5252-4252-8252-525252525252', 'sl-ada@example.test'),
  ('53535353-5353-4353-8353-535353535353', 'sl-kit@example.test'),
  ('54545454-5454-4454-8454-545454545454', 'sl-sasha@example.test');

update public.profiles
   set social_terms_version = public.current_social_terms_version(),
       social_terms_at      = now()
 where user_id in (select id from auth.users where email like 'sl-%');

-- Ren is mutual with Ada and with Kit. Sasha is mutual with nobody.
insert into public.follows (follower_id, followee_id) values
  ('51515151-5151-4151-8151-515151515151', '52525252-5252-4252-8252-525252525252'),
  ('52525252-5252-4252-8252-525252525252', '51515151-5151-4151-8151-515151515151'),
  ('51515151-5151-4151-8151-515151515151', '53535353-5353-4353-8353-535353535353'),
  ('53535353-5353-4353-8353-535353535353', '51515151-5151-4151-8151-515151515151');

insert into public.items (id, user_id, category) values
  ('a5a5a5a5-a5a5-45a5-85a5-a5a5a5a5a5a5', '52525252-5252-4252-8252-525252525252', 'top');

-- Ada's sharing boundary, written with the trigger off so it is genuinely
-- BEFORE the wear rather than the same transaction instant.
alter table public.profiles disable trigger profiles_worn_outfits_boundary;
update public.profiles set worn_outfits_shared_since = now() - interval '1 hour'
 where user_id = '52525252-5252-4252-8252-525252525252';

insert into public.outfits (id, user_id, name, worn_at) values
  -- Ada's, shared and inside the window: a legitimate `daily_look` source.
  ('b5b5b5b5-b5b5-45b5-85b5-b5b5b5b5b5b5', '52525252-5252-4252-8252-525252525252',
   'Rust cord and cream knit', now() - interval '20 minutes'),
  -- Ren's own: an `own_outfit` source, and never shared with anybody.
  ('b6b6b6b6-b6b6-46b6-86b6-b6b6b6b6b6b6', '51515151-5151-4151-8151-515151515151',
   'Camel coat monochrome', now() - interval '2 days'),
  -- Kit's, posted to the event below.
  ('b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7', '53535353-5353-4353-8353-535353535353',
   'Navy suit', now() - interval '3 days');

-- The event, and Ren joining it. `assert_post_is_member` requires the poster to
-- be joined, and `is_event_member` is what `can_save_source` asks about Ren.
insert into public.events (id, host_id, title, starts_at)
values ('e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5',
        '53535353-5353-4353-8353-535353535353', 'Kit''s dinner', now() + interval '1 day');
insert into public.event_members (event_id, user_id, role, state, invited_by) values
  ('e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5', '51515151-5151-4151-8151-515151515151',
   'attendee', 'joined', '53535353-5353-4353-8353-535353535353');
-- The post needs Kit to be the CALLER, not merely the poster.
--
-- `assert_post_is_member` is a BEFORE INSERT trigger, and triggers fire for
-- superusers even though RLS does not — so running this fixture under `reset
-- role` does not skip it. It asks `is_event_member(new.event_id)`, which is
-- `where user_id = auth.uid() and state = 'joined'` — the CURRENT CALLER, never
-- `new.user_id`. With no claim set, `auth.uid()` is null, nobody is a member,
-- and the insert dies with "join the event before posting".
--
-- Kit already has a joined membership row (the events insert writes the host
-- one; adding another raises a duplicate on `event_members_pkey`), so the only
-- thing missing is the identity. Claim it for this statement and drop it again.
select set_config('request.jwt.claims',
  '{"sub":"53535353-5353-4353-8353-535353535353","role":"authenticated"}', true);

insert into public.event_outfit_posts (id, event_id, user_id, outfit_id)
values ('40404040-4040-4040-8040-404040404040', 'e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5',
        '53535353-5353-4353-8353-535353535353', 'b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7');

select set_config('request.jwt.claims', '', true);

-- Ren's collection. A BOARD, because a collection is a board — the one
-- structural decision the migration makes, asserted at 23 rather than assumed.
insert into public.boards (id, user_id, name)
values ('c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5',
        '51515151-5151-4151-8151-515151515151', 'Fall layering');

-- ---------------------------------------------------------------------------
-- 1 · The structural promise, before anybody writes a row
--
-- "No garment-level rows, sizes, links, or closet items are copied into
-- `saved_look`." A comment cannot keep that; a catalogue query can. `items` and
-- `outfit_items` are the two garment relations, and `saved_looks` must not
-- reference either — nor `outfits`, whose `source_id` link is deliberately not
-- a foreign key at all so that a deleted source cannot take a private note with
-- it.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int
     from pg_constraint c
     join pg_class t on t.oid = c.confrelid
    where c.conrelid = 'public.saved_looks'::regclass
      and c.contype  = 'f'
      and t.relname in ('items', 'outfit_items', 'outfits')),
  0,
  '1 · a save has no foreign key to any garment or outfit relation — it is a pointer, never a copy');

-- ---------------------------------------------------------------------------
-- 2-8 · What Ren may save, as Ren
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"51515151-5151-4151-8151-515151515151","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.saved_looks
      (id, owner_id, source_type, source_id, source_owner_id,
       snap_source_label, snap_source_visibility, snap_saved_at, note)
    values ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
            '51515151-5151-4151-8151-515151515151', 'daily_look',
            'b5b5b5b5-b5b5-45b5-85b5-b5b5b5b5b5b5',
            '52525252-5252-4252-8252-525252525252',
            'Ada''s Daily look', 'Visible to your Circle', now(),
            'Try with my brown boots.')$$,
  '2 · a friend-visible daily look can be saved');

select lives_ok(
  $$insert into public.saved_looks
      (id, owner_id, source_type, source_id, source_owner_id,
       snap_source_label, snap_source_visibility, snap_saved_at)
    values ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
            '51515151-5151-4151-8151-515151515151', 'own_outfit',
            'b6b6b6b6-b6b6-46b6-86b6-b6b6b6b6b6b6',
            '51515151-5151-4151-8151-515151515151',
            'Your outfit', 'Private', now())$$,
  '3 · so can one of your own');

select lives_ok(
  $$insert into public.saved_looks
      (id, owner_id, source_type, source_id, source_owner_id,
       snap_source_label, snap_source_visibility, snap_saved_at)
    values ('d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3',
            '51515151-5151-4151-8151-515151515151', 'event_look',
            '40404040-4040-4040-8040-404040404040',
            '53535353-5353-4353-8353-535353535353',
            'Kit''s event', 'Event look', now())$$,
  '4 · and a look posted to an event you are in');

-- The three refusals. Each is a different branch of `can_save_source`, and each
-- is the INSERT policy doing the work rather than the client having declined to
-- offer a button.
select throws_ok(
  $$insert into public.saved_looks
      (owner_id, source_type, source_id, snap_source_label,
       snap_source_visibility, snap_saved_at)
    values ('51515151-5151-4151-8151-515151515151', 'own_outfit',
            'b5b5b5b5-b5b5-45b5-85b5-b5b5b5b5b5b5',
            'Not yours', 'Private', now())$$,
  '42501', null,
  '5 · somebody else''s outfit is not an "own outfit", whatever the client claims');

select throws_ok(
  $$insert into public.saved_looks
      (owner_id, source_type, source_id, snap_source_label,
       snap_source_visibility, snap_saved_at)
    values ('51515151-5151-4151-8151-515151515151', 'daily_look',
            'b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7',
            'Kit''s look', 'Visible to your Circle', now())$$,
  '42501', null,
  '6 · an outfit its owner never shared to Daily cannot be saved as a daily look');

select throws_ok(
  $$insert into public.saved_looks
      (owner_id, source_type, source_id, snap_source_label,
       snap_source_visibility, snap_saved_at)
    values ('51515151-5151-4151-8151-515151515151', 'daily_look',
            '00000000-0000-4000-8000-000000000000',
            'Nothing', 'Private', now())$$,
  '42501', null,
  '7 · and a source id that was never real is refused exactly like one that was — no existence oracle');

select throws_ok(
  $$insert into public.saved_looks
      (owner_id, source_type, source_id, snap_source_label,
       snap_source_visibility, snap_saved_at)
    values ('51515151-5151-4151-8151-515151515151', 'daily_look',
            'b5b5b5b5-b5b5-45b5-85b5-b5b5b5b5b5b5',
            'Ada''s Daily look', 'Visible to your Circle', now())$$,
  '23505', null,
  '8 · one save per source per person — the duplicate state is the database''s, not the interface''s');

-- ---------------------------------------------------------------------------
-- 9-11 · Availability, while everything is still visible
-- ---------------------------------------------------------------------------

select is(
  (select availability from public.saved_looks_resolved
    where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'),
  'available',
  '9 · a save whose source is still visible reads as available');

select is(
  (select count(*)::int from public.saved_looks_resolved
    where availability = 'available'),
  3,
  '10 · all three sources resolve — own outfit, daily look, event look');

select lives_ok(
  $$update public.saved_looks
       set collection_id = 'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5',
           note = 'Loved the boot pairing.'
     where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'$$,
  '11 · the note and the collection are what an update is for');

-- ---------------------------------------------------------------------------
-- 12-15 · Private. The promise the whole feature rests on.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"54545454-5454-4454-8454-545454545454","role":"authenticated"}', true);

select is((select count(*)::int from public.saved_looks), 0,
  '12 · a stranger reads no save at all');
select is((select count(*)::int from public.saved_looks_resolved), 0,
  '13 · and none through the resolved view either — the view is security_invoker, so RLS still applies');

-- A refused UPDATE and a refused DELETE do not raise; they match no row. The
-- assertion is therefore on what SURVIVES, which is the fact that matters.
update public.saved_looks set note = 'mine now'
 where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
delete from public.saved_looks
 where id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2';

-- Ada is not a stranger — she is the SOURCE OWNER, and she still gets nothing.
-- A save is a private note the reader made about a look; the person whose look
-- it was is not entitled to know it was kept, which is the clause that
-- distinguishes this from every "who saved my post" surface.
select set_config('request.jwt.claims',
  '{"sub":"52525252-5252-4252-8252-525252525252","role":"authenticated"}', true);

select is((select count(*)::int from public.saved_looks), 0,
  '14 · not even the source owner learns that their look was kept');

select set_config('request.jwt.claims',
  '{"sub":"51515151-5151-4151-8151-515151515151","role":"authenticated"}', true);

select is(
  (select note || '|' || count(*) over () from public.saved_looks
    where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'),
  'Loved the boot pairing.|3',
  '15 · so the stranger''s update and delete both did nothing — three rows, note unchanged');

-- ---------------------------------------------------------------------------
-- 16-19 · The revocation. OS-06, as a database fact.
-- ---------------------------------------------------------------------------

reset role;
-- Ada turns worn-outfit sharing off. One column, and it is the whole control.
update public.profiles set worn_outfits_shared_since = null
 where user_id = '52525252-5252-4252-8252-525252525252';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"51515151-5151-4151-8151-515151515151","role":"authenticated"}', true);

select is(
  (select availability from public.saved_looks_resolved
    where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'),
  'unavailable',
  '16 · a revoked source reads unavailable on the very next read — nothing was invalidated, nothing swept');

select is(
  (select note from public.saved_looks_resolved
    where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'),
  'Loved the boot pairing.',
  '17 · and the owner''s own note survives it — "Keep note only" is a state the schema already holds');

select is(
  (select snap_source_label from public.saved_looks_resolved
    where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'),
  'Ada''s Daily look',
  '18 · as does the snapshot, which is why OS-06 can still name whose look it was');

-- The other half of the same rule: a source that has gone away cannot be saved
-- afresh. Unavailable is a state a save ARRIVES at, never one it is born in.
select throws_ok(
  $$insert into public.saved_looks
      (owner_id, source_type, source_id, snap_source_label,
       snap_source_visibility, snap_saved_at)
    values ('51515151-5151-4151-8151-515151515151', 'daily_look',
            'b5b5b5b5-b5b5-45b5-85b5-b5b5b5b5b5b5',
            'Ada''s Daily look', 'Visible to your Circle', now())$$,
  '23505', null,
  '19 · and the row that already exists is what a re-save meets — never a second, unauthorised one');

-- ---------------------------------------------------------------------------
-- 20-22 · The row cannot be re-pointed
--
-- The INSERT policy checks access on the way in and there is no second gate
-- behind it, so an owner who could rewrite `source_id` could point a save they
-- legitimately hold at a source they were never allowed to see. The trigger is
-- what closes that, and these three are why it exists rather than being tidy.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.saved_looks set source_id = 'b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7'
     where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'$$,
  '42501', null,
  '20 · a save cannot be re-pointed at another source — the access check is on INSERT and there is no second one');

select throws_ok(
  $$update public.saved_looks set source_type = 'own_outfit'
     where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'$$,
  '42501', null,
  '21 · nor re-typed, which would send the recheck down a different branch');

select throws_ok(
  $$update public.saved_looks set snap_source_label = 'Your outfit'
     where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'$$,
  '42501', null,
  '22 · and the snapshot is evidence of a moment, so it is not editable either');

-- ---------------------------------------------------------------------------
-- 23-25 · Collections are boards, and a save is not shared content
-- ---------------------------------------------------------------------------

-- OS-05c: "The N looks inside stay in Saved." That sentence is `on delete set
-- null`, and it is the reason `boards` was reused rather than a second table
-- being invented to say the same thing in a different word.
delete from public.boards where id = 'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5';

select is(
  (select count(*)::int from public.saved_looks
    where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1' and collection_id is null),
  1,
  '23 · deleting a collection detaches its looks and deletes none of them');

-- No terms gate, and that is deliberate rather than forgotten. `events`,
-- `event_members`, `event_outfit_posts`, `follows`, `circles` and
-- `circle_members` all carry `assert_social_terms` because each of them creates
-- content somebody else reads or joins someone to a shared space. A save does
-- neither: assertion 14 is the proof that nobody else can ever read it.
select is(
  (select count(*)::int
     from pg_trigger
    where tgrelid = 'public.saved_looks'::regclass
      and not tgisinternal
      and tgfoid = 'public.assert_social_terms'::regproc),
  0,
  '24 · a save is not gated by the social terms — it is a private note, not shared content');

select lives_ok(
  $$delete from public.saved_looks
     where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'$$,
  '25 · and the owner can always remove their own save, available or not');

select * from finish();
rollback;
