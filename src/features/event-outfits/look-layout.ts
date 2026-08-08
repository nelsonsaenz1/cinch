/**
 * How a composed look divides into a grid.
 *
 * Pure, and deliberately not inside the component that draws it: three
 * surfaces render this object — the board, the posting flow and the event
 * page's "Your look" card — so the arithmetic that decides how many plates
 * appear has to be one testable thing rather than a rule re-derived in each
 * view. Same reasoning as `features/closet/outfit-count.ts`.
 *
 * The geometry itself is a GRID, not Today's overlapping `stackLayout`. The
 * Share a Look atlas draws it as `1fr 1fr` to four pieces and `repeat(3,1fr)`
 * beyond, and that is a designed difference: an overlapping stack hides the
 * pieces a voter is comparing, and the board exists so one person's options
 * can be judged against each other.
 */

import type { Garment } from '@/lib/styling';

/** Above this, the grid goes three-up. At or below, two-up. */
const TWO_UP_MAX = 4;

/** Cells the plate will ever draw. Beyond it, the last cell counts the rest. */
export const MAX_CELLS = 6;

export type LookCell =
  | { kind: 'garment'; garment: Garment }
  | { kind: 'more'; count: number };

export function lookColumns(pieceCount: number): number {
  return pieceCount <= TWO_UP_MAX ? 2 : 3;
}

/**
 * The cells to draw, in stack order.
 *
 * Overflow follows the atlas exactly: "seven collapses to six plus a +2 plate
 * rather than shrinking every garment". Five real plates and a counted cell
 * keeps everything on screen at full size — a seventh cell would shrink all
 * six, which is the outcome the rule exists to prevent.
 *
 * Order is never re-sorted here. Piece one is the look's face, and the atlas
 * makes that load-bearing: it fills the thumbnail in Lately, on the event page
 * and on any share card.
 */
export function lookCells(pieces: readonly Garment[]): LookCell[] {
  if (pieces.length <= MAX_CELLS) {
    return pieces.map((garment) => ({ kind: 'garment', garment }));
  }
  const shown = pieces.slice(0, MAX_CELLS - 1);
  return [
    ...shown.map((garment): LookCell => ({ kind: 'garment', garment })),
    { kind: 'more', count: pieces.length - shown.length },
  ];
}
