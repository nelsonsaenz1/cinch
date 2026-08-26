import type { Plan } from './plans';

/**
 * Fold the server's plan and the Superwall SDK's on-device entitlement into
 * the one plan the UI acts on.
 *
 * WHY TWO SOURCES EXIST. `subscriptions.plan` is written only by
 * `superwall-webhook`, which arrives seconds — or, if the endpoint is ever
 * misconfigured, never — after a purchase. The SDK's `subscriptionStatus` is
 * StoreKit's own answer, synced by Superwall from App Store Server
 * Notifications, correct on cold launch with no round trip. A paying
 * subscriber whose webhook is late reads `free` from the row and `ACTIVE`
 * from the SDK; showing them a paywall in that window is the one wrong answer
 * that costs a refund request. So the UI takes the higher of the two.
 *
 * THE SERVER STAYS THE AUTHORITY FOR SPEND. Every AI call re-derives the plan
 * from the row on its own read; this fold decides only what to DRAW. A spoofed
 * SDK answer therefore buys screens, not service — the same bounded exposure
 * `usePlan.unconfirmed` already accepts in the other direction.
 *
 * Never DOWN: an SDK that answers `INACTIVE` or `UNKNOWN` contributes nothing,
 * because absence of an entitlement on this device is not evidence against the
 * row (family sharing, a second Apple ID, a slow SDK fetch all read INACTIVE).
 */
const RANK: Record<Plan, number> = { free: 0, standard: 1, pro: 2 };

export function foldPlan(server: Plan, sdk: Plan | null): Plan {
  if (sdk === null) return server;
  return RANK[sdk] > RANK[server] ? sdk : server;
}

/**
 * Map the SDK's active entitlement identifiers to a plan.
 *
 * The identifiers are the Superwall dashboard's own (`pro`, `standard` —
 * project 28319), which deliberately spell the plan names in `plans.ts`.
 * Anything unrecognised maps to nothing rather than to a guess: an entitlement
 * this app has never heard of must not unlock a tier it never priced.
 */
export function planFromEntitlements(ids: readonly string[]): Plan | null {
  if (ids.includes('pro')) return 'pro';
  if (ids.includes('standard')) return 'standard';
  return null;
}
