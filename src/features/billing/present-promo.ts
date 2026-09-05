/**
 * The qualified path for the paywalls the APP initiates.
 *
 * The contextual gates call `gate.present()` directly — a user who asked for
 * a locked feature has earned an immediate answer. The general promos
 * (`ten_completed`, `reveal_complete`, `returning_free`, `trial_expired`) go
 * through here instead, and the difference is everything this file does:
 * qualification, frequency caps, the eligibility denominator, the dismissal
 * event, and the impression ledger.
 *
 * THE ONE HARD GUARANTEE: `presentPromo` NEVER throws and always resolves.
 * Its callers include the beat between The Ten and the Reveal, and the Reveal
 * is not blockable — not by a paywall failure, not by a network error reading
 * the caps, not by anything in this file. Every failure collapses to a quiet
 * outcome the caller can walk past.
 *
 * HOOK-FREE by design. Qualification needs `plan` and `trialing`, but those
 * are read from `usePlan()` at the CALL SITE and passed in — this is a plain
 * async function so it can run inside effects, callbacks, and the pure-ish
 * flows the hooks rules would otherwise forbid, and so tests can drive it
 * without a renderer.
 */

import { track } from '@/lib/posthog';

import type { PlacementName } from './placements';
import type { Plan } from './plans';
import type { ContextLineOpts } from './context-lines';
import type { Gate, GateOutcome } from './use-gate';
import { evaluatePromoCaps, type PromoCapReason } from './promo-caps';
import { fetchRecentImpressions } from './promo-caps-io';

/**
 * Why a promo was or was not offered — the `reason` on `paywall_eligible`.
 *
 * The cap reasons come straight from `evaluatePromoCaps`; the three extra
 * members are the qualifications the caps cannot see: a paying (or trialing)
 * account, and a ledger that could not be read. Bounded on purpose, like
 * every reason enum the analytics carry.
 */
export type PromoIneligibleReason =
  | PromoCapReason
  | 'not_free'
  | 'trialing'
  | 'caps_unknown';

/**
 * What `presentPromo` resolved with. `GateOutcome` plus the one state a bare
 * gate never produces: the ask was withheld before Superwall was involved.
 */
export type PromoOutcome = GateOutcome | 'ineligible';

/**
 * How long the caps read may take before the ask is abandoned.
 *
 * THE GUARANTEE ABOVE IS NOT FREE. `fetchRecentImpressions()` is a network
 * call with no timeout of its own, and the failure that matters is not an
 * error — it is a HANG: a captive portal or a dead-but-open socket leaves the
 * promise pending forever. An unresolved promise here would strand
 * `presentPromo`, and with it the `finally` that routes The Ten to the Reveal.
 * That is the exact thing this module promises cannot happen, so the read is
 * raced against a clock and a timeout is treated like any other unreadable
 * ledger: stay quiet, let the caller move on.
 *
 * Three seconds because this runs inside a transition the user is already
 * waiting through — long enough for a slow-but-alive network, short enough
 * that nobody watches a spinner for it.
 */
const CAPS_READ_TIMEOUT_MS = 3000;

/** Reject with `caps_read_timeout` if `work` has not settled within `ms`. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('caps_read_timeout')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export interface PresentPromoOpts {
  /** From `usePlan()` at the call site — the folded plan in force. */
  readonly plan: Plan;
  /**
   * From `usePlan()` too. A trialing account is NOT shown acquisition asks:
   * the legacy promotional grant already gave them everything a trial would,
   * and asking someone to start what they are inside of reads as a bug.
   * (`plan === 'free'` alone would already exclude them — the fold raises a
   * trialing account to 'pro' — but the guard is kept explicit so neither
   * rule is load-bearing by accident, same reasoning as trial-expired-core.)
   */
  readonly trialing: boolean;
  /** Runs only on a grant, exactly as `Gate.present` documents. */
  readonly onGranted?: () => void | Promise<void>;
  /** Forwarded to the context line, e.g. `reveal_complete`'s outfit count. */
  readonly contextOpts?: ContextLineOpts;
}

/**
 * Offer one general promo, if this account has not been asked too much.
 *
 * `paywall_eligible` fires on EVERY call, offered or not — it is the
 * denominator. `paywall_presented` (from use-gate.ts's `onPresent`) over
 * `paywall_eligible` is the show rate; without the denominator, a cap that
 * silently ate every ask would be indistinguishable from a funnel with no
 * traffic.
 *
 * THE IMPRESSION SEAM MOVED (ledger A19, 2026-09-05). `paywall_impressions`
 * used to be written HERE, off the resolved outcome ('granted' | 'declined'),
 * which meant only the four general promos ever reached the table — the
 * contextual gates (`add_garment_over_limit` and its siblings) go straight to
 * `gate.present()` and never pass through this function, so the revenue
 * ledger's only server-side check on the paywall was blind to every tap-driven
 * ask. The 09-05 nightly read `paywall_presented` 5 against `paywall_eligible`
 * 3 and a table that held only the promo rows.
 *
 * The row is now written by `use-gate.ts` from Superwall's own `onPresent`,
 * beside `paywall_presented` — every placement, exactly when a sheet appears,
 * so the table and the event mean the same thing by construction. The caps
 * are unaffected: `evaluatePromoCaps` only ever counted rows whose placement
 * is in `GENERAL_PROMO_PLACEMENTS`, so the contextual rows that now land are
 * ignored by the arithmetic. One deliberate change of behaviour: a campaign
 * SKIP (holdout, audience filter) used to resolve 'granted' and spend the
 * allowance; a skip draws nothing and now records nothing.
 */
export async function presentPromo(
  gate: Gate,
  placement: PlacementName,
  opts: PresentPromoOpts,
): Promise<PromoOutcome> {
  try {
    let eligible = true;
    let reason: PromoIneligibleReason = 'ok';

    if (opts.plan !== 'free') {
      eligible = false;
      reason = 'not_free';
    } else if (opts.trialing) {
      eligible = false;
      reason = 'trialing';
    } else {
      try {
        const verdict = evaluatePromoCaps(
          new Date().toISOString(),
          await withTimeout(fetchRecentImpressions(), CAPS_READ_TIMEOUT_MS),
          placement,
        );
        eligible = verdict.allowed;
        reason = verdict.reason;
      } catch {
        // The ledger could not be read. An unreadable history must not be
        // treated as an empty one — when we cannot know whether we already
        // asked, the polite wrong is silence.
        eligible = false;
        reason = 'caps_unknown';
      }
    }

    track('paywall_eligible', { placement, eligible, reason });

    if (!eligible) return 'ineligible';

    const outcome = await gate.present(placement, opts.onGranted, opts.contextOpts);

    // The impression is recorded by the gate's `onPresent` (see the seam note
    // above), not here — nothing in this module writes the ledger.
    if (outcome === 'declined') {
      track('paywall_dismissed', { placement });
    }

    return outcome;
  } catch {
    // `gate.present` promises never to reject, but this path guards the
    // Reveal, and a promise about someone else's code is not a guarantee.
    return 'unavailable';
  }
}
