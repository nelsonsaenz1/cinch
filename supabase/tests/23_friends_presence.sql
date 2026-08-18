-- ===========================================================================
-- Friends list — the presence fact, and the six ways it must not appear.
--
-- Redesign 08 puts one authorized fact on a friend's card: the latest piece
-- they wore inside the window, or the bare mark that they wore something
-- today, or nothing at all. The whole privacy argument rests on the claim
-- that the CLIENT NEVER DECIDES which of those three it is — it renders
-- whatever `friend_worn_outfits` → `friend_worn_outfit_items` → `friend_items`
-- hands back, and that chain answers nothing it should not.
--
-- `18_daily_social.sql` already proves the boundary and the window for the
-- Daily Social feed. This file proves the same chain answers correctly for the
-- FRIENDS LIST's access pattern, which differs in one way that matters: the
-- feed reads every friend at once and takes the newest 40, while a card reads
-- ONE friend by id. A per-friend read is exactly the shape that would expose a
-- gap if any predicate were somehow scoped to the aggregate rather than to the
-- row, so each assertion below filters `user_id = <one friend>` the way the
-- card does.
--
-- WHAT IS DELIBERATELY NOT HERE: muting. A mute is local to one device and is
-- never written to the server (`src/features/social-graph/muted.ts` — "a mute
-- that synced or notified would be a soft unfollow, which is a different,
-- heavier product"). There is no server behaviour to assert, so the muted-
-- friend exclusion is proven in the client suite instead. Adding a server-side
-- mute purely to satisfy a test would change the product to fit its proof.
--
-- Same transaction-time discipline as 18: `now()` is fixed for the whole
-- transaction, so the timeline is written with the boundary trigger disabled
-- and the trigger's own behaviour is left to 18, which already covers it.
--
-- Profiles come from `on_auth_user_created`; nothing here inserts into
-- `public.profiles`.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'fp-viewer@example.test'),
  ('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', 'fp-sharer@example.test'),
  ('c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3', 'fp-oneway@example.test'),
  ('c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4', 'fp-blocker@example.test'),
  ('c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5', 'fp-blocked@example.test');

-- The viewer is mutual with the sharer, the blocker and the blocked.
-- `oneway` follows the viewer and is never followed back: a request that was
-- sent and not accepted, which is the case a friends list must never treat as
-- a friendship.
insert into public.follows (follower_id, followee_id) values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'),
  ('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'),
  ('c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'),
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'),
  ('c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'),
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5'),
  ('c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1');

insert into public.items (id, user_id, category) values
  ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', 'top'),
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', 'outerwear'),
  ('d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3', 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3', 'top'),
  ('d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4', 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4', 'top'),
  ('d5d5d5d5-d5d5-45d5-85d5-d5d5d5d5d5d5', 'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5', 'top');

alter table public.profiles disable trigger profiles_worn_outfits_boundary;

-- Everyone who could share, shares — so that every negative below is caused by
-- the predicate under test and not by an unset boundary.
update public.profiles set worn_outfits_shared_since = now() - interval '90 days'
 where user_id in ('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
                   'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3',
                   'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4',
                   'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5');

insert into public.outfits (id, user_id, name, worn_at) values
  -- The sharer's own timeline, straddling the seven-day edge to the minute.
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
   'Just Inside Seven Days', now() - interval '7 days' + interval '1 minute'),
  ('e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
   'Just Outside Seven Days', now() - interval '7 days' - interval '1 minute'),
  ('e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
   'Day Eight', now() - interval '8 days'),
  -- One each for the graph cases.
  ('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3',
   'One Way Only', now() - interval '1 hour'),
  ('e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5', 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4',
   'They Block Me Later', now() - interval '1 hour'),
  ('e6e6e6e6-e6e6-46e6-86e6-e6e6e6e6e6e6', 'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5',
   'I Block Them Later', now() - interval '1 hour');

insert into public.outfit_items (outfit_id, item_id, user_id) values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
   'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
   'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'),
  ('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', 'd3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3',
   'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3'),
  ('e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5', 'd4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4',
   'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'),
  ('e6e6e6e6-e6e6-46e6-86e6-e6e6e6e6e6e6', 'd5d5d5d5-d5d5-45d5-85d5-d5d5d5d5d5d5',
   'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5');

alter table public.profiles enable trigger profiles_worn_outfits_boundary;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1","role":"authenticated"}', true);

-- ---------------------------------------------------------------------------
-- 1-3 · The seven-day edge, to the minute
--
-- A card reads one friend. If the window were ever evaluated against the
-- newest row rather than each row, "just outside" would ride in behind "just
-- inside" — so all three are asserted against the same friend at once.
-- ---------------------------------------------------------------------------

select is((select count(*)::int from public.friend_worn_outfits
            where user_id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'
              and id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'), 1,
  '1 · one minute inside seven days is still shared');

select is((select count(*)::int from public.friend_worn_outfits
            where user_id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'
              and id = 'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2'), 0,
  '2 · one minute past seven days is gone, with no grace');

select is((select count(*)::int from public.friend_worn_outfits
            where user_id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'
              and id = 'e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3'), 0,
  '3 · day eight is gone');

-- The card takes the newest visible row. It must be the one inside the window,
-- never the newer-but-expired one.
select is((select name from public.friend_worn_outfits
            where user_id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'
            order by worn_at desc limit 1), 'Just Inside Seven Days',
  '4 · the fact a card would draw is the newest STILL-AUTHORIZED look');

-- ---------------------------------------------------------------------------
-- 5-6 · Mutuality, and the request that was never accepted
-- ---------------------------------------------------------------------------

select is((select count(*)::int from public.friend_worn_outfits
            where user_id = 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3'), 0,
  '5 · somebody who follows you but is not followed back shares nothing');

select is((select count(*)::int from public.friend_worn_outfit_items
            where outfit_id = 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4'), 0,
  '6 · and their pieces are unreachable through the item view as well');

-- ---------------------------------------------------------------------------
-- 7-8 · Hidden pieces are omitted with no trace
--
-- The look still crosses; the piece does not; and nothing anywhere states that
-- a piece was withheld. A count of the difference IS the inference the design
-- forbids, so the assertion is on the absence, not on a marker.
-- ---------------------------------------------------------------------------

reset role;
update public.items set is_archived = true
 where id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1","role":"authenticated"}', true);

select is((select count(*)::int from public.friend_worn_outfit_items
            where outfit_id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'), 1,
  '7 · a hidden piece leaves the look one piece shorter and says nothing');

select is((select count(*)::int from public.friend_worn_outfits
            where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'), 1,
  '8 · hiding the piece never hides the look, so the card still has its fact');

-- ---------------------------------------------------------------------------
-- 9-12 · Blocking, in both directions
--
-- The friends list must be identical whichever way round the block was made.
-- Direction one: THEY block the viewer.
-- ---------------------------------------------------------------------------

reset role;
insert into public.user_blocks (blocker_id, blocked_id) values
  ('c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1","role":"authenticated"}', true);

select is((select count(*)::int from public.friend_worn_outfits
            where user_id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'), 0,
  '9 · when they block you, their looks leave your list');

select is((select count(*)::int from public.friend_worn_outfit_items
            where outfit_id = 'e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5'), 0,
  '10 · and their pieces go with them');

-- Direction two: the VIEWER blocks them.
reset role;
insert into public.user_blocks (blocker_id, blocked_id) values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1","role":"authenticated"}', true);

select is((select count(*)::int from public.friend_worn_outfits
            where user_id = 'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5'), 0,
  '11 · when you block them, their looks leave your list too');

select is((select count(*)::int from public.friend_worn_outfit_items
            where outfit_id = 'e6e6e6e6-e6e6-46e6-86e6-e6e6e6e6e6e6'), 0,
  '12 · and the block is symmetric all the way down to the pieces');

-- ---------------------------------------------------------------------------
-- 13-14 · Sharing turned off — the fact disappears and leaves no hole
--
-- The last and most important property: a friend who revokes is
-- indistinguishable from a friend who never shared. Both are simply absent
-- from the result set, so a card has nothing to draw and nothing to explain.
-- ---------------------------------------------------------------------------

reset role;
update public.profiles set worn_outfits_shared_since = null
 where user_id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1","role":"authenticated"}', true);

select is((select count(*)::int from public.friend_worn_outfits
            where user_id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'), 0,
  '13 · revoking sharing withdraws every look at once, retroactively');

-- The friendship itself is untouched — which is the point. The person stays in
-- the circle; only the fact goes. A card that dimmed, or drew a placeholder,
-- or said "nothing shared" would be reporting this transition to the viewer.
select is((select public.is_friend('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2')), true,
  '14 · and they are still your friend, so the row stays and only the fact goes');

select * from finish();
rollback;
