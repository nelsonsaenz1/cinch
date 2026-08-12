-- ===========================================================================
-- D-1 and D-2a: the thread closes and the board locks at `events.starts_at`,
-- and an UNDATED occasion does neither.
--
-- Migration 20260812120000. Everything under test here was a client-side
-- comparison until that file landed, which is why it gets its own boundary
-- test rather than a line in 06: the copy on two shipping surfaces now asserts
-- these refusals in as many words ("nothing new can be added", "the picks are
-- final"), so the day one of them silently stops holding is the day the app
-- starts lying.
--
-- The failure modes under test:
--
--   * commenting after the occasion has started;
--   * commenting on an occasion with NO date, which must still work — the
--     founder's ruling, and the whole difference between the two candidate
--     implementations of this rule;
--   * commenting before the start, which must be untouched;
--   * voting after the start;
--   * RETRACTING a vote after the start, which is the half a lock guarding
--     only INSERT would miss, since moving a pick is delete + insert;
--   * setting a date in the past, which must close both immediately;
--   * a block still retracting a harasser's votes after the start — safety
--     outranks the freeze, and the two deletes are told apart by whose act it
--     is, not by a flag.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- ---------------------------------------------------------------------------
-- Three people. Helen hosts both occasions; Maria and Nina attend.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'helen@example.test'),
       ('22222222-2222-4222-8222-222222222222', 'maria@example.test'),
       ('33333333-3333-4333-8333-333333333333', 'nina@example.test');

-- `on conflict … do update`, not a plain insert: handle_new_user() is an
-- AFTER INSERT trigger on auth.users and has ALREADY created each profile row.
-- Same clause as 09_event_block_filter.sql, for the same reason.
-- The terms columns are not decoration: `assert_social_terms()` (20260808101000)
-- gates every social write these nine assertions make, events included, so a
-- fixture without them fails at the first insert with `social_terms_required`
-- long before it reaches anything this file is about.
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

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

-- STARTED is in the past; UPCOMING is ahead; UNDATED has no date at all.
insert into events (id, host_id, title, starts_at, visibility)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111',
        'Last night', now() - interval '2 hours', 'invite_only'),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '11111111-1111-4111-8111-111111111111',
        'Next week', now() + interval '3 days', 'invite_only'),
       ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '11111111-1111-4111-8111-111111111111',
        'Someday', null, 'invite_only');

-- Invited, then accepted — not inserted as `joined`. The host's insert policy
-- (20260807101000:132) only permits `state = 'invited'`, and `is_event_member()`
-- only counts `joined`, so both halves are load-bearing: skip the invite and the
-- insert is refused, skip the accept and every vote fails on membership rather
-- than on the lock this file is testing.
insert into event_members (event_id, user_id, role, state, invited_by)
select e.id, u, 'attendee', 'invited', '11111111-1111-4111-8111-111111111111'
  from (values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
               ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid),
               ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid)) e(id),
       (values ('22222222-2222-4222-8222-222222222222'::uuid),
               ('33333333-3333-4333-8333-333333333333'::uuid)) m(u);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
update event_members set state = 'joined'
 where user_id = '22222222-2222-4222-8222-222222222222';

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
update event_members set state = 'joined'
 where user_id = '33333333-3333-4333-8333-333333333333';

-- ---------------------------------------------------------------------------
-- D-1 · comments
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select throws_ok(
  $$insert into event_comments (event_id, user_id, body)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '22222222-2222-4222-8222-222222222222', 'late thought')$$,
  'CL001',
  'the occasion has started, so the thread is closed',
  'a comment after starts_at is refused — the sentence "nothing new can be added" is now true'
);

select lives_ok(
  $$insert into event_comments (event_id, user_id, body)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            '22222222-2222-4222-8222-222222222222', 'looking forward')$$,
  'an upcoming occasion is untouched'
);

select lives_ok(
  $$insert into event_comments (event_id, user_id, body)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            '22222222-2222-4222-8222-222222222222', 'no date yet, still talking')$$,
  'an UNDATED occasion stays open — the founder''s ruling, and coalesce(starts_at, infinity) in one line'
);

-- ---------------------------------------------------------------------------
-- D-2a · votes. Nina posts a look on each; Maria picks.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

insert into outfits (id, user_id, name)
values ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
        '33333333-3333-4333-8333-333333333333', 'The wool one'),
       ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
        '33333333-3333-4333-8333-333333333333', 'The other one');

insert into event_outfit_posts (id, event_id, user_id, outfit_id)
values ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '33333333-3333-4333-8333-333333333333',
        'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'),
       ('e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '33333333-3333-4333-8333-333333333333',
        'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2');

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select throws_ok(
  $$insert into event_outfit_votes (post_id, event_id, voter_id)
    values ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '22222222-2222-4222-8222-222222222222')$$,
  'CL002',
  'the occasion has started, so the board is locked',
  'a pick after starts_at is refused'
);

select lives_ok(
  $$insert into event_outfit_votes (post_id, event_id, voter_id)
    values ('e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            '22222222-2222-4222-8222-222222222222')$$,
  'a pick on an upcoming board lands'
);

-- The occasion starts. A date moved into the past closes both immediately,
-- which falls out of the predicate rather than being a special case.
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
update events set starts_at = now() - interval '1 minute'
 where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select throws_ok(
  $$delete from event_outfit_votes
     where post_id  = 'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2'
       and voter_id = '22222222-2222-4222-8222-222222222222'$$,
  'CL002',
  'the occasion has started, so the board is locked',
  'RETRACTING after the start is refused too — moving a pick is delete + insert, so a lock on INSERT alone would be half a lock'
);

select throws_ok(
  $$insert into event_comments (event_id, user_id, body)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            '22222222-2222-4222-8222-222222222222', 'after the fact')$$,
  'CL001',
  'the occasion has started, so the thread is closed',
  'a host dating an occasion into the past closes its thread at once'
);

-- ---------------------------------------------------------------------------
-- Safety outranks the freeze
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

-- Nina blocks Maria, whose pick sits on Nina's own look on a LOCKED board.
select lives_ok(
  $$insert into user_blocks (blocker_id, blocked_id)
    values ('33333333-3333-4333-8333-333333333333',
            '22222222-2222-4222-8222-222222222222')$$,
  'blocking still works after an occasion has started'
);

select is(
  (select count(*) from event_outfit_votes
    where voter_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint,
  'and it still retracts their votes from the blocker''s looks — a locked board must never trap a harasser''s pick on somebody'
);

select * from finish();
rollback;
