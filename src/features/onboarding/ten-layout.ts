/**
 * The Ten's grid geometry, and the one recomposition it makes at the largest
 * Dynamic Type settings (T-02 / AX).
 *
 * Pure arithmetic, in a `.ts` with no React in it, for the reason every module
 * in this folder is: `scripts/run-tests.mjs` bundles with esbuild, which cannot
 * parse React Native's Flow source, so a rule a test needs to check has to be
 * reachable without importing a component.
 *
 * WHY THE AX BRANCH IS A RECOMPOSITION AND NOT A CAP
 *
 * The atlas is explicit that larger type is solved "with height, wrapping and
 * recomposition — never by capping the scale further or adding ellipses". Three
 * 111pt columns at the largest setting leave a 12px slot word rendered at ~22px
 * inside a cell it no longer fits; shrinking the label back down would be
 * capping the scale, and truncating it would be an ellipsis. So the grid drops
 * to two columns and the cell becomes square, which buys the label both the
 * width and the height it now needs, and the ten cells become five rows that
 * scroll rather than four rows that lie.
 */

/** Columns at the default type scale — the atlas's three-up grid. */
export const TEN_COLUMNS = 3;

/** Columns once the reader is at an accessibility text size. */
export const TEN_COLUMNS_AX = 2;

/** The gap between cells, both axes. On the 1/8/12/20/24/28/44 spacing scale. */
export const TEN_GAP = 8;

/**
 * Cell height as a share of column width, read off the atlas's own drawing:
 * 86pt tall inside a 393pt frame whose three columns work out to ~111.
 *
 * A ratio rather than a hard 86 because the shape should survive a narrower
 * phone instead of only matching on the one the atlas was drawn at. Squaring
 * the cells, which is what shipped before, costs ~44% more height than the grid
 * has and pushes the tenth slot and the reasoning card below the fold —
 * breaking the single rule T-01 states outright.
 */
export const TEN_TILE_ASPECT = 86 / 111;

/**
 * Where the AX recomposition begins.
 *
 * iOS's five accessibility text sizes start above the largest standard one, and
 * `fontScale` crosses 1.35 at exactly that boundary on the current device
 * table. Below it the three-up grid holds; at or above it the layout is the
 * atlas's AX frame. One threshold, named once, so the grid and the reasoning
 * card cannot disagree about which layout they are in — a two-column grid above
 * a three-across action row is worse than either layout alone.
 */
export const TEN_AX_FONT_SCALE = 1.35;

export function isAccessibilityScale(fontScale: number): boolean {
  return fontScale >= TEN_AX_FONT_SCALE;
}

export function tenColumns(fontScale: number): number {
  return isAccessibilityScale(fontScale) ? TEN_COLUMNS_AX : TEN_COLUMNS;
}

/** Column width for a measured content width, at the columns that width holds. */
export function tenTileWidth(contentWidth: number, fontScale: number): number {
  const columns = tenColumns(fontScale);
  return (contentWidth - TEN_GAP * (columns - 1)) / columns;
}

/** The cell's height: the atlas ratio normally, square at accessibility sizes. */
export function tenTileHeight(width: number, fontScale: number): number {
  return isAccessibilityScale(fontScale) ? Math.round(width) : Math.round(width * TEN_TILE_ASPECT);
}
