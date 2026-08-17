// Hand-written row shapes for the Daily Social views and table, in the
// `src/features/social/db-rows.ts` style: snake_case, mirroring the wire
// format, mapped to camelCase by the feature that reads them.
//
// WHY BY HAND. `src/types/database.ts` and `src/lib/database.types.ts` are
// generated from the LIVE database with `npm run gen:types`, and
// 20260817000000_daily_social.sql has not been applied there yet — so the
// generated types name neither view, neither the table nor the RPC. Editing
// either generated file by hand would be reverted by the next regen without
// anybody noticing, which is the failure `useFriendClosetMeta` already
// documents. These declarations are the interim, and the regen makes the casts
// in `queries.ts` and `reactions.ts` no-ops rather than lies.

import type { DailyReaction } from './types';

/**
 * `friend_worn_outfits` — four columns, and the omissions are the design.
 *
 * Not `reasoning`, not `context_snapshot`, not `note`, not `rating` /
 * `wear_rating` / `favorited_at`, not `saved_at` / `board_id` /
 * `origin_outfit_id`, and nothing about weather, occasion or cost per wear.
 * The view does not project them, so this shape could not carry them even if a
 * reader asked.
 */
export interface FriendWornOutfitRow {
  id: string;
  user_id: string;
  name: string | null;
  worn_at: string;
}

/**
 * `friend_worn_outfit_items` — which pieces are in which look, and nothing
 * else. The view's `where exists (… friend_items …)` means this adds no new
 * item exposure: a garment its owner has hidden is simply not here, and there
 * is no column saying so.
 */
export interface FriendWornOutfitItemRow {
  outfit_id: string;
  item_id: string;
}

/**
 * The columns of `friend_items` a shared look actually needs: three image
 * paths, and the three the app names a garment from.
 *
 * Still a narrow projection rather than `FriendItemRow` — brand, material,
 * description, wear counts, `borrowable` and `shoppable` are the friend's
 * closet page's business, not this surface's. `category`, `subcategory` and
 * `colors` are here because the atlas's outfit line names the pieces, and
 * `pieceName()` is the one derivation in the app that turns those three into
 * "Charcoal wool coat". They add no exposure: `friend_items` already hands this
 * caller all three for that friend's closet grid, behind the same mutual-follow
 * and `closet_hidden` gate.
 */
export interface FriendWornPieceImageRow {
  id: string;
  category: string;
  subcategory: string | null;
  colors: { name: string }[] | null;
  thumb_path: string | null;
  cutout_path: string | null;
  plate_path: string | null;
}

/**
 * `daily_social_reactions` — one row per `(outfit_id, reactor_id)` pair, which
 * is the primary key. Changing your mind rewrites this row; there is no second
 * row, no count column, and no aggregate view, so "no public aggregation" is
 * enforced by there being nothing to aggregate.
 */
export interface DailySocialReactionRow {
  outfit_id: string;
  reactor_id: string;
  owner_id: string;
  reaction: DailyReaction;
  created_at: string;
}
