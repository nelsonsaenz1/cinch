/**
 * The saved-looks unit's shared vocabulary — the one module every other part of
 * the unit binds to.
 *
 * ── A COLLECTION IS A BOARD ────────────────────────────────────────────────
 *
 * The atlas calls the shelf a "collection" and the schema calls it a `board`,
 * and there is exactly one table. `20260820000000_saved_looks.sql` argues the
 * case at length; the short version is that the two are the same idea — private,
 * owner-scoped, a name, and deleting one keeps its members — so a second table
 * would be a second word for one shelf, in one app, two taps apart.
 *
 * The consequence for this layer is the naming rule, and it is the mirror of the
 * one Private Circles set: **identifiers say collection, storage says board**.
 * `SavedCollection` is what a screen binds to; `boards` is what `client.ts`
 * queries. `tests/saved-looks-collections.test.ts` holds the boundary.
 *
 * ── WHY THESE SHAPES AND NOT THE ROWS ──────────────────────────────────────
 *
 * Nothing here has a runtime dependency: no React, no react-native, no Supabase
 * client. The presentational layer and the node test suite both import it, and a
 * shared interface that drags a native module into a test runner is not shared.
 * The wire shapes live in `db-rows.ts` and are mapped here at the read boundary
 * — the `closet/queries.ts` pattern, and the one `features/circles/types.ts`
 * followed.
 */

/**
 * Where a save came from. Three, and the set is closed by the database enum.
 *
 * There is no `public_look` and no `link`. Every branch of `can_save_source`
 * routes through a visibility predicate that already existed — owner-only
 * `outfits`, the `friend_worn_outfits` view, `is_event_member` — and a fourth
 * value would be a fourth read path this feature is not allowed to open.
 */
export type SavedLookSource = 'own_outfit' | 'daily_look' | 'event_look';

/**
 * Whether the thing a save points at is still visible to the person who kept it.
 *
 * **Derived on every read and never stored.** `saved_looks_resolved` computes it
 * per row from `can_save_source`, so a revoked source becomes `unavailable` on
 * the next fetch with nothing to invalidate. A cached boolean would be a copy of
 * somebody else's privacy decision, and a stale copy of a privacy decision fails
 * open — which is precisely the case this feature exists to handle.
 *
 * The two values are deliberately not three. "Expired", "unshared" and
 * "deleted" are the same answer to the reader and would be three different
 * disclosures about somebody else's data.
 */
export type SavedAvailability = 'available' | 'unavailable';

/**
 * One kept look, as every screen in this unit sees it.
 *
 * Everything prefixed `snap` in the row is flattened here without the prefix:
 * the wire name records that the value was frozen at save time, and the screens
 * only ever have the frozen one to draw. `sourceId` is deliberately absent — no
 * surface needs it, and a component holding a pointer into somebody else's data
 * is a component that will eventually try to follow it.
 */
export interface SavedLook {
  id: string;
  sourceType: SavedLookSource;
  /** Whose look it was. Null once that account is gone. */
  sourceOwnerId: string | null;
  collectionId: string | null;
  /** May be null: a look can legitimately have had no title. */
  title: string | null;
  /** May be null — OS-03's "No image saved" card, which is content, not failure. */
  imageUrl: string | null;
  /** "Maya's Daily look", "Your outfit", "Jordan's event". */
  sourceLabel: string;
  /** "Visible to your Circle", "Event look", "Private" — as it was, not as it is. */
  sourceVisibility: string;
  /** The moment the SOURCE carried: when it was worn, or posted. */
  sourceAt: string;
  /** The owner's own words. Never leaves this device except to their own row. */
  note: string | null;
  /** When the save was made. OS-04 prints this and `sourceAt` on adjacent lines. */
  savedAt: string;
  availability: SavedAvailability;
}

/** One collection, as a filter chip and as a row on the manage screen. */
export interface SavedCollection {
  id: string;
  name: string;
  /**
   * How many saves point at it. Counted client-side from the loaded list rather
   * than read from the server: the list is the caller's own rows and is already
   * in hand, and a server count would be a second number that can disagree with
   * the grid the reader is looking at.
   */
  savedCount: number;
}

/**
 * Forty characters, because that is the promise printed under the field:
 * "Names are private and visible only to you. 40 characters max."
 *
 * ENFORCED HERE AND NOT IN THE SCHEMA. `boards.name` admits 60 and shipped that
 * way; tightening the check constraint would refuse to load boards that already
 * exist with 41-60 character names, which is a migration that breaks somebody's
 * own data to make a newer sentence true. So the ceiling lives where the
 * sentence is printed, and `tests/saved-looks-collections.test.ts` reads the 60
 * back out of the migration so the two cannot silently swap.
 */
export const COLLECTION_NAME_MAX = 40;

/**
 * Five hundred, matching `outfits.note` exactly.
 *
 * The same kind of sentence about the same kind of thing. Two different ceilings
 * for one idea is how a note that fits in the wear diary is refused by Saved.
 */
export const SAVED_NOTE_MAX = 500;

/**
 * How long Undo stays on the confirmation toast — OS-02, and §10's
 * `saved --undo(≤5s)--> idle`.
 *
 * Five seconds is the atlas's number and it is also the honest one: the toast
 * has to outlive the glance that notices it, and an Undo that lingers past the
 * next screen is a control that acts on something the reader has stopped
 * thinking about.
 */
export const UNDO_WINDOW_MS = 5_000;
