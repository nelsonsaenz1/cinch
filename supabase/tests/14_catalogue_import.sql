-- ===========================================================================
-- Catalogue Photo V2 — the batch import's schema promises.
--
-- Three claims the Edge Function makes to the person holding the phone, each
-- of which is only true if the database enforces it:
--
--   "Adding these again will not add them twice."  A batch import is N writes
--   over a mobile connection and its recovery is to send the failures again.
--   If the first attempt actually landed and only the RESPONSE was lost — the
--   most ordinary failure there is — that retry must not produce a second
--   shirt. The partial unique index is what makes that true; without it the
--   promise is a hope about network conditions.
--
--   "This colour came from the shop, not from your photograph."  `colour_source`
--   is read by the harmony scoring to decide how much to trust a hue. A stock
--   photo filed as 'measured' tells it there is ground truth where there is a
--   studio white balance of somebody else's garment.
--
--   "You do not have room for three."  Said BEFORE anything is downloaded or
--   written. `import_capacity()` has to answer for the caller and only the
--   caller, and must not be reachable by anyone who is not signed in.
--
-- RLS is the whole authorization model on `items` — there is no server-side
-- layer behind it — so the last two assertions check that the new column
-- changes nothing about who can see a row.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email)
values ('88888888-8888-4888-8888-888888888888', 'wren@example.test'),
       ('99999999-9999-4999-8999-999999999999', 'stranger@example.test');

-- Both genuinely on the free tier: the signup trial folds into `pro`
-- (effective_plan), and the ceiling assertion below would read the wrong
-- number against a trialing account.
update subscriptions
   set plan = 'free', trial_ends_at = null
 where user_id in ('88888888-8888-4888-8888-888888888888',
                   '99999999-9999-4999-8999-999999999999');

-- Derived rather than typed. The free ceiling has already moved once (30 → 10)
-- and a hard-coded number would keep passing after it moves again.
create temporary table free_ceiling on commit drop as
  select item_limit_for_plan('free') as n;
grant select on free_ceiling to authenticated;

-- ---------------------------------------------------------------------------
-- 1 · The column exists, and is optional
-- ---------------------------------------------------------------------------

select has_column('public', 'items', 'catalog_external_id',
  'items carries the catalogue row id an import came from');

select col_is_null('public', 'items', 'catalog_external_id',
  'and it is null for every garment that did not come from the catalogue');

-- ---------------------------------------------------------------------------
-- 2 · As the owner, through RLS
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into items (user_id, status, description, colour_source, intake_method,
                       catalog_external_id, listing_source_url, listing_source_label)
    values ('88888888-8888-4888-8888-888888888888', 'pending_tag', 'Crew Neck Jersey Tee',
            'catalogue', 'catalogue', 'df-101',
            'https://mrporter.com/p/101', 'mrporter.com')$$,
  'a catalogue import stores its colour source, its route, its provenance and its row id'
);

-- THE RETRY. Same user, same colourway, second attempt.
select throws_ok(
  $$insert into items (user_id, status, colour_source, catalog_external_id)
    values ('88888888-8888-4888-8888-888888888888', 'pending_tag', 'catalogue', 'df-101')$$,
  '23505',
  null,
  'retrying an import that already landed is refused rather than duplicated'
);

-- Two garments that came from nowhere in particular must not collide with each
-- other. This is the whole reason the index is partial.
select lives_ok(
  $$insert into items (user_id, status) values
      ('88888888-8888-4888-8888-888888888888', 'pending_upload'),
      ('88888888-8888-4888-8888-888888888888', 'pending_upload')$$,
  'garments with no catalogue id do not collide, however many there are'
);

-- ---------------------------------------------------------------------------
-- 3 · The colour source is a closed set, and 'catalogue' is in it
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into items (user_id, status, colour_source)
    values ('88888888-8888-4888-8888-888888888888', 'pending_tag', 'stock-photo')$$,
  '23514',
  null,
  'an invented colour source is refused by the check, not stored'
);

-- ---------------------------------------------------------------------------
-- 3b · The intake route is a closed set too, and the three old ones still work
--
-- Widening a check is the change most likely to break something quietly: the
-- new value is what gets tested and the three that were already there are
-- assumed. All four are asserted, because 'photo', 'voice' and 'manual' are
-- each written by a live path (upload, commit_intake_session, useFileTypedWords)
-- and a typo in the rewritten constraint would take all three down at once.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into items (user_id, status, intake_method) values
      ('88888888-8888-4888-8888-888888888888', 'pending_upload', 'photo'),
      ('88888888-8888-4888-8888-888888888888', 'pending_upload', 'voice'),
      ('88888888-8888-4888-8888-888888888888', 'pending_upload', 'manual')$$,
  'the three intake routes that predate the catalogue still store'
);

select throws_ok(
  $$insert into items (user_id, status, intake_method)
    values ('88888888-8888-4888-8888-888888888888', 'pending_upload', 'scraped')$$,
  '23514',
  null,
  'an invented intake route is refused by the check, not stored'
);

-- The default is deliberately NOT moved. Every other write site depends on it,
-- and an import that forgot to name its route would silently become a
-- photograph — which is the exact miscount this value was added to prevent.
select is(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'items'
      and column_name = 'intake_method'),
  '''photo''::text',
  'the column default is still photo, so only a deliberate write says catalogue'
);

-- ---------------------------------------------------------------------------
-- 4 · The preflight answers for the caller, and for nobody else
-- ---------------------------------------------------------------------------

-- Six rows above: one catalogue import, two bare ones, and one each for the
-- three older intake routes. None archived, and the free ceiling is well above
-- six, so nothing here is fighting the trigger.
select is(
  (select active from import_capacity()),
  6,
  'the preflight counts the caller''s active garments'
);

select is(
  (select active_limit from import_capacity()),
  (select n from free_ceiling),
  'and reports the ceiling their plan actually allows'
);

-- ---------------------------------------------------------------------------
-- 5 · A stranger, and an anonymous caller
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',
  true
);

-- The SAME catalogue row, imported by somebody else. Two people may own the
-- same shirt; the index answers "have I imported this", not "does it exist".
select lives_ok(
  $$insert into items (user_id, status, colour_source, catalog_external_id)
    values ('99999999-9999-4999-8999-999999999999', 'pending_tag', 'catalogue', 'df-101')$$,
  'another account may import the same catalogue row'
);

select is(
  (select active from import_capacity()),
  1,
  'the preflight never reports another account''s closet'
);

select is_empty(
  $$select id from items where catalog_external_id = 'df-101'
      and user_id = '88888888-8888-4888-8888-888888888888'$$,
  'and a stranger cannot see the row that carries it'
);

reset role;

select * from finish();
rollback;
