/**
 * THE COMPOSED-LOOK GRID — Wave 3, audit item 58.
 *
 * The plate used to draw the look as `stackLayout`: absolutely-positioned
 * cutouts at four different sizes, overlapping like worn clothes. The Wave 3
 * atlas retires that treatment on Today and states the replacement as a
 * checkable rule — "No garment is a colour block. No tile covers another. Every
 * piece in the look is named in the list beneath it" — with the composition
 * drawn at three, four, five and six pieces and one further requirement: no
 * blank cell that could be mistaken for a failed image.
 *
 * This module is that composition, and ONLY that: how many cells sit on each
 * row. It is deliberately separate from `stackLayout` in `garment-cell.ts`
 * rather than a replacement for it, because three surfaces outside this lane
 * still draw the stack (`app/repeat-outfit.tsx`, `app/dev-repeat.tsx`,
 * `components/event-outfits/OutfitPostCard.tsx`). Changing the shared function
 * would silently recompose all three; adding one leaves them exactly as they
 * were.
 *
 * ── One scale ──────────────────────────────────────────────────────────────
 * Every row is the same HEIGHT, whatever it holds, so no piece is drawn larger
 * than another — that is what "one grid at one scale" buys, and it is why the
 * height is a ratio of the grid's width rather than a per-slot table. Cells
 * stretch horizontally to fill the row, which is what stops a short look from
 * leaving a gap where a cell would be.
 */

/** The gap between cells, and between rows. On the 1/8/12/20/24/28/44 scale. */
export const GRID_GAP = 8;

/**
 * Row height ÷ grid width.
 *
 * 0.46 puts a two-row grid at roughly 300 pt on a 393 pt frame, which is the
 * height the atlas draws the five-piece plate at, and a one-row grid (the
 * four-up the occasion interrupt composes to) at roughly 150 — the 96 pt the
 * interrupt costs, given back by the plate.
 */
export const ROW_RATIO = 0.46;

/**
 * How the cells fall, row by row, for a look of `count` pieces.
 *
 * The drawn cases, from the atlas:
 *   3 — "Three pieces, 2-up + full"        → [2, 1]
 *   4 — "the plate composes at four pieces on one row" → [4]
 *   5 — the T-01 plate                     → [3, 2]
 *   6 — the plate's stated ceiling         → [3, 3]
 *
 * Five is the one case the atlas draws differently: it draws six cells, the
 * sixth being a "Swap a piece" affordance. That cell is NOT drawn here — see
 * the stop condition recorded in `plate.tsx` — and a six-cell grid holding five
 * garments and nothing else would be exactly the blank cell the acceptance
 * check forbids. [3, 2] is the same five photographs with no empty cell.
 *
 * Above six the engine can still hand over a look (a hat and a bag on top of a
 * five-piece core), so the rule generalises rather than throwing: rows of three,
 * with the remainder on the last row. Nothing is dropped — every piece in the
 * look is in the grid, and every piece is named beneath it.
 */
export function plateGrid(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 2) return [count];
  if (count === 3) return [2, 1];
  if (count === 4) return [4];
  if (count === 5) return [3, 2];

  const rows: number[] = [];
  let left = count;
  while (left > 0) {
    rows.push(Math.min(3, left));
    left -= 3;
  }
  return rows;
}

/** The grid's own height, given the width it was laid into. */
export function gridHeight(rows: number[], width: number): number {
  if (rows.length === 0) return 0;
  return rows.length * width * ROW_RATIO + (rows.length - 1) * GRID_GAP;
}
