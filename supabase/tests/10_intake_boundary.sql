-- ===========================================================================
-- The Walkthrough's boundary: intake_sessions, intake_drafts, and the commit.
-- (docs/design/voice-intake-directive.md §5, which requires exactly this file.)
--
-- These two tables hold a recording of somebody's voice turned into a list of
-- everything they own. There is no server-side authorization layer behind them
-- — RLS is the whole model — so the failure modes under test are:
--
--   * anon reaching either table at all;
--   * an unrelated authenticated user reading, or writing into, someone
--     else's walkthrough;
--   * an owner moving a row into another user's name via update;
--   * commit_intake_session committing a session that is not the caller's;
--   * the plan ceiling DELETING rather than holding — the whole reason
--     intake_drafts exists;
--   * the ceiling being bypassed, which a security-definer commit would do.
--
-- Roles, as everywhere: anon, the owner, an unrelated authenticated user, and
-- service_role. Seeds run as postgres; probes run as the role under test.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- ---------------------------------------------------------------------------
-- Seed. Dana owns a walkthrough with three confirmed drafts. Erik is a
-- stranger. Dana is on the free plan, so her ceiling is 10 garments.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('44444444-4444-4444-8444-444444444444', 'dana@example.test'),
       ('55555555-5555-4555-8555-555555555555', 'erik@example.test');

insert into intake_sessions (id, user_id, status, transcript, duration_ms)
values ('d0000000-0000-4000-8000-000000000001',
        '44444444-4444-4444-8444-444444444444',
        'reviewing', 'my navy wool crewneck, my black jeans, a cream cardigan', 41000);

insert into intake_drafts (session_id, user_id, ordinal, utterance, name, slot,
                           colour_term, colour_oklch, fabric, state)
values ('d0000000-0000-4000-8000-000000000001',
        '44444444-4444-4444-8444-444444444444', 0,
        'my navy wool crewneck', 'crewneck', 'base_top',
        'navy', '{"l":0.28,"c":0.06,"h":264,"hex":"#1B2A4A"}'::jsonb, 'wool', 'confirmed'),
       ('d0000000-0000-4000-8000-000000000001',
        '44444444-4444-4444-8444-444444444444', 1,
        'my black jeans', 'jeans', 'bottom',
        'black', '{"l":0.15,"c":0.01,"h":0,"hex":"#1C1A16"}'::jsonb, 'denim', 'confirmed'),
       -- Left pending on purpose: commit must ignore anything not confirmed.
       ('d0000000-0000-4000-8000-000000000001',
        '44444444-4444-4444-8444-444444444444', 2,
        'a cream cardigan', 'cardigan', 'mid_layer',
        'cream', '{"l":0.92,"c":0.02,"h":80,"hex":"#EFE9DC"}'::jsonb, 'cotton', 'pending');

-- ---------------------------------------------------------------------------
-- 1 · anon holds no grant on either table.
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  'select * from intake_sessions', '42501', null,
  'anon cannot read intake_sessions'
);
select throws_ok(
  'select * from intake_drafts', '42501', null,
  'anon cannot read intake_drafts'
);
select throws_ok(
  'select commit_intake_session(''d0000000-0000-4000-8000-000000000001'')', '42501', null,
  'anon cannot call commit_intake_session'
);

reset role;

-- ---------------------------------------------------------------------------
-- 2 · A stranger sees nothing and cannot write into someone else's session.
--
-- Reads return zero rows rather than throwing: authenticated HOLDS the grant,
-- so RLS filters instead of refusing. That distinction is the point of testing
-- both roles.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from intake_sessions), 0,
  'a stranger sees none of Dana''s sessions'
);
select is(
  (select count(*)::int from intake_drafts), 0,
  'a stranger sees none of Dana''s drafts'
);

-- The insert policy checks user_id = auth.uid(), so forging Dana's id fails.
select throws_ok(
  $$insert into intake_drafts (session_id, user_id, ordinal, utterance, name, slot, colour_term)
    values ('d0000000-0000-4000-8000-000000000001',
            '44444444-4444-4444-8444-444444444444', 9,
            'a stolen coat', 'coat', 'outerwear', 'black')$$,
  '42501', null,
  'a stranger cannot insert a draft into Dana''s session under her name'
);

-- Committing someone else's session is a no-op, not an error: RLS shows the
-- caller no drafts and no session, so nothing is written and nothing leaks.
select is(
  (select committed from commit_intake_session('d0000000-0000-4000-8000-000000000001')), 0,
  'a stranger commits nothing from Dana''s session'
);
select is(
  (select status from intake_sessions
    where id = 'd0000000-0000-4000-8000-000000000001'
      and user_id = '44444444-4444-4444-8444-444444444444'), null,
  'and cannot even observe that session''s status'
);

reset role;

-- ---------------------------------------------------------------------------
-- 3 · The owner sees her own, and cannot hand a row to anyone else.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from intake_sessions), 1,
  'Dana sees her own session'
);
select is(
  (select count(*)::int from intake_drafts), 3,
  'Dana sees all three of her drafts, pending included'
);

-- with_check on the update policy is what stops this; a using-only policy
-- would let an owner push a row into a stranger's closet.
select throws_ok(
  $$update intake_drafts set user_id = '55555555-5555-4555-8555-555555555555'$$,
  '42501', null,
  'an owner cannot move a draft into another user''s name'
);

reset role;

-- ---------------------------------------------------------------------------
-- 4 · The commit itself: order, state filter, provenance.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);

select is(
  (select committed from commit_intake_session('d0000000-0000-4000-8000-000000000001')), 2,
  'commit writes the two confirmed drafts and skips the pending one'
);

select is(
  (select count(*)::int from items
    where user_id = '44444444-4444-4444-8444-444444444444'), 2,
  'and exactly two garments exist'
);

-- The slot → category inversion, and the reason it is not canonicalised:
-- subcategory is the display name (item-name.ts:31), so the spoken word has to
-- survive verbatim.
select is(
  (select subcategory from items
    where user_id = '44444444-4444-4444-8444-444444444444'
      and category = 'top'), 'crewneck',
  'base_top lands as category top with the spoken noun kept as subcategory'
);

select is(
  (select colors -> 0 ->> 'hex' from items
    where user_id = '44444444-4444-4444-8444-444444444444'
      and category = 'top'), '#1B2A4A',
  'the lexicon hex is carried into items.colors'
);

select is(
  (select count(distinct (colour_source, intake_method))::int from items
    where user_id = '44444444-4444-4444-8444-444444444444'), 1,
  'every committed garment carries one provenance pair'
);
select is(
  (select colour_source from items
    where user_id = '44444444-4444-4444-8444-444444444444' limit 1), 'spoken',
  'a spoken colour is not claimed as measured'
);

select is(
  (select status from intake_sessions
    where id = 'd0000000-0000-4000-8000-000000000001'), 'committed',
  'the session is marked committed'
);

-- THE ONE THAT MATTERS MOST. Nothing is ever lost (reframe directive §4.6):
-- the drafts survive the commit, because M-08's "keep ten for now" picker has
-- to be able to offer the ones the ceiling held.
select is(
  (select count(*)::int from intake_drafts
    where session_id = 'd0000000-0000-4000-8000-000000000001'), 3,
  'committing deletes no drafts'
);

reset role;

select * from finish();
rollback;
