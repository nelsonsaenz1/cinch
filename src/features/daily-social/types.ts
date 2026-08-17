/**
 * The Daily Social unit's shared vocabulary — the one module every other part
 * of the unit binds to.
 *
 * The presentational components, the state resolution, the query layer and the
 * reaction writer are being built against these exact names, so a rename here
 * is a rename in four places at once. Nothing in this file has a runtime
 * dependency: no React, no react-native, no Supabase client. That is
 * deliberate — the shared interface has to be importable from a node test and
 * from a component with equal ease.
 *
 * ── WHY THREE REACTIONS, AND WHY THEY ARE A CLOSED UNION ──────────────────
 *
 * The contract fixes the set at exactly three, all positive or neutral, with
 * no negative signal and no count anywhere. A closed union is how "exactly
 * three" stops being a promise in a document and becomes a thing the compiler
 * refuses to break: a fourth reaction does not compile, and neither does a
 * dislike. The database says the same in its own language —
 * `check (reaction in ('sharp', 'cozy', 'noted'))` — and if the two ever
 * disagree, the check constraint wins and this is the bug.
 *
 * ── WHAT A LOOK IS ALLOWED TO CARRY ───────────────────────────────────────
 *
 * Four facts about the outfit and the pieces that can be drawn. The omissions
 * are the design, not an oversight: no reasoning, no context snapshot, no
 * note, no rating, no favourite, no occasion, no weather, no cost per wear.
 * `friend_worn_outfits` projects exactly the four columns below, so a field
 * that is not here is a field the read path never fetched — there is nothing
 * to leak by forgetting to filter it.
 */

/** The three, in the order they are drawn. */
export type DailyReaction = 'sharp' | 'cozy' | 'noted';

/**
 * The set, ordered. The order is part of the interface: a control whose three
 * options reshuffle between renders is a control people learn twice.
 */
export const DAILY_REACTIONS: readonly DailyReaction[] = ['sharp', 'cozy', 'noted'];

/** Whether an arbitrary string is one of the three. Used at the wire boundary. */
export function isDailyReaction(value: unknown): value is DailyReaction {
  return typeof value === 'string' && (DAILY_REACTIONS as readonly string[]).includes(value);
}

/**
 * One garment inside a look, as far as the collage is concerned.
 *
 * Three paths, no URLs: the garments bucket is private, so a stored path is
 * not something an `<Image>` can render. `useSignedUrls(...).resolve(plate,
 * cutout, thumb)` is what turns these into something displayable, exactly as
 * Explore already does for a friend's closet.
 *
 * A piece whose owner has hidden it never becomes one of these, because
 * `friend_worn_outfit_items` routes through `friend_items` and a hidden
 * garment is already absent there. Nothing anywhere says how many are missing.
 */
export interface DailyLookPiece {
  itemId: string;
  /**
   * What the garment is CALLED — "Charcoal wool coat", from the app's one
   * naming derivation (`features/closet/item-name.ts`).
   *
   * The atlas's outfit line, and the only readable account of a look: the
   * collage is hidden from VoiceOver so that no per-tile label can be counted
   * off one by one, so if the pieces are not named in text they are not
   * available to a reader at all. Derived from the same three columns the
   * friend's own closet page already names them with — `category`,
   * `subcategory`, `colors` — so this adds no exposure, only a word for
   * something already on screen as a picture.
   */
  name: string;
  thumbPath: string | null;
  cutoutPath: string | null;
  platePath: string | null;
}

/**
 * One friend's look, on one day.
 *
 * `pieces` may legitimately be empty. A look whose every garment is hidden is
 * still a look that was worn and still a thing the owner chose to share; it is
 * a short look, not a broken one, and it must never be counted, annotated or
 * dropped.
 */
export interface DailyLook {
  outfitId: string;
  ownerId: string;
  name: string | null;
  /** ISO 8601, as Postgres serialises `timestamptz`. */
  wornAt: string;
  pieces: DailyLookPiece[];
}
