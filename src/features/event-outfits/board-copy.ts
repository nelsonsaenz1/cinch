/**
 * The Look Board's words — audit 95, 96, correction 24.
 *
 * Pure, and deliberately in a `.ts` with no React import: the count line's
 * zero-omission rule is an acceptance criterion ("zero counts are omitted"),
 * and an acceptance criterion the tests cannot import is a criterion nobody
 * checks. Same rule `board-logic.ts` is written under.
 *
 * ── What this module deliberately does NOT decide ──────────────────────────
 *
 * WHO leads. That is `board-logic.ts`'s `leadingId`. This module only says how
 * that leader is DRAWN, which audit 96 settles: "Ahead is 13 pt regular
 * secondary text, computed from the counts and present only while a look
 * genuinely leads; counts are 14 pt secondary and neither is a bar, a badge or
 * a percentage."
 *
 * NOTHING IS CROWNED, at any point. The conflict this file used to record as
 * unresolved — the atlas removing the crown while the shipping board crowned a
 * leader at lock — was settled by the founder in the atlas's favour (D-2b), and
 * `favouriteId`, `LeaderBadge` and the sticky-tie state went together.
 *
 * Nor does it decide WHEN the board locks. That is `events.starts_at`, and as
 * of `20260812120000_close_comments_and_lock_board.sql` it is a server rule
 * rather than a client comparison: `now() < coalesce(starts_at, 'infinity')`,
 * so an undated occasion stays open until an organizer sets a date. The lock
 * SENTENCE is here; the lock itself is in the database.
 */

/**
 * "3 votes" / "1 vote", or nothing at all.
 *
 * `null` at zero, never "0 votes". "Zero counts are omitted entirely — a look
 * with no picks prints no count line at all" (audit 96). The caller renders
 * nothing for `null`; it must not fall back to a dash, which the constitution
 * bans outright, nor to the word "none".
 *
 * Voter NAMES are not in this string and there is no parameter for them. The
 * atlas draws a bare count on every card in LB-01 and LB-02, and a board that
 * prints who voted for what turns a vote into a public statement about a
 * friend's clothes. The shipping `pickLine()` in `board-logic.ts` still builds
 * the named variant and is left alone for callers outside the board.
 */
export function voteCountLine(votes: number): string | null {
  if (votes <= 0) return null;
  return votes === 1 ? '1 vote' : `${votes} votes`;
}

/**
 * The word a leading card carries — and only a genuinely leading card.
 *
 * A tie returns `null`: "a tie removes Ahead rather than inventing a
 * tiebreak". So does a board where nobody has voted at all, and so does a
 * locked board, where nothing leads because nothing is decided.
 */
export function aheadLabel(args: {
  votes: number;
  isLeader: boolean;
  tied: boolean;
  locked: boolean;
}): string | null {
  if (args.locked || args.tied || !args.isLeader || args.votes <= 0) return null;
  return 'Ahead';
}

/**
 * True when the top of the board is shared — two or more looks at the same
 * non-zero count.
 */
export function isTied(votes: readonly number[]): boolean {
  const withVotes = votes.filter((v) => v > 0);
  if (withVotes.length < 2) return false;
  const max = Math.max(...withVotes);
  return withVotes.filter((v) => v === max).length > 1;
}

/**
 * The tie sentence — stated in words, and stating the thing a reader actually
 * needs: nothing was reordered.
 *
 * "The posting order is unchanged — the frame says so in words, because a
 * reader who saw a leader yesterday needs to know nothing was reordered."
 */
export function tieLine(): string {
  return 'Even. Neither is ahead, and the order has not changed since they were posted.';
}

/**
 * The footer under an open board.
 *
 * Says what the viewer holds (one pick, movable) and what the votes do NOT do
 * (choose anything). It does not name a time when there is no date to name:
 * `events.starts_at` is nullable, and a footer promising "until 8pm" on a
 * dateless board would be inventing a date.
 *
 * The null branch is not a hedge any more, it is the ruling. D-2a's predicate
 * is `now() < coalesce(starts_at, 'infinity')`, so an undated board genuinely
 * IS open indefinitely — until an organizer sets a date, at which point this
 * footer starts naming it. "While the board is open" is the literal truth of
 * that state rather than a careful way of avoiding one.
 */
export function openBoardFooter(untilLabel: string | null): string {
  const when = untilLabel ? `until ${untilLabel}` : 'while the board is open';
  return `You have one pick and can move it ${when}. Nobody’s look is chosen by the votes.`;
}

/**
 * The locked board's cause sentence — now asserting a rule that exists.
 *
 * DEPENDENCY B LANDED in `20260812120000_close_comments_and_lock_board.sql`:
 * `assert_vote_target()` refuses a late pick and `assert_vote_retractable()`
 * refuses a late retraction, both with `CL002`. So "the picks are final" is a
 * statement about the database rather than about this screen's willingness to
 * offer a pill, and it can be printed. Votes are kept and nothing is struck
 * out, which was true before and still is.
 *
 * An UNDATED occasion never reaches this string: the server predicate is
 * `now() < coalesce(starts_at, 'infinity')`, so a board with no date stays
 * open until an organizer sets one.
 */
export function lockedBoardLine(): string {
  return 'The occasion has started, so the board is locked. The picks are final, and every vote stays as it was.';
}

/**
 * "Four attendees" — the masthead's half that names the board as shared
 * rather than as one person asking for help (correction 24). `null` below one,
 * because "0 attendees" is a count printed at zero.
 */
export function attendeeLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 attendee' : `${count} attendees`;
}
