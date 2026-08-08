-- ===========================================================================
-- The Friend's Closet privacy layer (20260808110000).
--
-- The design atlas let wear data cross the friend layer, and replaced the
-- blanket ban with owner-held toggles. The failure modes under test:
--
--   * anon acquiring the new view;
--   * a hidden closet leaking ANYTHING — rows from friend_items, counts from
--     friend_closet_meta, or storage derivatives via item_owned_by_friend
--     ("the privacy layer answers first": zero rows server-side, never a
--     client filter);
--   * a per-stat flag failing to null its stat, or nulling its siblings;
--   * cost_per_wear drifting from the client's definition — MEAN of per-item
--     price/wears over items with both, NOT sum(price)/sum(wears)
--     (src/features/closet/profile.ts closetStats / src/schemas/item.ts);
--   * archived items counting toward any stat;
--   * a non-friend reading either view at all.
--
-- Roles, as everywhere: anon, the participants, an unrelated authenticated
-- user. Seeds run as postgres; the probes run as the role under test.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- ---------------------------------------------------------------------------
-- Seed. Alice and Bob are mutual friends, closet visible. Dana and Bob are
-- mutual friends, but Dana hides her closet. Carol follows Alice one-way.
--
-- Alice's items are chosen to pin the cost_per_wear formula:
--   A: 90.00, 3 wears  -> per-item 30
--   B: 1290.00, 0 wears -> excluded (never worn)
--   D: no price, 5 wears -> excluded (no price), still counts toward wears
--   F: 100.00, 1 wear  -> per-item 100
--   E: archived        -> invisible to every stat
-- mean(30, 100) = 65; the wrong formula, sum/sum = 190/4, gives 47.5.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'alice@example.test'),
       ('22222222-2222-4222-8222-222222222222', 'bob@example.test'),
       ('33333333-3333-4333-8333-333333333333', 'carol@example.test'),
       ('44444444-4444-4444-8444-444444444444', 'dana@example.test');

-- `on conflict … do update`, not a plain insert: handle_new_user() is an
-- AFTER INSERT trigger on auth.users and has ALREADY created each profile row
-- by the time this runs.
insert into profiles (user_id, display_name, username, visibility, bio, closet_hidden)
values ('11111111-1111-4111-8111-111111111111', 'Alice', 'alice', 'private', 'thrift maximalist', false),
       ('22222222-2222-4222-8222-222222222222', 'Bob',   'bob',   'private', null,                false),
       ('33333333-3333-4333-8333-333333333333', 'Carol', 'carol', 'private', null,                false),
       ('44444444-4444-4444-8444-444444444444', 'Dana',  'dana',  'private', 'vintage only',      true)
on conflict (user_id) do update
  set display_name = excluded.display_name, username = excluded.username,
      visibility = excluded.visibility, bio = excluded.bio,
      closet_hidden = excluded.closet_hidden;

insert into items (id, user_id, category, purchase_price, wear_count,
                   last_worn_at, is_archived)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111', 'top',   90.00, 3,
        '2026-08-01 12:00:00+00', false),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '11111111-1111-4111-8111-111111111111', 'bag',   1290.00, 0, null, false),
       ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        '11111111-1111-4111-8111-111111111111', 'footwear', null, 5,
        '2026-07-20 09:00:00+00', false),
       ('ffffffff-ffff-4fff-8fff-ffffffffffff',
        '11111111-1111-4111-8111-111111111111', 'dress', 100.00, 1,
        '2026-06-15 19:00:00+00', false),
       ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '11111111-1111-4111-8111-111111111111', 'top',   40.00, 2,
        '2026-05-01 08:00:00+00', true),
       ('99999999-9999-4999-8999-999999999999',
        '44444444-4444-4444-8444-444444444444', 'top',   55.00, 4,
        '2026-08-02 10:00:00+00', false);

insert into follows (follower_id, followee_id)
values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'),
       ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),
       ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222'),
       ('22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444'),
       ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------------
-- anon: no grant on the new view. 42501, not zero rows.
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  'select * from friend_closet_meta', '42501', null,
  'anon holds no grant on the friend_closet_meta view'
);

reset role;

-- ---------------------------------------------------------------------------
-- A friend of a visible closet: wear data crosses, stats match the client.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select wear_count from friend_items
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  3,
  'friend_items now projects wear_count (the atlas override of the tests/05 ban)'
);

select is(
  (select last_worn_at from friend_items
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '2026-08-01 12:00:00+00'::timestamptz,
  'friend_items now projects last_worn_at'
);

select is(
  (select pieces from friend_closet_meta
    where user_id = '11111111-1111-4111-8111-111111111111'),
  4::bigint,
  'pieces counts non-archived items only — the archived top is invisible'
);

select is(
  (select wears_logged from friend_closet_meta
    where user_id = '11111111-1111-4111-8111-111111111111'),
  9::bigint,
  'wears_logged sums wear_count over non-archived items (unpriced items included)'
);

select is(
  (select cost_per_wear from friend_closet_meta
    where user_id = '11111111-1111-4111-8111-111111111111'),
  65::numeric,
  'cost_per_wear is the MEAN of per-item price/wears over priced-and-worn items — 65, where sum/sum would say 47.5'
);

select is(
  public.item_owned_by_friend('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  true,
  'storage predicate serves a visible friend closet'
);

-- ---------------------------------------------------------------------------
-- A hidden closet: zero rows, null stats, no derivatives — but bio survives,
-- and the flag itself is readable so the UI can say why the grid is empty.
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from friend_items
    where user_id = '44444444-4444-4444-8444-444444444444'),
  0::bigint,
  'a hidden closet returns zero friend_items rows even to a friend — server-side, not a client filter'
);

select is(
  (select closet_hidden and pieces is null and wears_logged is null
          and cost_per_wear is null
     from friend_closet_meta
    where user_id = '44444444-4444-4444-8444-444444444444'),
  true,
  'closet_hidden nulls every stat — not even a count crosses the layer'
);

select is(
  (select bio from friend_closet_meta
    where user_id = '44444444-4444-4444-8444-444444444444'),
  'vintage only',
  'bio still crosses for a hidden closet — profile identity, not closet contents'
);

select is(
  public.item_owned_by_friend('99999999-9999-4999-8999-999999999999'),
  false,
  'a hidden closet stops serving garment derivatives too'
);

reset role;

-- ---------------------------------------------------------------------------
-- Per-stat flags: each nulls its own stat and only its own stat.
-- ---------------------------------------------------------------------------

update profiles
   set stat_pieces_hidden = true, stat_cost_per_wear_hidden = true
 where user_id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select pieces from friend_closet_meta
    where user_id = '11111111-1111-4111-8111-111111111111'),
  null::bigint,
  'stat_pieces_hidden nulls pieces'
);

select is(
  (select cost_per_wear from friend_closet_meta
    where user_id = '11111111-1111-4111-8111-111111111111'),
  null::numeric,
  'stat_cost_per_wear_hidden nulls cost_per_wear'
);

select is(
  (select wears_logged from friend_closet_meta
    where user_id = '11111111-1111-4111-8111-111111111111'),
  9::bigint,
  'sibling flags leave wears_logged untouched — the toggles are independent'
);

select is(
  (select count(*) from friend_items
    where user_id = '11111111-1111-4111-8111-111111111111'),
  4::bigint,
  'per-stat flags hide numbers, not the closet itself'
);

-- ---------------------------------------------------------------------------
-- A non-friend: nothing from either view, hidden or not.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

select is(
  (select count(*) from friend_closet_meta),
  0::bigint,
  'a non-friend reads zero rows from friend_closet_meta — one-way follow grants nothing'
);

select is(
  (select count(*) from friend_items
    where user_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'a non-friend still reads zero rows from friend_items'
);

reset role;

select * from finish();
rollback;
