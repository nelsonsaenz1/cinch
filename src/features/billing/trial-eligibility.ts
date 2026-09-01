/**
 * Can this account be OFFERED an introductory (trial) price?
 *
 * THE HONEST ANSWER IS USUALLY "UNKNOWN", AND UNKNOWN MEANS ASK. Apple decides
 * intro-offer eligibility per Apple ID at purchase time, and the purchase
 * sheet is the only surface that renders the true offer. Nothing the client
 * derives can beat that — so this hook exists to keep the app from making the
 * one claim it CAN check ("you're already subscribed") and to feed the
 * `trial_eligibility` analytics, never to gate a paywall shut.
 *
 * THE SEAM, documented because it will move: expo-superwall 1.2.0 (the
 * installed SDK — checked against node_modules/expo-superwall/build/src on
 * 2026-08-31) exposes no product or intro-offer eligibility API. There is no
 * `getProducts`, and neither the presentation result nor the store slice
 * carries StoreKit's `isEligibleForIntroOffer`. So the derivation is the
 * defensible minimum:
 *
 *   - `subscriptionStatus.status === 'ACTIVE'` → 'ineligible'. An active
 *     subscriber cannot start an intro offer on the tier they hold, and this
 *     is the one branch the SDK genuinely vouches for.
 *   - anything else (INACTIVE, UNKNOWN, not yet loaded) → 'unknown', which
 *     callers treat as eligible-to-ASK: present the paywall, and let the
 *     purchase sheet say what the offer really is.
 *
 * 'eligible' is IN the union but never returned today. It is reserved for the
 * SDK version that exposes real per-product eligibility; keeping the member
 * now means call sites branch on three states from day one and the upgrade
 * changes this file alone.
 */

import { useEffect } from 'react';
import { useSuperwall } from 'expo-superwall';

import { track } from '@/lib/posthog';

import { PAYWALLS_ENABLED } from './superwall';

export type TrialEligibility = 'eligible' | 'ineligible' | 'unknown';

/**
 * ONCE PER APP-OPEN CHANGE, not once per render and not once per mount.
 *
 * Module-level rather than a ref so several mounts of the hook share one
 * ledger — the point of the event is the transition (unknown → ineligible as
 * the SDK loads status, say), and two screens both holding the hook must not
 * report it twice. Reset only by process death, which is what "per app-open"
 * means.
 */
let lastTracked: TrialEligibility | null = null;

function trackChange(state: TrialEligibility): void {
  if (state === lastTracked) return;
  lastTracked = state;
  track('trial_eligibility', { state });
}

function useSuperwallTrialEligibility(): TrialEligibility {
  const { subscriptionStatus } = useSuperwall((s) => ({
    subscriptionStatus: s.subscriptionStatus,
  }));

  const state: TrialEligibility =
    subscriptionStatus?.status === 'ACTIVE' ? 'ineligible' : 'unknown';

  // In an effect, not the render path: track() is IO, and the React Compiler
  // (rightly) rejects impure renders. The dep makes the effect re-run exactly
  // when the derived state moves, and the module-level ledger dedupes across
  // mounts.
  useEffect(() => {
    trackChange(state);
  }, [state]);

  return state;
}

/**
 * The keyless build has no SDK to ask and no purchase sheet to defer to, so
 * the answer is permanently 'unknown' — and deliberately untracked, for the
 * same reason the disabled gate never fires funnel events: a build that
 * cannot show a paywall has no eligibility funnel to measure.
 */
function useDisabledTrialEligibility(): TrialEligibility {
  return 'unknown';
}

/**
 * Picked once at module load, same as `useGate` and `useSdkPlan`:
 * `useSuperwall` throws with no provider above it, and the keyless build
 * renders none.
 */
export const useTrialEligibility: () => TrialEligibility = PAYWALLS_ENABLED
  ? useSuperwallTrialEligibility
  : useDisabledTrialEligibility;
