/**
 * Pure Look Board arithmetic — the crown/tie rule and the one-pick-per-board
 * vote count — held against the Look Board State Atlas (L-01…L-06) and the
 * frozen contract, `docs/design/event-social-contract.md` §3.
 *
 * Kept out of `outfits.tsx` / `OutfitPostCard.tsx` on purpose: both are
 * `.tsx`, and the test bundler cannot parse React Native's Flow source
 * through a component import (hard rule #7). This module has no React import
 * at all.
 *
 * ── The model this assumes ──────────────────────────────────────────────
 * The board is ONE rail across every attendee's posted look, not one rail
 * per attendee. The frozen contract says so in the singular throughout §3 —
 * "the crown on the favourite", "One crown, no second or fifth" — and the
 * Look Board atlas draws L-01 through L-06 as a single snapping rail mixing
 * different posters' cards with one shared dot-pagination and one crown. The
 * per-attendee `AttendeeBoard` grouping in `types.ts` stays exactly as it
 * was for Event Detail's own "your board's leading look" feature (a
 * different, legitimate question — "which of MY OWN options is ahead" — and
 * `boardLeader` there is intentionally never called across posters). This
 * module answers the Look Board's different question: which ONE look, out of
 * every look on the page, is the room's favourite.
 */

/** The minimal shape this module needs from a posted look. */
export type LookTally = {
  id: string;
  votes: number;
};

/**
 * The board's one crown — "The favourite" once locked, "Ahead" before.
 * Computed across every look on the page, never per poster.
 *
 * Sticky on a tie: "A tie holds the crown where it was" (contract §3; the
 * atlas's own live demo: "the board does not crown two looks, and it does
 * not un-crown one on a draw"). A pure vote-count comparison can't express
 * "where it was" by itself — two looks tied at 3 doesn't say which one got
 * there first — so the caller carries the previous result forward across
 * renders and this function only ever *keeps* that answer through a tie, it
 * never invents a winner among equals.
 *
 * A board with no votes at all crowns nothing (`withVotes` empty → null),
 * which is the same "zero is quiet" instinct as the count line: a crown on a
 * card nobody picked would be a fabricated favourite.
 */
export function favouriteId(
  looks: readonly LookTally[],
  previousId: string | null,
): string | null {
  const withVotes = looks.filter((l) => l.votes > 0);
  if (withVotes.length === 0) return null;

  const max = Math.max(...withVotes.map((l) => l.votes));
  const leaders = withVotes.filter((l) => l.votes === max);

  if (leaders.length === 1) return leaders[0]!.id;

  // Tied. The crown stays put only if it is still among today's leaders.
  if (previousId && leaders.some((l) => l.id === previousId)) return previousId;
  return null;
}

/** Moving (or casting, or retracting) the caller's one pick between looks. */
export type PickMove = {
  /** The look the caller's pick is leaving, or null if this is a first cast. */
  fromPostId: string | null;
  /** The look the caller's pick is joining, or null if this is a retraction. */
  toPostId: string | null;
};

/**
 * The one-pick-per-board arithmetic, held on the BOARD and not the card
 * (contract §3): moving a pick decrements the card left and increments the
 * card joined in the same pass, never a card that is neither.
 *
 * Pure and immutable — returns a new array, and returns the exact same `look`
 * object reference for every row whose count didn't move, so a caller memoing
 * on look identity elsewhere doesn't get invalidated by an unrelated vote.
 */
export function applyPickMove<T extends { id: string; votes: number }>(
  looks: readonly T[],
  move: PickMove,
): T[] {
  if (move.fromPostId === move.toPostId) return [...looks];
  return looks.map((look) => {
    let votes = look.votes;
    if (move.fromPostId === look.id) votes -= 1;
    if (move.toPostId === look.id) votes += 1;
    return votes === look.votes ? look : { ...look, votes };
  });
}

/** "Mel, Tom and Priya" — no Oxford comma, "and" only before the last name. */
export function joinWithAnd(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export type PickLine = { count: number; iVoted: boolean; otherNames: string[] };

/**
 * "3 picks · Mel, Tom and Priya" / "5 picks · you, Dana, Ben, Tom and Priya"
 * — voter names in full, "you" first when the caller has picked, joined with
 * "and" before the last. `null` when nobody has: "Zero is quiet. A look with
 * no picks prints no count line at all... the cruellest string in the app"
 * (contract §3) — the component prints nothing at all for this case, never
 * "0 picks".
 */
export function pickLine(
  count: number,
  iVoted: boolean,
  otherNames: readonly string[],
): PickLine | null {
  if (count <= 0) return null;
  return { count, iVoted, otherNames: [...otherNames] };
}
