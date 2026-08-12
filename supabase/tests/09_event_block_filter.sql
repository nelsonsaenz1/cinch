-- ===========================================================================
-- The block screen inside a shared event. (docs/social/architecture.md §8.)
--
-- 06_event_boundary.sql proves the event walls hold against people OUTSIDE
-- the room. This file proves they hold between two people INSIDE it who have
-- blocked each other — the App Store Guideline 1.2 gap the release audit
-- found, where `blocked_between` was screening every friend and profile
-- surface but none of the event-content ones. The failure modes under test:
--
--   * a blocked woman's look still on the board;
--   * her words still in the thread;
--   * her signed pick still readable, or still counted in a tally;
--   * her garments still served by `event_post_items`, whose SECURITY DEFINER
--     WHERE clause does not inherit the base tables' policies;
--   * the screen working in only one direction (it is mutual by design —
--     `blocked_between` is symmetric, the block itself is one-way and silent);
--   * the screen splashing onto an unrelated third member;
--   * a pick stranded on a look its own voter can no longer see — one pick per
--     event, so a stranded one is a woman who can never pick again;
--   * `outfit_post` not being a reportable subject, which is the other half of
--     the same guideline: report AND block, on every piece of user content.
--
-- Seeds that cross RLS run as the acting user on purpose, as in 06: the write
-- paths are themselves part of what is under test.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- ---------------------------------------------------------------------------
-- Seed people. Helen hosts; Maria and Nina attend. Maria will block Nina, so
-- Helen is the control: a member related to both and blocked by neither.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'helen@example.test'),
       ('22222222-2222-4222-8222-222222222222', 'maria@example.test'),
       ('33333333-3333-4333-8333-333333333333', 'nina@example.test');

-- `on conflict … do update`, not a plain insert: handle_new_user() is an
-- AFTER INSERT trigger on auth.users and has ALREADY created each profile row.
-- The terms columns are not decoration: `assert_social_terms()` (20260808101000)
-- gates every social write this file seeds through, events included, so a
-- fixture without them fails at the first insert with `social_terms_required`.
insert into profiles (user_id, display_name, username, visibility,
                      social_terms_version, social_terms_at)
values ('11111111-1111-4111-8111-111111111111', 'Helen', 'helen', 'private',
        public.current_social_terms_version(), now()),
       ('22222222-2222-4222-8222-222222222222', 'Maria', 'maria', 'private',
        public.current_social_terms_version(), now()),
       ('33333333-3333-4333-8333-333333333333', 'Nina',  'nina',  'private',
        public.current_social_terms_version(), now())
on conflict (user_id) do update
  set display_name = excluded.display_name, username = excluded.username,
      visibility = excluded.visibility,
      social_terms_version = excluded.social_terms_version,
      social_terms_at      = excluded.social_terms_at;

-- One garment and one outfit each — `event_post_items` joins through both, so
-- the garment count is what proves the projection view screens too.
insert into items (id, user_id, category, thumb_path, cutout_path)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'dress',
        '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/thumb.jpg', null),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'top',
        '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/thumb.jpg', null),
       ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '33333333-3333-4333-8333-333333333333', 'bottom',
        '33333333-3333-4333-8333-333333333333/cccccccc-cccc-4ccc-8ccc-cccccccccccc/thumb.jpg', null);

insert into outfits (id, user_id, name)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 'Helen A'),
       ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '22222222-2222-4222-8222-222222222222', 'Maria A'),
       ('ffffffff-ffff-4fff-8fff-ffffffffffff', '33333333-3333-4333-8333-333333333333', 'Nina A');

insert into outfit_items (outfit_id, item_id, user_id, position)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111', 1),
       ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '22222222-2222-4222-8222-222222222222', 1),
       ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '33333333-3333-4333-8333-333333333333', 1);

-- ---------------------------------------------------------------------------
-- Seed the room THROUGH the write path, as the people themselves.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

insert into events (id, host_id, title, starts_at, visibility)
values ('abababab-abab-4bab-8bab-abababababab',
        '11111111-1111-4111-8111-111111111111',
        'Dinner at Rosemary''s', now() + interval '3 days', 'invite_only');

insert into event_members (event_id, user_id, role, state, invited_by)
values ('abababab-abab-4bab-8bab-abababababab', '22222222-2222-4222-8222-222222222222',
        'attendee', 'invited', '11111111-1111-4111-8111-111111111111'),
       ('abababab-abab-4bab-8bab-abababababab', '33333333-3333-4333-8333-333333333333',
        'attendee', 'invited', '11111111-1111-4111-8111-111111111111');

-- Helen posts her look and opens the thread.
insert into event_outfit_posts (id, event_id, user_id, outfit_id)
values ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
        'abababab-abab-4bab-8bab-abababababab',
        '11111111-1111-4111-8111-111111111111',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
insert into event_comments (id, event_id, user_id, body)
values ('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1',
        'abababab-abab-4bab-8bab-abababababab',
        '11111111-1111-4111-8111-111111111111', 'wear whatever you love');

-- Maria joins, posts, comments, and picks Nina's look (the pick that the
-- block must retract rather than strand).
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
update event_members set state = 'joined'
 where event_id = 'abababab-abab-4bab-8bab-abababababab'
   and user_id  = '22222222-2222-4222-8222-222222222222';
insert into event_outfit_posts (id, event_id, user_id, outfit_id, caption)
values ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
        'abababab-abab-4bab-8bab-abababababab',
        '22222222-2222-4222-8222-222222222222',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'option A');
insert into event_comments (id, event_id, user_id, body)
values ('e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2',
        'abababab-abab-4bab-8bab-abababababab',
        '22222222-2222-4222-8222-222222222222', 'what are we thinking, table?');

-- Nina joins, posts, comments, and picks Helen's look (a pick OUTSIDE the
-- blocked pair — it must survive the block untouched).
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
update event_members set state = 'joined'
 where event_id = 'abababab-abab-4bab-8bab-abababababab'
   and user_id  = '33333333-3333-4333-8333-333333333333';
insert into event_outfit_posts (id, event_id, user_id, outfit_id)
values ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
        'abababab-abab-4bab-8bab-abababababab',
        '33333333-3333-4333-8333-333333333333',
        'ffffffff-ffff-4fff-8fff-ffffffffffff');
insert into event_comments (id, event_id, user_id, body)
values ('f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3',
        'abababab-abab-4bab-8bab-abababababab',
        '33333333-3333-4333-8333-333333333333', 'hot take: the slip dress');
insert into event_outfit_votes (post_id, event_id, voter_id)
values ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
        'abababab-abab-4bab-8bab-abababababab',
        '33333333-3333-4333-8333-333333333333');

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
insert into event_outfit_votes (post_id, event_id, voter_id)
values ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
        'abababab-abab-4bab-8bab-abababababab',
        '22222222-2222-4222-8222-222222222222');

-- ---------------------------------------------------------------------------
-- Maria blocks Nina. Nothing else changes: both stay joined members of the
-- same event, which is exactly the situation the old policies missed.
-- ---------------------------------------------------------------------------

insert into user_blocks (blocker_id, blocked_id)
values ('22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333');

-- ---------------------------------------------------------------------------
-- The blocker's board.
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from event_outfit_posts
    where user_id = '33333333-3333-4333-8333-333333333333'),
  0::bigint,
  'a blocked woman''s look leaves the blocker''s board'
);
select is(
  (select count(*) from event_outfit_posts),
  2::bigint,
  'the rest of the board is untouched — the host''s look and her own'
);
select is(
  (select count(*) from event_comments
    where user_id = '33333333-3333-4333-8333-333333333333'),
  0::bigint,
  'her words go with her'
);
select is(
  (select count(*) from event_comments),
  2::bigint,
  'the rest of the table still talks'
);
select is(
  (select count(*) from event_outfit_votes
    where voter_id = '33333333-3333-4333-8333-333333333333'),
  0::bigint,
  'her signed pick is unreadable to the blocker'
);
select is(
  (select count(*) from event_post_items
    where post_id = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'),
  0::bigint,
  'event_post_items serves none of her garments — the definer view screens too'
);
select is(
  (select count(*) from event_post_items),
  2::bigint,
  'event_post_items still serves every other look in the room'
);
select is(
  (select count(*) from event_vote_counts
    where post_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'),
  0::bigint,
  'her pick is gone from the tally the blocker reads, not merely from the names'
);

-- The ROSTER, which was the fifth read path and the one 20260807120000 left
-- behind. Without `20260810150100_event_roster_block_filter.sql` the row below
-- is still served: `social_profiles` screens the name and the avatar, so what
-- the blocker gets is a nameless person seated at an event she is attending,
-- and a going-count that includes her. This is the assertion that was missing
-- when the migration was written, which is how it went unapplied unnoticed.
select is(
  (select count(*) from event_members
    where user_id = '33333333-3333-4333-8333-333333333333'),
  0::bigint,
  'a blocked woman leaves the blocker''s guest list, not just the board'
);
select is(
  (select count(*) from event_members),
  2::bigint,
  'the roster still seats the host and the blocker herself'
);
select is(
  (select count(*) from event_members
    where user_id = '22222222-2222-4222-8222-222222222222'),
  1::bigint,
  'her own row survives — nobody can block herself, so the screen cannot eat it'
);

-- ---------------------------------------------------------------------------
-- The blocked woman's board. The block is one-way and silent, but the SCREEN
-- is mutual: she is not shown the person who blocked her either.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

select is(
  (select count(*) from event_outfit_posts
    where user_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint,
  'the screen is mutual — the blocked woman sees no look of the blocker''s'
);
select is(
  (select count(*) from event_outfit_posts),
  2::bigint,
  'she keeps the host''s look and her own'
);
select is(
  (select count(*) from event_comments
    where user_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint,
  'and none of the blocker''s words'
);
select is(
  (select count(*) from event_members
    where user_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint,
  'nor the blocker''s seat on the guest list — the roster screen is mutual too'
);
select is(
  (select count(*) from event_members),
  2::bigint,
  'she keeps the host''s seat and her own'
);

-- ---------------------------------------------------------------------------
-- The third member. A block between two attendees is invisible to everyone
-- else — the room is not diminished for people who are not in the quarrel.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select is(
  (select count(*) from event_outfit_posts),
  3::bigint,
  'an unrelated member still sees the whole board'
);
select is(
  (select count(*) from event_comments),
  3::bigint,
  'and the whole thread'
);
select is(
  (select count(*) from event_post_items),
  3::bigint,
  'and every garment in it'
);
select is(
  (select count(*) from event_members),
  3::bigint,
  'and the whole guest list — a quarrel between two attendees does not thin the room'
);
select is(
  (select votes from event_vote_counts
    where post_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'),
  1::bigint,
  'a pick from outside the blocked pair survives the block, and still tallies'
);
select is(
  (select count(*) from event_outfit_votes
    where post_id = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'),
  0::bigint,
  'blocking retracted the pick BETWEEN the pair — one pick per event, never stranded'
);

-- ---------------------------------------------------------------------------
-- Report, the other half of Guideline 1.2: a look is reportable in its own
-- right, not only its comments. `outfit_post` has been in `report_subject`
-- since 20260807100000; this is the tripwire that keeps it there.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into content_reports (reporter_id, subject, subject_id, subject_user, reason)
    values ('11111111-1111-4111-8111-111111111111', 'outfit_post',
            'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
            '22222222-2222-4222-8222-222222222222', 'Inappropriate content')$$,
  'a member can report a posted look — subject ''outfit_post'' is on the enum'
);

select is(
  (select count(*) from content_reports
    where subject = 'outfit_post'
      and reporter_id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  'the report is on file for its reporter, and for the operator queue'
);

select * from finish();
rollback;
