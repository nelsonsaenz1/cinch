/**
 * The two nouns of atlas 35, and nothing else.
 *
 * KP-05 states the whole specification of a board in one sentence — "a name,
 * and optionally two dates. Nothing else. No cover image to choose, no
 * description, no colour" — and `20260810100000_wear_diary_and_boards.sql`
 * makes that sentence the column list. This file is the third copy of it, so a
 * later "boards could have a colour" has to be argued in three places at once.
 */

/** A calendar day, `YYYY-MM-DD`. Same shape the `date` columns hold. */
export type IsoDay = string;

export type Board = {
  id: string;
  name: string;
  /**
   * Optional, and optional TOGETHER — the database rejects a half-range
   * (`boards_dates_paired`), because a board with one end of a range would
   * grow a "Send to Packing" action it could not honour. Every writer here
   * clears both or sets both; the constraint is the backstop, not the rule.
   */
  startsOn: IsoDay | null;
  endsOn: IsoDay | null;
  /**
   * When the board was made — `boards.created_at`, which the migration has
   * always carried. SV-02 prints its month ("started in March") on an undated
   * board, where there is no trip range to show instead.
   *
   * Nullable in the domain type only: a caller that has not read the column
   * drops the clause rather than inventing a date.
   */
  createdAt: string | null;
};

/**
 * A kept plate — one `outfits` row with `saved_at` set.
 *
 * `wornCount` is NOT `items.wear_count` and is not the row's own `worn_at`.
 * It is the number of confirmed wears whose `origin_outfit_id` points back at
 * this plate, which is the only thing the schema can answer honestly: every
 * confirm inserts a fresh outfit row, so a look's history lives in its
 * descendants rather than in itself. See the migration's own header.
 */
export type KeptPlate = {
  id: string;
  /**
   * Whatever it was given when kept, or the occasion it was planned for.
   * NEVER auto-generated from the garment list — that grammar belongs to the
   * diary (KP's "The plate at rest"). Null when it was given no name, and the
   * card then prints the occasion, or nothing at all.
   */
  name: string | null;
  occasion: string | null;
  savedAt: string;
  boardId: string | null;
  wornCount: number;
  /** Every piece in the look, in the order it was built. */
  itemIds: string[];
  /**
   * Up to four storage paths, one per cell of the 2×2 tray, already reduced
   * to the best available render for each piece (plate → cutout → thumbnail).
   * Four entries always: a three-piece look carries a trailing null so the
   * fourth cell stays empty rather than the grid stretching.
   */
  imagePaths: (string | null)[];
};
