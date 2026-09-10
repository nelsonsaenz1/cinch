/**
 * Frequency caps for the paywalls the APP initiates.
 *
 * Two kinds of placement live in placements.ts, and only one of them is
 * capped. The contextual gates — over-limit refusals, `packing_access`,
 * `open_stylist`, `membership_upgrade`, the event join/hosting ceilings,
 * `repeat_upsell` — fire because the user deliberately asked for a thing the
 * plan excludes, and refusing to answer THAT with an offer would just leave
 * the refusal copy with no door in it. They are never counted here.
 *
 * The GENERAL promos are different: `ten_completed`, `reveal_complete`,
 * `returning_free` and `trial_expired` are moments the app picked, not the
 * user. An app that picks too many of them is nagging, and nagging is how a
 * wedge positioning ("the ten stay free") starts reading as bait. So:
 *
 *   - at most ONE general promo per rolling 24 hours,
 *   - at most THREE per rolling 7 days,
 *   - and never `ten_completed` then `reveal_complete` back to back — those
 *     two bracket the Reveal, and a toll booth on both ends of the same road
 *     is the exact shape of ask this file exists to forbid.
 *
 * `ten_completed` IS NO LONGER PRESENTED BY THE APP (A68, 2026-09-10): the
 * beat between the tenth garment and the Reveal was putting every stranger's
 * first ask 4–60 seconds BEFORE her first outfit, and the pair rule then
 * silenced the post-outfit ask for a day. The first general ask is now
 * `reveal_complete`, after the outfit. The placement stays in the set and the
 * pair rule stays in the arithmetic on purpose: rows shown before the change
 * are still in the 7-day ledger, and a row that landed must keep binding.
 *
 * THE LEDGER IS SERVER ROWS, NOT DEVICE STORAGE. Impressions are recorded to
 * `paywall_impressions` (owner-only RLS, created 2026-08-31) and read back
 * over a 7-day window. Rows are account-level, so a reinstall — or a second
 * device — cannot reset the caps: the next fetch sees the same history. The
 * deliberate cost is offline tolerance in the other direction: an insert that
 * fails is swallowed, and until a later fetch sees whatever rows did land,
 * the caps run on the server's view of history rather than a perfect one.
 * Being wrong there shows someone one extra offer; being strict would make
 * a network blip block the Reveal path, which is forbidden outright.
 *
 * The decision itself (`evaluatePromoCaps`) is pure and dependency-free so
 * tests/promo-caps.test.ts can execute every boundary under `node --test`;
 * the thin IO wrapper (`recordImpression`, `fetchRecentImpressions`) lives in
 * promo-caps-io.ts, split out the way trial-expired-core.ts is from its hook,
 * so importing the arithmetic never drags a Supabase client into a test.
 */

import { Placement, type PlacementName } from './placements';

/**
 * The placements the caps count — the app-initiated asks, and nothing else.
 *
 * A `Set<string>` on purpose: `evaluatePromoCaps` takes rows that came back
 * from Postgres, where the placement column is just text, and narrowing them
 * through the union first would make an unknown historical value throw the
 * evaluation off instead of simply not counting.
 */
export const GENERAL_PROMO_PLACEMENTS: ReadonlySet<string> = new Set([
  Placement.TenCompleted,
  Placement.RevealComplete,
  Placement.ReturningFree,
  Placement.TrialExpired,
]);

/** One row of the ledger, as the evaluation consumes it. */
export interface PromoImpression {
  readonly placement: string;
  readonly shownAtIso: string;
}

export type PromoCapReason = 'ok' | 'cap_24h' | 'cap_7d' | 'consecutive_ten_reveal';

export interface PromoCapVerdict {
  readonly allowed: boolean;
  readonly reason: PromoCapReason;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

/**
 * May `candidate` be shown at `nowIso`, given what has already been shown?
 *
 * `candidate` is an argument rather than baked in because the consecutive
 * rule is about a specific pair: `reveal_complete` is refused when the most
 * recent general promo was `ten_completed` within the last 24 hours. (That
 * pair is also caught by the 24-hour cap — one ask per day covers it — but
 * the reasons are kept distinct and the pair rule checked FIRST, so the
 * analytics can tell "you already asked today" from "you were about to ask
 * twice around one Reveal", which are different product bugs to fix.)
 *
 * Windows are ROLLING and half-open: an impression counts while
 * `now - shownAt < window`, so a row aged exactly 24h (or exactly 7d) has
 * left the window and no longer counts. Rows outside `GENERAL_PROMO_PLACEMENTS`,
 * in the future, or with unparseable timestamps are ignored — a contextual
 * gate the user invoked must never spend the general allowance, and a bad
 * row must never wedge every future promo shut.
 *
 * A candidate that is not itself a general promo is always 'ok': the caps
 * exist for the asks the app initiates, and the contextual gates go straight
 * to `gate.present()` without ever calling this.
 */
export function evaluatePromoCaps(
  nowIso: string,
  impressions: readonly PromoImpression[],
  candidate: PlacementName,
): PromoCapVerdict {
  if (!GENERAL_PROMO_PLACEMENTS.has(candidate)) return { allowed: true, reason: 'ok' };

  const now = new Date(nowIso).getTime();

  const counted = impressions
    .filter((row) => GENERAL_PROMO_PLACEMENTS.has(row.placement))
    .map((row) => ({ placement: row.placement, at: new Date(row.shownAtIso).getTime() }))
    .filter((row) => Number.isFinite(row.at) && row.at <= now)
    .sort((a, b) => a.at - b.at);

  const latest = counted[counted.length - 1];

  // The pair rule first, so its reason survives the overlap with cap_24h.
  if (
    candidate === Placement.RevealComplete &&
    latest !== undefined &&
    latest.placement === Placement.TenCompleted &&
    now - latest.at < DAY_MS
  ) {
    return { allowed: false, reason: 'consecutive_ten_reveal' };
  }

  if (counted.some((row) => now - row.at < DAY_MS)) {
    return { allowed: false, reason: 'cap_24h' };
  }

  if (counted.filter((row) => now - row.at < WEEK_MS).length >= 3) {
    return { allowed: false, reason: 'cap_7d' };
  }

  return { allowed: true, reason: 'ok' };
}
