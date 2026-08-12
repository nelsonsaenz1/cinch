/**
 * The comment thread's ONE measurement — audit 93.
 *
 * "The comment column is fixed at 261 pt regardless of avatar, name length or
 * overflow control, so a two or three line comment wraps in the same rectangle
 * every time." The avatar and the overflow control are both `flex:none`
 * OUTSIDE the column, which is what makes that true: if the column were
 * `flex-1` the reading measure would be 393 minus whatever the name and the
 * controls happened to take that day, and a three-line comment from
 * "Marguerite Okonkwo-Bell" would wrap differently from the same three lines
 * under "Jonas".
 *
 * A reply indents 26 pt and narrows to 235 — still a stable rectangle, one
 * indent level only.
 *
 * ── Why this is a constant and not a layout ────────────────────────────────
 *
 * Audit 11 of the group's accessibility section is explicit: "The comment
 * column is the one measurement that does not scale with type: it stays 261 pt
 * and the comment simply grows taller, which is what keeps a three-line
 * comment a stable rectangle at every size." So this is a hard pt value, NOT a
 * percentage and NOT derived from the window: a Dynamic-Type-scaled column
 * would rewrap the same comment at every size, which is exactly the defect the
 * fixed column exists to prevent.
 *
 * Held in a `.ts` with no React import so `tests/comments-column.test.ts` can
 * assert the invariant — the test bundler cannot parse React Native's Flow
 * source through a component import (the same rule `look-layout.ts` and
 * `board-logic.ts` are written under).
 */

/** The reading column, top level. Never scales, never flexes. */
export const COMMENT_COLUMN = 261;

/** One indent level, and the only one — a reply to a reply is still a reply. */
export const REPLY_INDENT = 26;

/** 261 − 26. Written as the arithmetic so the two can never drift apart. */
export const REPLY_COLUMN = COMMENT_COLUMN - REPLY_INDENT;

/**
 * The reading column for a row, and the indent it sits at.
 *
 * Both values in one call because they are one decision: a caller that took
 * the indent from here and the width from a class name would be free to
 * disagree with itself.
 */
export function commentColumn(isReply: boolean): { width: number; indent: number } {
  return isReply
    ? { width: REPLY_COLUMN, indent: REPLY_INDENT }
    : { width: COMMENT_COLUMN, indent: 0 };
}
