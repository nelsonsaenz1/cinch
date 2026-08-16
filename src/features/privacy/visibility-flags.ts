/**
 * The four owner-held visibility flags, as data.
 *
 * Separate from `use-closet-visibility.ts` because that file imports the query
 * client and the Supabase client, which drag React Native into anything that
 * touches them — and the one part of this feature most worth testing directly
 * is the part that has no runtime at all: the inversion.
 *
 * ── STORED HIDDEN, SHOWN VISIBLE ──────────────────────────────────────────
 *
 * The columns are `*_hidden`: true means hidden. Everything above this file
 * reads the other way round — visible means friends can see it — because a
 * switch labelled with a thing and turned on should show the thing, and a
 * control whose ON means OFF is how somebody hides a closet they meant to
 * show. The inversion lives here and nowhere else, and both directions are
 * exercised by `tests/closet-visibility.test.ts` against these functions
 * rather than against a description of them.
 */

export type ClosetVisibility = {
  /** Friends can open the closet at all. Gates the other three. */
  closetVisible: boolean;
  piecesVisible: boolean;
  wearsVisible: boolean;
  costPerWearVisible: boolean;
};

export type VisibilityFlag = keyof ClosetVisibility;

/** The column each switch writes. Stored inverted. */
export const VISIBILITY_COLUMNS = {
  closetVisible: 'closet_hidden',
  piecesVisible: 'stat_pieces_hidden',
  wearsVisible: 'stat_wears_hidden',
  costPerWearVisible: 'stat_cost_per_wear_hidden',
} as const;

/** Today's default for every account, and the answer when no row exists yet. */
export const ALL_VISIBLE: ClosetVisibility = {
  closetVisible: true,
  piecesVisible: true,
  wearsVisible: true,
  costPerWearVisible: true,
};

/** The shape the four hidden columns arrive in. All optional: a row may predate them. */
export type VisibilityRow = {
  closet_hidden?: boolean | null;
  stat_pieces_hidden?: boolean | null;
  stat_wears_hidden?: boolean | null;
  stat_cost_per_wear_hidden?: boolean | null;
} | null;

/**
 * Row → switches. `?? false` on the HIDDEN side, so a missing row or a missing
 * column reads as today's default rather than as a closet nobody can see.
 */
export function visibilityFromRow(row: VisibilityRow): ClosetVisibility {
  return {
    closetVisible: !(row?.closet_hidden ?? false),
    piecesVisible: !(row?.stat_pieces_hidden ?? false),
    wearsVisible: !(row?.stat_wears_hidden ?? false),
    costPerWearVisible: !(row?.stat_cost_per_wear_hidden ?? false),
  };
}

/**
 * Switch → column patch, one flag at a time.
 *
 * Spelled out rather than built by computed key. `{ [COLUMNS[flag]]: hidden }`
 * types as `{ [x: string]: boolean }`, which the generated `Update` type
 * rejects on purpose — its index signature is `never`, so that a typo in a
 * column name cannot reach the database as a silently ignored key. Writing the
 * four keeps that protection: rename a column and this stops compiling.
 */
export function visibilityPatch(flag: 'closetVisible', visible: boolean): { closet_hidden: boolean };
export function visibilityPatch(
  flag: 'piecesVisible',
  visible: boolean,
): { stat_pieces_hidden: boolean };
export function visibilityPatch(
  flag: 'wearsVisible',
  visible: boolean,
): { stat_wears_hidden: boolean };
export function visibilityPatch(
  flag: 'costPerWearVisible',
  visible: boolean,
): { stat_cost_per_wear_hidden: boolean };
export function visibilityPatch(
  flag: VisibilityFlag,
  visible: boolean,
): Record<string, boolean>;
export function visibilityPatch(flag: VisibilityFlag, visible: boolean): Record<string, boolean> {
  const hidden = !visible;
  switch (flag) {
    case 'closetVisible':
      return { closet_hidden: hidden };
    case 'piecesVisible':
      return { stat_pieces_hidden: hidden };
    case 'wearsVisible':
      return { stat_wears_hidden: hidden };
    case 'costPerWearVisible':
      return { stat_cost_per_wear_hidden: hidden };
  }
}

/**
 * Whether the three stat switches can act.
 *
 * `friend_closet_meta` nulls all three behind
 * `case when p.closet_hidden or p.stat_*_hidden`, so with the closet hidden
 * they already answer null however they are set. A live switch there would
 * change nothing and say it had.
 */
export function statsOverridden(visibility: ClosetVisibility): boolean {
  return !visibility.closetVisible;
}

/**
 * What a friend actually receives, given the flags.
 *
 * This mirrors the two views in SQL — it is not the enforcement, which is
 * server-side and already shipped, but it is the same rule written where a
 * test can exercise every combination without a database. If these two ever
 * disagree, the SQL wins and this is the bug.
 */
export function friendSees(visibility: ClosetVisibility): {
  closet: boolean;
  pieces: boolean;
  wears: boolean;
  costPerWear: boolean;
} {
  const closet = visibility.closetVisible;
  return {
    closet,
    pieces: closet && visibility.piecesVisible,
    wears: closet && visibility.wearsVisible,
    costPerWear: closet && visibility.costPerWearVisible,
  };
}
