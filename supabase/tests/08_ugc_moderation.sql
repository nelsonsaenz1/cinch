-- ===========================================================================
-- The two Guideline 1.2 gates: the text filter (20260808100000) and the terms
-- gate (20260808101000).
--
-- Both live in triggers rather than in application code, so a test here is the
-- only thing that can see them fail. The failure modes under test:
--
--   * a client reading, or writing, the denylist itself;
--   * a blocked word getting through by case, leetspeak, held-down keys, or
--     spacing;
--   * the filter over-reaching — "Scunthorpe", "assassin", "class" — which is
--     the failure that silently ruins real users' posts and never gets
--     reported as a bug;
--   * a user posting, joining, voting or commenting without having accepted
--     the terms;
--   * the terms gate reaching a surface it must never reach: blocking and
--     reporting have to work for someone who has accepted nothing.
--
-- Roles, as everywhere: anon, the participants, an unrelated authenticated
-- user. Seeds run as postgres; the probes run as the role under test — which
-- matters more than usual here, because both triggers deliberately no-op for
-- any role other than `authenticated`.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

-- ---------------------------------------------------------------------------
-- Seed. Dana hosts an event Erin has joined. Dana has accepted the terms;
-- Erin has not, which is what makes her the interesting one.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('44444444-4444-4444-8444-444444444444', 'dana@example.test'),
       ('55555555-5555-4555-8555-555555555555', 'erin@example.test');

insert into profiles (user_id, display_name, username, visibility,
                      social_terms_version, social_terms_at)
values ('44444444-4444-4444-8444-444444444444', 'Dana', 'dana', 'private',
        public.current_social_terms_version(), now()),
       ('55555555-5555-4555-8555-555555555555', 'Erin', 'erin', 'private',
        null, null)
on conflict (user_id) do update
  set display_name         = excluded.display_name,
      username             = excluded.username,
      visibility           = excluded.visibility,
      social_terms_version = excluded.social_terms_version,
      social_terms_at      = excluded.social_terms_at;

insert into events (id, host_id, title, starts_at)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '44444444-4444-4444-8444-444444444444',
        'Rooftop dinner', now() + interval '2 days');

-- Cora's host row is NOT seeded here: `handle_new_event()` (20260807101000)
-- makes the host a member from birth, with exactly this role and state, so
-- restating it collides on `event_members_pkey`.
insert into event_members (event_id, user_id, role, state)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '55555555-5555-4555-8555-555555555555', 'attendee', 'joined');

-- A sentinel the real list will never contain, so these tests keep passing
-- whatever the operator loads into moderation_terms later.
insert into moderation_terms (term, match_squeezed, note)
values ('zzblockedzz', true, 'test sentinel');

-- A comment already in the table whose body matches the sentinel. Seeds run as
-- postgres, which the filter deliberately does not guard, so this stands in for
-- the ordinary case: the comment was written, and the denylist grew afterwards.
insert into event_comments (id, event_id, user_id, body)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '55555555-5555-4555-8555-555555555555', 'zzblockedzz');

-- ---------------------------------------------------------------------------
-- The denylist is not client-readable. A readable list is a bypass manual.
-- ---------------------------------------------------------------------------
-- Asserted as a REFUSAL, not as an empty read. `moderation_terms` carries no
-- client grants at all (20260808100000:225, "Intentional, and the point"), so
-- a client select raises 42501 before RLS is ever consulted — which is the
-- stronger of the two guarantees. A `count(*) = 0` assertion cannot express
-- that difference, and cannot even run: the error takes the transaction.
set local role anon;
select throws_ok(
  $$select count(*) from moderation_terms$$,
  '42501',
  null,
  'anon cannot read moderation_terms at all'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);

select throws_ok(
  $$select count(*) from moderation_terms$$,
  '42501',
  null,
  'an authenticated user cannot read moderation_terms either'
);

select throws_ok(
  $$insert into moderation_terms (term) values ('nope')$$,
  '42501',
  null,
  'an authenticated user cannot extend the denylist'
);

-- ---------------------------------------------------------------------------
-- Normalisation: the evasions that cost nothing to defeat.
-- ---------------------------------------------------------------------------
select is(
  public.blocked_term_in('ZZBLOCKEDZZ'),
  'zzblockedzz',
  'case is normalised'
);

select is(
  public.blocked_term_in('zzbl0ckedzz'),
  'zzblockedzz',
  'leetspeak digits are folded back to letters'
);

select is(
  public.blocked_term_in('zzbloooockedzz'),
  'zzblockedzz',
  'a held-down key is collapsed'
);

select is(
  public.blocked_term_in('z z b l o c k e d z z'),
  'zzblockedzz',
  'spacing it out does not get through a squeezed-match term'
);

select is(
  public.blocked_term_in('z.z.b.l.o.c.k.e.d.z.z'),
  'zzblockedzz',
  'nor does punctuating it'
);

-- ---------------------------------------------------------------------------
-- Over-reach. These are the tests that protect real users, and the ones a
-- filter written in a hurry always fails.
-- ---------------------------------------------------------------------------
select is(
  public.blocked_term_in('I grew up in Scunthorpe'),
  null,
  'a place name containing a blocked substring is not a match (the Scunthorpe problem)'
);

select is(
  public.blocked_term_in('the assassin wore a classic shift dress'),
  null,
  'word boundaries hold: assassin and classic are clean'
);

select is(
  public.blocked_term_in('shitake mushrooms for dinner'),
  null,
  'a non-squeezed term does not fire inside a longer word'
);

select is(
  public.blocked_term_in(null),
  null,
  'null text is clean, not an error'
);

select is(
  public.blocked_term_in('Dinner at Rosemary''s, 7pm — wear something warm'),
  null,
  'ordinary event copy passes untouched'
);

-- ---------------------------------------------------------------------------
-- The filter on real write paths. Dana has accepted the terms, so anything
-- refused here is refused by the text filter and not the gate.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into event_comments (event_id, user_id, body)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            '44444444-4444-4444-8444-444444444444', 'zzblockedzz you')$$,
  '23514',
  null,
  'a comment carrying a blocked term is refused'
);

select lives_ok(
  $$insert into event_comments (event_id, user_id, body)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            '44444444-4444-4444-8444-444444444444', 'love the coat')$$,
  'an ordinary comment still writes'
);

select throws_ok(
  $$insert into events (host_id, title, starts_at)
    values ('44444444-4444-4444-8444-444444444444',
            'zzblockedzz party', now() + interval '1 day')$$,
  '23514',
  null,
  'an event title carrying a blocked term is refused'
);

select throws_ok(
  $$update profiles set display_name = 'zzblockedzz'
     where user_id = '44444444-4444-4444-8444-444444444444'$$,
  '23514',
  null,
  'a display name carrying a blocked term is refused — it renders beside everyone else''s content'
);

-- The filter must not eat its own moderation. Dana hosts this event, so hiding
-- is her call to make; the stored body matches the sentinel only because the
-- list grew after it was written, and re-checking a column nobody touched would
-- leave the offending comment permanently unhideable.
select lives_ok(
  $$update event_comments set hidden = true
     where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'$$,
  'the host can hide an already-stored comment whose body now matches the denylist'
);

-- 42501, not 23514: since 20260808190200 the UPDATE reach on this table is
-- limited by a COLUMN grant to `hidden` alone, so a body edit is refused at the
-- privilege layer and never reaches the text filter. That migration says why in
-- as many words — "Nobody edits anybody's words, including their own: the atlas
-- bans editing outright" — which makes this the stronger of the two refusals
-- and the one worth pinning. The filter's own 23514 is still asserted on INSERT
-- above, where a body can actually be written.
select throws_ok(
  $$update event_comments set body = 'zzblockedzz again'
     where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'$$,
  '42501',
  null,
  'but editing a body at all is refused — hiding is the only permitted update'
);

reset role;

-- The service-role escape: system writes must not fail on the filter, or a
-- backfill becomes unrunnable and signup can break on a name Apple supplied.
select lives_ok(
  $$insert into events (host_id, title, starts_at)
    values ('44444444-4444-4444-8444-444444444444',
            'zzblockedzz', now() + interval '3 days')$$,
  'the filter does not fire for a non-client role'
);

-- ---------------------------------------------------------------------------
-- The terms gate. Erin has accepted nothing.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);

select is(
  public.has_accepted_social_terms(),
  false,
  'a user who has not accepted is reported as not having accepted'
);

select throws_ok(
  $$insert into event_comments (event_id, user_id, body)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            '55555555-5555-4555-8555-555555555555', 'nice')$$,
  '42501',
  'social_terms_required',
  'commenting without accepting the terms is refused, with the message the client keys on'
);

-- Safety actions are NOT gated. This is the point of the whole design: a user
-- being harassed must not have to accept a legal agreement to make it stop.
select lives_ok(
  $$insert into user_blocks (blocker_id, blocked_id)
    values ('55555555-5555-4555-8555-555555555555',
            '44444444-4444-4444-8444-444444444444')$$,
  'blocking works without having accepted the terms'
);

select lives_ok(
  $$insert into content_reports (reporter_id, subject, subject_id, reason)
    values ('55555555-5555-4555-8555-555555555555', 'event',
            'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'harassment')$$,
  'reporting works without having accepted the terms'
);

-- And accepting unblocks the gate.
update profiles
   set social_terms_version = public.current_social_terms_version(),
       social_terms_at      = now()
 where user_id = '55555555-5555-4555-8555-555555555555';

select is(
  public.has_accepted_social_terms(),
  true,
  'accepting the current version satisfies the gate'
);

reset role;

select * from finish();
rollback;
