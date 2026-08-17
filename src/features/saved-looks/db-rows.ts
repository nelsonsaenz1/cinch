// Hand-written row shapes for `saved_looks_resolved` and for the `boards` rows
// this feature reads as collections, in the `src/features/social/db-rows.ts`
// style: snake_case, mirroring the wire format, mapped to camelCase by the
// feature that reads them.
//
// WHY BY HAND. `src/types/database.ts` and `src/lib/database.types.ts` are
// generated from the LIVE database with `npm run gen:types`, and
// 20260820000000_saved_looks.sql has not been applied there yet — so the
// generated types name neither the table, nor the view, nor the
// `saved_look_source` enum. Hand-editing either generated file would be
// silently reverted by the next regen without anybody noticing, which is the
// failure `useFriendClosetMeta` already documents. These declarations are the
// interim, and the regen makes the cast in `client.ts` a no-op rather than a
// lie.
//
// `boards` IS in the generated types already, and is declared here anyway —
// with only the four columns this feature touches. `starts_on` and `ends_on`
// are absent on purpose: a collection made from the Saved surface never carries
// dates ("dates make it a trip"), and a row shape that named them would invite a
// screen to draw them.

import type { SavedAvailability, SavedLookSource } from './types';

/**
 * `saved_looks_resolved` — the table's fifteen columns plus the one that is
 * computed.
 *
 * `availability` is the computed one and it is the reason this feature reads the
 * view rather than the table. It is a `case` expression over `can_save_source`,
 * evaluated per row per read, so there is no column anywhere for a stale value
 * to sit in and nothing to invalidate when somebody else changes their mind.
 *
 * `source_id` is present because the wire carries it, and is deliberately
 * dropped at the mapping boundary — see `SavedLook`. No screen needs a pointer
 * into somebody else's data.
 */
export interface SavedLookRow {
  id: string;
  owner_id: string;
  source_type: SavedLookSource;
  source_id: string;
  source_owner_id: string | null;
  collection_id: string | null;
  snap_title: string | null;
  snap_image_url: string | null;
  snap_source_label: string;
  snap_source_visibility: string;
  snap_saved_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  availability: SavedAvailability;
}

/**
 * A `boards` row, read as a collection.
 *
 * Three columns and no count. How many looks are in a collection is derived from
 * the saves the caller has already loaded — a server count would be a second
 * number that can disagree with the grid on screen, and OS-05's "6 looks" sits
 * directly beside that grid.
 */
export interface SavedCollectionRow {
  id: string;
  user_id: string;
  name: string;
}
