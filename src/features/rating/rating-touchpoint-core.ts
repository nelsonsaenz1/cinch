/**
 * The shared cross-surface guard between Cinch's three independent rating
 * asks: the native settled-wear ask (`rating-ask-core.ts`), the custom
 * review card (`review-prompt-core.ts`), and the native post-share ask
 * (`features/share/capture-plate.ts`).
 *
 * ISSUE 6 (2026-08-31 funnel run) — THE COLLISION
 *
 * Each surface used to decide off its own storage key: `cinch.ratingAskedAt`,
 * `cinch.review.sessionCount.v1` / `cinch.review.done.v1`, and
 * `cinch.review.prompted-after-share`. None read another's. A wear
 * completion navigates through several modals — closing the wear sheet,
 * landing on a settled composition, then back to a tab root — which racks up
 * pathname moves and lands on a tab root inside the same window that
 * `askForRatingAfterWear`'s 700ms timer fires. The review card's own cadence
 * (session ≥ 2, dwell-or-moves settled-in) was frequently already satisfied
 * by that same navigation, so both the native sheet and the Cinch card could
 * appear within seconds of each other, over the same completion.
 *
 * THE FIX: one shared fact, "when did any rating surface last touch the
 * reader", that every surface writes the moment it actually fires and reads
 * before deciding to fire. This does not replace any surface's own cadence —
 * A still self-caps at `MIN_DAYS_BETWEEN_ASKS` (122) days between native
 * asks, B still returns every eligible session, C still
 * fires once ever after a share — it only forbids two DIFFERENT surfaces
 * from firing inside the same short window.
 *
 * WHY {@link TOUCHPOINT_COOLDOWN_DAYS} IS SHORT, NOT 122 DAYS
 *
 * The defect is about same-window stacking, not about spacing sessions
 * apart — each surface already owns its own spacing (122 days for the two
 * native asks; once per session, forever, for the card). A guard as long as
 * the native cadence would defeat the card's whole reason for existing: the
 * founder directive that a per-session ask needs a door the 3-per-year
 * native budget cannot open. One day is enough to guarantee no reader ever
 * sees two DIFFERENT surfaces inside the same sitting or the sittings either
 * side of a late-night completion, while leaving the card free to return
 * the very next session, exactly as designed.
 */

/** One shared timestamp, read and written by every rating surface. */
export const TOUCHPOINT_KEY = 'cinch.rating.lastTouchpointAt';

/** See the module doc for why this is short rather than matching the
 *  122-day native cadence. */
export const TOUCHPOINT_COOLDOWN_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A stored value that does not parse is treated as never-touched, same
 *  convention as `rating-ask-core.ts`'s own marker. */
function parseStamp(stored: string | null): number | null {
  if (!stored) return null;
  const parsed = Date.parse(stored);
  return Number.isNaN(parsed) ? null : parsed;
}

/** True when ANY rating surface fired within the shared cooldown window. */
export function touchedRecently(now: Date, stored: string | null): boolean {
  const last = parseStamp(stored);
  return last !== null && now.getTime() - last < TOUCHPOINT_COOLDOWN_DAYS * DAY_MS;
}

/** The stamp every surface writes the moment — and only the moment — it
 *  actually fires. Never written on a "not now" or a skip. */
export function touchpointStamp(now: Date): string {
  return now.toISOString();
}
