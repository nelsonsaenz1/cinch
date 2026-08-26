import { useSuperwall } from 'expo-superwall';

import type { Plan } from './plans';
import { planFromEntitlements } from './plan-fold';
import { PAYWALLS_ENABLED } from './superwall';

/**
 * The plan the Superwall SDK can vouch for on this device, or null.
 *
 * StoreKit's answer, not ours: SuperwallKit keeps `subscriptionStatus` synced
 * from the App Store server-side, so it is correct on cold launch — including
 * the launch right after a purchase whose webhook has not landed in
 * `subscriptions.plan` yet. `usePlan` folds this in (see plan-fold.ts) so a
 * paying subscriber is never shown a paywall while the row catches up.
 *
 * Returns null — never 'free' — when the SDK reports INACTIVE or UNKNOWN:
 * this hook can only ever raise the plan, and silence is its way of saying
 * "no evidence", which is different from "not a member".
 */
function useSuperwallSdkPlan(): Plan | null {
  const { subscriptionStatus } = useSuperwall((state) => ({
    subscriptionStatus: state.subscriptionStatus,
  }));

  if (subscriptionStatus?.status !== 'ACTIVE') return null;
  return planFromEntitlements(subscriptionStatus.entitlements.map((e) => e.id));
}

/** The keyless build has no SDK to ask, and no paywall to have bought from. */
function useDisabledSdkPlan(): Plan | null {
  return null;
}

/**
 * Picked once at module load, same as `useGate`: `useSuperwall` throws with no
 * provider above it, and the disabled build renders none.
 */
export const useSdkPlan: () => Plan | null = PAYWALLS_ENABLED
  ? useSuperwallSdkPlan
  : useDisabledSdkPlan;
