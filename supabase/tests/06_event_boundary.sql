-- ===========================================================================
-- The event boundary: events, membership states, outfit posts, votes,
-- comments, moderation. (docs/social/architecture.md §8, second file.)
--
-- Everything event-scoped is members-only, and "member" means state='joined' —
-- an invitee can see the invite, not the room. The failure modes under test:
--
--   * a stranger reading any event surface (table or view);
--   * an invitee reading posts before joining;
--   * posting an outfit that belongs to someone else (composite FK);
--   * voting for yourself, or voting twice in one event;
--   * a hidden comment leaking to a third member;
--   * the host rewriting a member's words instead of flipping `hidden`
--     (the column-level grant is the fence);
--   * the definer-view write hole reopening on ANY projection view;
--   * a dateless occasion dropping out of the hosting cap, which would make
--     the free tier unlimited for anyone who skipped the date;
--   * anon acquiring any privilege on the feature's tables or views.
--
-- Seeds that cross RLS run as the acting user on purpose: the write paths
-- (create → invite → join → post → vote → comment) are themselves under test.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

-- ---------------------------------------------------------------------------
-- Seed people. Helen hosts; Maria and Nina attend; Ida stays invited;
-- Sasha is a stranger; Fern is Helen's mutual friend (for the friends-visible
-- event) — six roles the policies distinguish.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'helen@example.test'),
       ('22222222-2222-4222-8222-222222222222', 'maria@example.test'),
       ('33333333-3333-4333-8333-333333333333', 'nina@example.test'),
       ('44444444-4444-4444-8444-444444444444', 'ida@example.test'),
       ('55555555-5555-4555-8555-555555555555', 'sasha@example.test'),
       ('66666666-6666-4666-8666-666666666666', 'fern@example.test');

-- The terms columns are a precondition, not decoration: `assert_social_terms()`
-- (20260808101000) gates every social write below, events included.
insert into profiles (user_id, display_name, username, visibility,
                      social_terms_version, social_terms_at)
values ('11111111-1111-4111-8111-111111111111', 'Helen', 'helen', 'private',
        public.current_social_terms_version(), now()),
       ('22222222-2222-4222-8222-222222222222', 'Maria', 'maria', 'private',
        public.current_social_terms_version(), now()),
       ('33333333-3333-4333-8333-333333333333', 'Nina',  'nina',  'private',
        public.current_social_terms_version(), now()),
       ('44444444-4444-4444-8444-444444444444', 'Ida',   'ida',   'private',
        public.current_social_terms_version(), now()),
       ('55555555-5555-4555-8555-555555555555', 'Sasha', 'sasha', 'private',
        public.current_social_terms_version(), now()),
       ('66666666-6666-4666-8666-666666666666', 'Fern',  'fern',  'private',
        public.current_social_terms_version(), now())
on conflict (user_id) do update
  set display_name = excluded.display_name, username = excluded.username, visibility = excluded.visibility,
      social_terms_version = excluded.social_terms_version,
      social_terms_at      = excluded.social_terms_at;

-- Helen ↔ Fern are mutual friends.
insert into follows (follower_id, followee_id)
values ('11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666'),
       ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111');

-- One garment and one outfit each for Helen, Maria, Nina — plus a second,
-- never-posted outfit for Helen so the composite-FK probe below cannot trip
-- the (event_id, outfit_id) unique constraint first.
insert into items (id, user_id, category, thumb_path, cutout_path)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'dress',
        '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/thumb.jpg', null),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'top',
        '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/thumb.jpg', null),
       ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '33333333-3333-4333-8333-333333333333', 'bottom',
        '33333333-3333-4333-8333-333333333333/cccccccc-cccc-4ccc-8ccc-cccccccccccc/thumb.jpg', null);

insert into outfits (id, user_id, name)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 'Helen A'),
       ('99999999-9999-4999-8999-999999999999', '11111111-1111-4111-8111-111111111111', 'Helen B'),
       ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '22222222-2222-4222-8222-222222222222', 'Maria A'),
       ('ffffffff-ffff-4fff-8fff-ffffffffffff', '33333333-3333-4333-8333-333333333333', 'Nina A');

insert into outfit_items (outfit_id, item_id, user_id, position)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111', 1),
       ('99999999-9999-4999-8999-999999999999', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111', 1),
       ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '22222222-2222-4222-8222-222222222222', 1),
       ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '33333333-3333-4333-8333-333333333333', 1);

-- ---------------------------------------------------------------------------
-- The database copy of the hosting tiers, before anything else — this is the
-- tripwire that holds src/features/billing/plans.ts to the same numbers.
-- ---------------------------------------------------------------------------

select is(event_limit_for_plan('free'),     2,   'free hosting limit');
select is(event_limit_for_plan('standard'), 15,  'standard hosting limit');
select is(event_limit_for_plan('pro'),      100, 'pro hosting limit');

-- ---------------------------------------------------------------------------
-- Seed the event THROUGH the write path, as the people themselves.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

-- Helen creates the dinner (invite-only) and a friends-visible brunch.
insert into events (id, host_id, title, starts_at, visibility)
values ('abababab-abab-4bab-8bab-abababababab',
        '11111111-1111-4111-8111-111111111111',
        'Dinner at Rosemary''s', now() + interval '3 days', 'invite_only'),
       ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
        '11111111-1111-4111-8111-111111111111',
        'Saturday brunch', now() + interval '5 days', 'friends');

-- Helen invites Maria, Nina, Ida to the dinner.
insert into event_members (event_id, user_id, role, state, invited_by)
values ('abababab-abab-4bab-8bab-abababababab', '22222222-2222-4222-8222-222222222222',
        'attendee', 'invited', '11111111-1111-4111-8111-111111111111'),
       ('abababab-abab-4bab-8bab-abababababab', '33333333-3333-4333-8333-333333333333',
        'attendee', 'invited', '11111111-1111-4111-8111-111111111111'),
       ('abababab-abab-4bab-8bab-abababababab', '44444444-4444-4444-8444-444444444444',
        'attendee', 'invited', '11111111-1111-4111-8111-111111111111');

-- Maria and Nina accept; Ida never answers.
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
update event_members set state = 'joined'
 where event_id = 'abababab-abab-4bab-8bab-abababababab'
   and user_id  = '22222222-2222-4222-8222-222222222222';

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
update event_members set state = 'joined'
 where event_id = 'abababab-abab-4bab-8bab-abababababab'
   and user_id  = '33333333-3333-4333-8333-333333333333';

-- Maria, Helen, Nina each post a look; Nina and Maria comment.
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
insert into event_outfit_posts (id, event_id, user_id, outfit_id, caption)
values ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
        'abababab-abab-4bab-8bab-abababababab',
        '22222222-2222-4222-8222-222222222222',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'option A');
insert into event_comments (id, event_id, user_id, body)
values ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5',
        'abababab-abab-4bab-8bab-abababababab',
        '22222222-2222-4222-8222-222222222222', 'what are we thinking, table?');

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
insert into event_outfit_posts (id, event_id, user_id, outfit_id)
values ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
        'abababab-abab-4bab-8bab-abababababab',
        '11111111-1111-4111-8111-111111111111',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd');

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
insert into event_outfit_posts (id, event_id, user_id, outfit_id)
values ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
        'abababab-abab-4bab-8bab-abababababab',
        '33333333-3333-4333-8333-333333333333',
        'ffffffff-ffff-4fff-8fff-ffffffffffff');
insert into event_comments (id, event_id, user_id, body)
values ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
        'abababab-abab-4bab-8bab-abababababab',
        '33333333-3333-4333-8333-333333333333', 'hot take: the slip dress');

-- ---------------------------------------------------------------------------
-- The stranger. Zero rows on every event surface — filtered, never served.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',
  true
);

select is((select count(*) from events),             0::bigint, 'a stranger sees no events');
select is((select count(*) from event_members),      0::bigint, 'a stranger sees no rosters');
select is((select count(*) from event_outfit_posts), 0::bigint, 'a stranger sees no posts');
select is((select count(*) from event_outfit_votes), 0::bigint, 'a stranger sees no votes');
select is((select count(*) from event_comments),     0::bigint, 'a stranger sees no comments');
select is((select count(*) from event_post_items),   0::bigint, 'a stranger sees nothing through event_post_items');

-- ---------------------------------------------------------------------------
-- The invitee: sees the invite, not the room. joined ≠ invited.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);

select is(
  (select count(*) from events where id = 'abababab-abab-4bab-8bab-abababababab'),
  1::bigint,
  'an invitee can see the event she was invited to'
);
select is(
  (select count(*) from event_outfit_posts),
  0::bigint,
  'an invitee sees no posts until she joins — invited is not membership'
);

-- ---------------------------------------------------------------------------
-- The friends-visible event: discoverable by a friend (the stranger's zero
-- above already covered its invisibility to everyone else).
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}',
  true
);

select is(
  (select count(*) from events where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'),
  1::bigint,
  'a friend of the host can discover a friends-visible event'
);

-- ---------------------------------------------------------------------------
-- Posting: the composite FK makes another tenant's outfit unpostable.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select throws_ok(
  $$insert into event_outfit_posts (event_id, user_id, outfit_id)
    values ('abababab-abab-4bab-8bab-abababababab',
            '22222222-2222-4222-8222-222222222222',
            '99999999-9999-4999-8999-999999999999')$$,  -- Helen's outfit
  '23503',
  null,
  'posting someone else''s outfit dies on the composite FK — no (outfit_id, user_id) pair exists'
);

-- ---------------------------------------------------------------------------
-- Voting: one vote per member per event, never for yourself.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into event_outfit_votes (post_id, event_id, voter_id)
    values ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
            'abababab-abab-4bab-8bab-abababababab',
            '22222222-2222-4222-8222-222222222222')$$,
  '22023',
  null,
  'you cannot vote for your own outfit'
);

select lives_ok(
  $$insert into event_outfit_votes (post_id, event_id, voter_id)
    values ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
            'abababab-abab-4bab-8bab-abababababab',
            '22222222-2222-4222-8222-222222222222')$$,
  'a member votes for a co-member''s post'
);

select throws_ok(
  $$insert into event_outfit_votes (post_id, event_id, voter_id)
    values ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
            'abababab-abab-4bab-8bab-abababababab',
            '22222222-2222-4222-8222-222222222222')$$,
  '23505',
  null,
  'a second vote in the same event hits one_vote_per_event — changing your mind is delete + insert'
);

-- ---------------------------------------------------------------------------
-- The projection views work for members: tallies and garments.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

select is(
  (select votes from event_vote_counts
    where post_id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'),
  1::bigint,
  'event_vote_counts tallies the vote for every member'
);

select is(
  (select count(*) from event_post_items
    where event_id = 'abababab-abab-4bab-8bab-abababababab'),
  3::bigint,
  'event_post_items serves the garments inside all three posted looks'
);

-- ---------------------------------------------------------------------------
-- Moderation: the host flips `hidden` and nothing else; hidden comments stay
-- visible to their author and the host, invisible to the rest of the table.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select lives_ok(
  $$update event_comments set hidden = true
     where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'$$,
  'the host can hide a comment'
);

select throws_ok(
  $$update event_comments set body = 'edited by the host'
     where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'$$,
  '42501',
  null,
  'the host cannot rewrite a member''s words — UPDATE is granted on the hidden column only'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
select is(
  (select count(*) from event_comments
    where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'),
  0::bigint,
  'a hidden comment is invisible to a third member'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
select is(
  (select count(*) from event_comments
    where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'),
  1::bigint,
  'the author still sees her own hidden comment'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
select is(
  (select count(*) from event_comments
    where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'),
  1::bigint,
  'the host sees what she hid'
);

-- ---------------------------------------------------------------------------
-- Reports: the third distinct reporter auto-hides a comment until a human
-- looks (the graceful degradation of the 24h moderation commitment).
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',
  true
);
insert into content_reports (reporter_id, subject, subject_id, reason)
values ('55555555-5555-4555-8555-555555555555', 'comment',
        'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'harassment');

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);
insert into content_reports (reporter_id, subject, subject_id, reason)
values ('44444444-4444-4444-8444-444444444444', 'comment',
        'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'harassment');

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
select is(
  (select count(*) from event_comments
    where id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5'),
  1::bigint,
  'two reports mark a comment but do not hide it'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}',
  true
);
insert into content_reports (reporter_id, subject, subject_id, reason)
values ('66666666-6666-4666-8666-666666666666', 'comment',
        'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'harassment');

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
select is(
  (select count(*) from event_comments
    where id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5'),
  0::bigint,
  'the third distinct reporter auto-hides the comment'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
select is(
  (select count(*) from event_comments
    where id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5'),
  1::bigint,
  'the auto-hidden comment remains visible to its author'
);

-- ---------------------------------------------------------------------------
-- The dateless occasion (20260808130000). A name alone creates one, so an
-- event with no `starts_at` has to be storable, visible to the person whose
-- event it is, and — the one that actually costs money if it slips — still
-- counted by `enforce_event_limit()`. An undated occasion has no expiry to
-- compare against, and a cap that skipped it would be no cap at all.
--
-- Sasha hosts these. She owns no events above, so the free tier's two slots
-- are filled by exactly the two rows below and the third insert is the probe.
-- ---------------------------------------------------------------------------

-- Sasha's trial has to be expired first, or she is not on the free tier at all:
-- `handle_new_subscription()` gives every new account a live trial and
-- `effective_plan()` folds a live trial into `pro`, so her real cap would be
-- 100 and the probe below would never fire. Same pattern, same reason, as
-- 10_intake_boundary.sql:239. The update runs as postgres because
-- `subscriptions` has no client UPDATE policy — a plan is not self-serve.
reset role;
update subscriptions
   set plan = 'free', trial_ends_at = null
 where user_id = '55555555-5555-4555-8555-555555555555';
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into events (id, host_id, title, starts_at)
    values ('7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a',
            '55555555-5555-4555-8555-555555555555',
            'Sam''s birthday', null)$$,
  'an occasion with no date is storable — the atlas''s thinnest event'
);

select is(
  (select count(*) from events where id = '7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a'),
  1::bigint,
  'a dateless occasion is visible to its host'
);

-- The second fills Sasha's free tier; the third has to meet the trigger.
insert into events (id, host_id, title, starts_at)
values ('8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8b8b',
        '55555555-5555-4555-8555-555555555555',
        'Housewarming, date to come', null);

select throws_ok(
  $$insert into events (host_id, title, starts_at)
    values ('55555555-5555-4555-8555-555555555555', 'A third, still undated', null)$$,
  '23514',
  null,
  'a dateless occasion counts against the hosting limit — undated is not expired'
);

reset role;

-- ---------------------------------------------------------------------------
-- Catalogue tripwires. The definer-view write hole (20260805213000) must stay
-- fenced on EVERY projection view — asserted as a sweep, not a name list, so
-- the next view added is covered the day it is created.
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and c.relowner = 'postgres'::regrole
      and has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE')),
  null,
  'no view in public grants authenticated any write verb — a write grant on a definer view is a write with RLS off'
);

select is(
  (select array_agg(t order by t)
     from unnest(array['user_blocks','content_reports','borrow_requests','events',
                       'event_members','event_outfit_posts','event_outfit_votes',
                       'event_comments','social_profiles','friend_items',
                       'event_post_items','event_vote_counts','public_profiles',
                       'public_items','public_outfits','public_outfit_items',
                       'public_like_counts']) t
    where has_table_privilege('anon', 'public.' || quote_ident(t),
            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')),
  null,
  'anon holds no privilege of any kind on any social table or view — the signed-in-only decision (§1.5), in the catalogue'
);

select * from finish();
rollback;
