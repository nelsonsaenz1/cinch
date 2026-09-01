/**
 * The decision flow of the App Store rating ask, with its IO injected.
 *
 * Same split as `billing/trial-expired-core.ts`, for the same reason: no
 * React, no native import, so the node suite can execute every branch rather
 * than grep the call site.
 *
 * WHEN CINCH ASKS, AND WHY THERE
 *
 * The ask fires as the wear-confirmation sheet's settled composition is
 * dismissed — the reader just logged a wear, watched it become history, and
 * pressed Done. That is the one moment in the app where Cinch has visibly
 * finished the job it was installed for, and it is a moment with no task in
 * flight for a system sheet to interrupt. Nothing else may ask: not launch,
 * not sign-in, and never any error path. `tests/rating-ask.test.ts` pins the
 * single call site.
 *
 * WHY THE SELF-CAP IS STRICTER THAN APPLE'S
 *
 * `requestReview` is a REQUEST — iOS decides whether anything appears, and
 * caps displays at three per 365 days. Relying on that cap would still mean
 * calling on every wear, training the OS to burn all three prompts on the
 * app's heaviest week. One ask per {@link MIN_DAYS_BETWEEN_ASKS} keeps the
 * calls at most three a year BY CONSTRUCTION, so each one lands with the
 * budget intact.
 *
 * SHARED TOUCHPOINT (Issue 6, 2026-08-31)
 *
 * This is not the only surface that can ask — the review card
 * (`review-prompt-core.ts`) and the post-share native ask
 * (`features/share/capture-plate.ts`) are the other two. A wear completion
 * can land inside the same window as the card's own cadence, so before this
 * asks it also checks {@link TOUCHPOINT_KEY} — the fact "did ANY rating
 * surface just fire" — and stands down if one did. See
 * `rating-touchpoint-core.ts` for why the window is short. This does not
 * replace the 122-day self-cap above; it adds a second, independent reason
 * to refuse.
 */

import { TOUCHPOINT_KEY, touchedRecently, touchpointStamp } from './rating-touchpoint-core';

/** Storage key. A timestamp rather than a boolean so the cool-down is a fact
 *  about the last ask, not a flag somebody has to remember to reset. */
export const ASKED_KEY = 'cinch.ratingAskedAt';

/** 122 days: three asks fit in 365 with room, matching Apple's display cap
 *  one-for-one instead of gambling all three on one good week. */
export const MIN_DAYS_BETWEEN_ASKS = 122;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RatingAskIo {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  /** `StoreReview.requestReview()` behind `isAvailableAsync`. Fire-and-forget:
   *  iOS gives no signal of whether a card appeared. */
  request(): void;
  /** True once the owning screen has gone away. Checked at the same two points
   *  as the trial-expiry flow. */
  cancelled(): boolean;
}

/** What happened, for the tests. The call site ignores it. */
export type RatingAskOutcome =
  /** Asked within the window already — the common case for a daily user. */
  | 'too_soon'
  /** Another rating surface (the review card, or the post-share ask) fired
   *  inside the shared touchpoint window — this surface stands down. */
  | 'blocked_by_other_surface'
  /** Screen went away before the marker was read back. Nothing written. */
  | 'cancelled'
  /** Marker written, then gone before requesting — the deliberate "better
   *  wrong": one skipped ask, never a doubled one. */
  | 'marked_only'
  | 'requested';

/** A stored value that does not parse is treated as never-asked and gets
 *  overwritten with a real timestamp on the way through. */
function lastAskedAt(stored: string | null): number | null {
  if (!stored) return null;
  const parsed = Date.parse(stored);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function evaluateRatingAsk(
  now: Date,
  io: RatingAskIo,
): Promise<RatingAskOutcome> {
  const asked = lastAskedAt(await io.getItem(ASKED_KEY));
  if (io.cancelled()) return 'cancelled';

  if (asked !== null && now.getTime() - asked < MIN_DAYS_BETWEEN_ASKS * DAY_MS) {
    return 'too_soon';
  }

  // Second, independent guard: has ANY rating surface — this one, the
  // review card, or the post-share ask — fired inside the shared touchpoint
  // window? If so, this is the exact collision Issue 6 found and the
  // surface stands down without touching its own cadence marker. No
  // additional cancellation check here — the existing checks either side of
  // the write below are the only two points that matter.
  const otherTouch = await io.getItem(TOUCHPOINT_KEY);
  if (touchedRecently(now, otherTouch)) return 'blocked_by_other_surface';

  // Write BEFORE requesting, exactly like the trial-expiry marker: if the
  // process dies between these two lines the cost is one quiet cool-down,
  // where the other order could ask again tomorrow. Both this surface's own
  // marker and the shared touchpoint are written before the request, in the
  // same order, for the same reason.
  await io.setItem(ASKED_KEY, now.toISOString());
  await io.setItem(TOUCHPOINT_KEY, touchpointStamp(now));
  if (io.cancelled()) return 'marked_only';

  io.request();
  return 'requested';
}
