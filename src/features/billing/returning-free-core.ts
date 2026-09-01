/**
 * When is a `returning_free` ask actually due? The arithmetic, and nothing else.
 *
 * `placements.ts` describes the door: a qualified return offer for a free
 * account that never trialed into a purchase and already holds at least one
 * valid outfit result. THIS module is the scheduling it defers to the call
 * site — "it needs the account's clock" — kept pure so
 * tests/returning-free.test.ts can execute every boundary under `node --test`,
 * the same split promo-caps.ts draws from promo-caps-io.ts.
 *
 * TWO WINDOWS, BOTH BOUNDED, AND THE BOUNDS ARE THE PRODUCT DECISION:
 *
 *   - day 3:  [3d, 6d)  — the first return ask, once, and only if no
 *                          `returning_free` ask has ever been shown.
 *   - day 7:  [7d, 14d) — the second and last, and only with breathing room:
 *                          no prior ask, or exactly one shown at least 3 days
 *                          ago. Two priors close this door for good.
 *
 * WHY BOUNDED, when an open-ended `age >= 3d` would be less code. A return
 * offer is an offer about a decision the person is still inside of: they built
 * a closet, saw their number, and are deciding whether the product earns a
 * place on their home screen. Day 3 and day 7 sit inside that deciding. The
 * same sheet on day 25 is not a return offer — the deciding is over, the app
 * was kept or abandoned, and an ask that late reads as spam from something
 * they forgot installing. The trial being sold is 7 days long, which is also
 * why there is no day-10 or day-14 ask: a cadence that outlives the thing it
 * sells has stopped being a schedule and become a drip campaign.
 *
 * The windows are half-open on the same convention as `evaluatePromoCaps`:
 * the day-3 window opens AT 72 hours exactly and the day-6 edge is excluded,
 * so a boundary instant belongs to exactly one answer and the tests can pin
 * both sides of every edge.
 *
 * EVERY UNREADABLE INPUT RESOLVES TO "NOT DUE". A garbage clock, a missing
 * account date, an impression whose timestamp will not parse — each collapses
 * to silence, because this module schedules an ask the app initiates, and the
 * polite wrong for an app that cannot prove its arithmetic is to not ask
 * (the same direction present-promo.ts takes on an unreadable ledger).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReturningFreeWindow = 'day3' | 'day7';

export interface ReturningFreeVerdict {
  readonly due: boolean;
  /** Which window answered, when `due` — for analytics-minded callers. */
  readonly window: ReturningFreeWindow | null;
}

/** One prior `returning_free` ledger row, as the evaluation consumes it. */
export interface ReturningImpression {
  readonly shownAtIso: string;
}

const NOT_DUE: ReturningFreeVerdict = { due: false, window: null };

/**
 * Is a `returning_free` ask due at `nowIso` for this account?
 *
 * `priorReturningImpressions` must already be filtered to
 * `placement === 'returning_free'` — the caller has the full ledger from
 * `fetchRecentImpressions()` and the filter belongs beside the fetch, so this
 * function never has to know what other placements exist. The 7-day fetch
 * window is sufficient for both rules: a day-3 impression is at most ~4 days
 * old when the day-7 window is being evaluated, so "no prior impression" and
 * "exactly one, shown >= 3d ago" are both answerable from a week of rows.
 *
 * `outfitCount` is the qualification the placement doc names — someone who has
 * never seen their closet make a number does not know what they would be
 * returning to, and asking them back is asking them to a room they never saw.
 * Zero (or a nonsensical negative) is never due, in any window.
 *
 * This decides the SCHEDULE only. Plan, trial state and the general frequency
 * caps are `presentPromo()`'s to enforce, and the caller must still go through
 * it — a due verdict is "the calendar says now", not "show the sheet".
 */
export function evaluateReturningFree(
  nowIso: string,
  accountCreatedAtIso: string,
  outfitCount: number,
  priorReturningImpressions: readonly ReturningImpression[],
): ReturningFreeVerdict {
  const now = new Date(nowIso).getTime();
  const created = new Date(accountCreatedAtIso).getTime();
  if (!Number.isFinite(now) || !Number.isFinite(created)) return NOT_DUE;

  // An account "created in the future" is a broken clock somewhere; silence.
  const age = now - created;
  if (age < 0) return NOT_DUE;

  if (!Number.isFinite(outfitCount) || outfitCount < 1) return NOT_DUE;

  const priors = priorReturningImpressions.length;

  if (age >= 3 * DAY_MS && age < 6 * DAY_MS) {
    // The first ask, and strictly the first: any prior returning_free row —
    // however old, however unreadable its timestamp — means this window
    // already spent itself.
    return priors === 0 ? { due: true, window: 'day3' } : NOT_DUE;
  }

  if (age >= 7 * DAY_MS && age < 14 * DAY_MS) {
    if (priors === 0) return { due: true, window: 'day7' };
    if (priors === 1) {
      // The spacing rule: the day-3 ask must be at least 3 days behind us, so
      // the two asks can never crowd into the same stretch of days. A
      // timestamp that will not parse fails the test — recency unprovable,
      // and unprovable resolves to silence.
      const shownAt = new Date(priorReturningImpressions[0]!.shownAtIso).getTime();
      if (Number.isFinite(shownAt) && now - shownAt >= 3 * DAY_MS) {
        return { due: true, window: 'day7' };
      }
    }
    // Two priors: both asks are spent. This placement never asks a third time.
    return NOT_DUE;
  }

  // Outside both windows — before day 3, the gap between 6 and 7, and
  // everything past day 14. The trial is 7 days; the calendar ends with it.
  return NOT_DUE;
}
