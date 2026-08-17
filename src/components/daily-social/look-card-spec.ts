/**
 * The look card's layout decisions, as pure functions.
 *
 * Functions rather than constants and inline arithmetic in the markup, for the
 * reason `features/events/detail-layout.ts` gives: a constant in JSX cannot be
 * called from a node runner, and every one of this app's Dynamic Type bugs was
 * a constant that was correct at the size it was written at and wrong two steps
 * up. Font scale is READ FROM `useWindowDimensions().fontScale`, never guessed
 * and never inferred from a measured height.
 *
 * NOTHING HERE SHRINKS TEXT. Composition changes and height is allowed; there
 * is no cap, no ellipsis and no `numberOfLines` anywhere in this lane.
 */

import { plateGrid } from '@/components/today/plate-grid';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';

/**
 * Whether the look's name keeps its cap-trim.
 *
 * `trim` collapses a serif line box to the cap height with negative margins,
 * and the table it reads from is SINGLE-LINE geometry — `Text`'s own prop says
 * "display text only". An outfit name is one line of `plate` at the default
 * size. Two steps up the same name wraps, and a margin sized for one line
 * subtracted from a box holding two pulls the continuation under the collage.
 *
 * The same switch, at the same threshold, as the Today greeting and the event
 * detail title. One threshold, so the app becomes its large-type self once
 * rather than screen by screen — and deliberately NOT a guess from the name's
 * character count, which would trim or not trim depending on how a friend
 * happened to name their outfit.
 */
export function lookNameTrimmed(fontScale: number): boolean {
  return fontScale < AX_FONT_SCALE;
}

/**
 * The pieces, cut into the rows `plateGrid()` lays out for their number.
 *
 * Pure and generic so the invariant that matters can be asserted directly:
 * **every piece lands in exactly one cell, and no cell is empty.** That is
 * what makes a look with fewer pieces than were worn compose as a complete
 * frame rather than as a grid with holes in it — three pieces are [2, 1], not
 * five slots with two gaps. A hidden garment is simply absent and the card must
 * not read as broken.
 *
 * Written here rather than inline in the component because the accumulator it
 * needs cannot live inside a `.map()` callback — `react-hooks/immutability`
 * rejects a variable reassigned during render, and it is right to: the same
 * closure re-running would produce a different grid.
 */
export function collageRows<T>(pieces: readonly T[]): T[][] {
  const rows = plateGrid(pieces.length);
  const out: T[][] = [];
  let taken = 0;
  for (const cells of rows) {
    out.push(pieces.slice(taken, taken + cells));
    taken += cells;
  }
  return out;
}
