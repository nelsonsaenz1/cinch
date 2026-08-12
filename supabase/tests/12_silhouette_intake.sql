-- ===========================================================================
-- DS-03/04/05 — a garment filed from typed words alone.
--
-- The Describe atlas ends every path in a filed piece, and until this slice
-- there was no way to put one in the closet without an image. The app files it
-- as a plain owner INSERT rather than through an Edge Function, deliberately:
-- two of DS-05's three notices are OFFLINE and CONSENT DECLINED, and a path
-- that needed a server would be unavailable in exactly the two states it is
-- drawn for.
--
-- That makes RLS the entire security model for this path, which is what this
-- file is here to hold:
--
--   * a silhouette row is storable at all — no image path, no placeholder;
--   * it carries the provenance that says what it is, so nothing downstream
--     mistakes a spoken colour for a measured one;
--   * a stranger can neither read it nor forge one under its owner's name;
--   * the plan ceiling applies to it exactly as to a photographed garment —
--     a text door into the closet must not be a way around a paid boundary;
--   * and the typed sentence does not reach `catalog_lookups`, the GLOBAL
--     table 20260811165146 deliberately stripped of raw query text. Filing is
--     not searching: nothing here consults a partner, so nothing may be keyed.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email)
values ('66666666-6666-4666-8666-666666666666', 'wren@example.test'),
       ('77777777-7777-4777-8777-777777777777', 'stranger@example.test');

-- Wren is genuinely on the free tier: the signup trial folds into `pro`
-- (effective_plan), and the ceiling assertions below would test the wrong
-- number against a trialing account.
update subscriptions
   set plan = 'free', trial_ends_at = null
 where user_id = '66666666-6666-4666-8666-666666666666';

-- Read as postgres and carried, because `item_limit_for_plan` has been revoked
-- from client roles since 20260805220000 and every use below runs as
-- `authenticated`. Derived rather than typed: the free ceiling has moved once
-- already (30 → 10) and a hard-coded 10 would keep passing after it moves again.
create temporary table free_ceiling on commit drop as
  select item_limit_for_plan('free') as n;
grant select on free_ceiling to authenticated;

-- ---------------------------------------------------------------------------
-- 1 · The filing itself, as the owner and through RLS.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into items (id, user_id, status, category, subcategory, colors,
                       description, colour_source, intake_method, user_verified)
    values ('50000000-0000-4000-8000-000000000001',
            '66666666-6666-4666-8666-666666666666', 'verified', 'top', 'crewneck',
            '[{"hex":"#1B2A4A","name":"navy"}]'::jsonb,
            'navy wool crewneck sweater', 'spoken', 'manual', true)$$,
  'a garment with no image at all is storable — the whole point of the slice'
);

select is(
  (select image_path is null and thumb_path is null and cutout_path is null
     from items where id = '50000000-0000-4000-8000-000000000001'),
  true,
  'and it holds no image path — never a placeholder, never a borrowed URL'
);

select is(
  (select intake_method from items where id = '50000000-0000-4000-8000-000000000001'),
  'manual',
  'intake_method records which door it came through'
);

select is(
  (select colour_source from items where id = '50000000-0000-4000-8000-000000000001'),
  'spoken',
  'and colour_source records that a word, not a pixel, gave the colour'
);

select is(
  (select description from items where id = '50000000-0000-4000-8000-000000000001'),
  'navy wool crewneck sweater',
  'the sentence is kept verbatim on the user''s own row'
);

reset role;

-- ---------------------------------------------------------------------------
-- 2 · A stranger. Reads are filtered, writes are refused.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from items
    where id = '50000000-0000-4000-8000-000000000001'), 0,
  'a stranger cannot read a silhouette piece'
);

select throws_ok(
  $$insert into items (user_id, status, description, intake_method)
    values ('66666666-6666-4666-8666-666666666666', 'verified',
            'a coat I do not own', 'manual')$$,
  '42501', null,
  'and cannot file words into somebody else''s closet under their name'
);

reset role;

-- ---------------------------------------------------------------------------
-- 3 · The ceiling. A text door is not a way around a paid boundary.
--
-- The two limit triggers fire `before insert on items` regardless of how the
-- row was composed, so this is really asserting that filing did not find some
-- path around them — which a SECURITY DEFINER server function could have.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}',
  true
);

-- Fill to exactly the free ceiling. One is already there from section 1.
insert into items (user_id, status, description, intake_method, colour_source)
select '66666666-6666-4666-8666-666666666666', 'verified',
       'piece ' || g, 'manual', 'spoken'
  from generate_series(1, (select n from free_ceiling) - 1) g;

select throws_ok(
  $$insert into items (user_id, status, description, intake_method, colour_source)
    values ('66666666-6666-4666-8666-666666666666', 'verified',
            'one too many', 'manual', 'spoken')$$,
  '23514',
  null,
  'the plan ceiling refuses a typed piece exactly as it refuses a photographed one'
);

-- ---------------------------------------------------------------------------
-- 4 · The privacy line. Filing consults no partner, so it keys no cache.
-- ---------------------------------------------------------------------------

reset role;

select is(
  (select count(*)::int from catalog_lookups), 0,
  'filing typed words writes nothing to the global catalogue cache'
);

select is(
  (select count(*)::int from items
    where user_id = '66666666-6666-4666-8666-666666666666'
      and description = 'navy wool crewneck sweater'), 1,
  'the sentence lives on exactly one row, and it is the owner''s'
);

select is(
  (select count(*)::int from items
    where user_id = '66666666-6666-4666-8666-666666666666'
      and intake_method = 'manual'
      and image_path is null),
  (select n from free_ceiling),
  'every filed piece is imageless — none acquired a picture on the way in'
);

select * from finish();
rollback;
