import type { IsoDay } from './types';

/**
 * "Send to Packing" — the one place a board touches another screen.
 *
 * ── WHAT THE DECISION WAS ──────────────────────────────────────────────────
 * A dated board **prefills the existing packing questionnaire** with its dates
 * and its pieces. It does not become a second door into packing. The
 * questionnaire is what produces the brief — where, who with, when, what kind
 * of thing it is — and a board can only answer one of those four. Skipping the
 * other three would produce a packing list with no reasoning behind it, which
 * is the one thing `membership-packing-contract.md` spends its length refusing.
 *
 * So this module carries an OFFER, not a command: the board's dates and its
 * distinct pieces, left where the Packing tab can pick them up, and nothing
 * about what to pack.
 *
 * ── WHY IT IS A MODULE SLOT AND NOT A ROUTE PARAM ──────────────────────────
 * `src/app/(tabs)/plan.tsx` holds the packing mode in `useState<Mode>('week')`
 * and reads no search params, and `features/plan/use-trip-questionnaire.ts`
 * keeps its half-answered run in a module-level slot of its own for exactly
 * the reason this one exists — answers have to survive a component that
 * unmounts whenever another segment is chosen. Both files belong to other
 * units this wave, so this side of the handoff is built and the other side is
 * filed (`.redesign/primitive-requests/k.md`). Two lines close it:
 *
 *     const handoff = takeBoardPackingHandoff();   // in PlanScreen
 *     // → setMode('packing') and seed the questionnaire's dates
 *
 * ── UNTIL THEN ─────────────────────────────────────────────────────────────
 * The button navigates to Plan and the offer waits. That is a real, if
 * shortened, path — the reader lands one tap from Packing rather than nowhere
 * — and it is reported as unfinished rather than dressed up. Nothing here
 * writes anything, so a handoff nobody collects costs nothing.
 *
 * ── THE PRO GATE ───────────────────────────────────────────────────────────
 * Not re-implemented here, deliberately. `usePackingAccess` is the boundary
 * and it fails closed; a free account that follows this offer meets the same
 * locked plate it would meet coming from the Plan tab, which is the correct
 * and only place that decision is made.
 */

export type BoardPackingHandoff = {
  boardId: string;
  boardName: string;
  /** Both, always — an undated board never raises the action at all. */
  startsOn: IsoDay;
  endsOn: IsoDay;
  /**
   * The board's DISTINCT pieces, in first-seen order. Distinct because that is
   * what goes in the bag: four looks sharing one pair of trousers are four
   * looks and one pair of trousers, and it is the same number the board's own
   * summary line prints.
   */
  itemIds: string[];
};

/** Where the offer is collected. Kept here so both ends name one route. */
export const PACKING_HREF = '/(tabs)/plan';

/**
 * One offer at a time, and it does not survive a cold start.
 *
 * A pending handoff is a thing the user did ten seconds ago on the way to
 * another screen. Persisting it would mean an app relaunched next Tuesday
 * opening on a trip nobody asked for.
 */
let pending: BoardPackingHandoff | null = null;

export function offerBoardToPacking(handoff: BoardPackingHandoff): void {
  pending = handoff;
}

/** Collect and consume. An offer is taken once; a second read gets nothing. */
export function takeBoardPackingHandoff(): BoardPackingHandoff | null {
  const handoff = pending;
  pending = null;
  return handoff;
}

/** Drop an offer nobody is going to collect — leaving a board, signing out. */
export function clearBoardPackingHandoff(): void {
  pending = null;
}
