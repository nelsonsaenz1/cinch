/**
 * What a Superwall event means for a user's plan.
 *
 * Extracted from `superwall-webhook/index.ts` for audit item 24, because the
 * reconciler has to reach the SAME verdict about a stored event that the webhook
 * reached about the live one. Two copies of this table would drift, and the
 * failure mode of drift here is a paying customer on the wrong tier — the exact
 * thing item 24 exists to fix.
 *
 * Deliberately dependency-free: no npm, no Deno, no database. That is what lets
 * the node test runner import it directly, so the product mapping and the
 * grant/revoke sets are covered by executable tests rather than by reading.
 */

export type Plan = 'free' | 'standard' | 'pro';

/**
 * The only products that grant anything, and what they grant.
 *
 * An unknown product id is an error rather than "free": a typo here, or a
 * product added in the dashboard and forgotten here, would otherwise silently
 * downgrade a paying customer at their next renewal. Loud is better.
 */
export const PRODUCT_PLANS: Record<string, 'standard' | 'pro'> = {
  'cinch.standard.monthly': 'standard',
  'cinch.standard.annual': 'standard',
  'cinch.pro.monthly': 'pro',
  'cinch.pro.annual': 'pro',
};

/**
 * Events that mean "this user is entitled right now".
 *
 * `product_change` is here because Superwall sends it with the NEW productId, so
 * it is handled by the same lookup as a fresh purchase.
 */
export const GRANTING: ReadonlySet<string> = new Set([
  'initial_purchase',
  'renewal',
  'uncancellation',
  'product_change',
]);

/**
 * Events that mean "this user is no longer entitled".
 *
 * `cancellation` is deliberately NOT in this set, and it is the easiest mistake
 * to make in this file. Cancelling turns off auto-renew; the user keeps what
 * they paid for until `expirationAt`. Revoking on cancellation takes away time
 * somebody has already bought. `expiration` is the event that actually ends it.
 *
 * `billing_issue` is also absent: Apple retries a failed charge for days, and
 * the subscription is in a grace period throughout. Downgrading on the first
 * failed charge punishes an expired card. If the retries fail, `expiration`
 * arrives on its own.
 */
export const REVOKING: ReadonlySet<string> = new Set(['expiration', 'subscription_paused']);

export type Verdict =
  /** Write this plan. */
  | { kind: 'grant'; plan: Plan }
  /** A real event that deliberately changes nothing. */
  | { kind: 'no_change' }
  /** A granting event whose productId is not in PRODUCT_PLANS. */
  | { kind: 'unmapped'; productId: string | null };

/**
 * The plan a single event asks for, before any staleness or storage concerns.
 *
 * Revocation is `grant: free` rather than its own kind because that is exactly
 * what it writes — the distinction between "granting free" and "revoking" has no
 * consequence downstream, and inventing one invites a caller to handle only
 * three of four cases.
 */
export function verdictFor(type: string, productId: string | null | undefined): Verdict {
  if (REVOKING.has(type)) return { kind: 'grant', plan: 'free' };
  if (!GRANTING.has(type)) return { kind: 'no_change' };

  const mapped = productId ? PRODUCT_PLANS[productId] : undefined;
  if (!mapped) return { kind: 'unmapped', productId: productId ?? null };
  return { kind: 'grant', plan: mapped };
}

/**
 * Whether an event describes a period that is already over, given what is stored.
 *
 * Svix guarantees delivery, not order. A `renewal` and the `expiration` of the
 * period it replaced can arrive backwards, and applying them in receipt order
 * would downgrade a user who just renewed. `expirationAt` is the authority on
 * recency, so an event describing a period ending no later than the one already
 * stored is stale.
 *
 * An event with no `expirationAt` is NEVER stale — `subscription_paused` has no
 * end date and must not become ignorable just because it lacks one.
 */
export function isStale(
  eventPeriodEnd: string | null,
  storedPeriodEnd: string | null | undefined,
  /**
   * Whether the event takes the plan AWAY. A revocation describes the END of
   * the period the last grant stored, so it carries that grant's exact
   * `expirationAt` — a tie is the normal case, not a replay, and must apply.
   * A grant at a tie is a replay (the same renewal from a second source, or
   * a late duplicate after the period already expired) and must not
   * re-grant. Found by the 2026-09-02 audit: with a single `<=` rule every
   * expiration was dropped as stale and a lapsed subscription kept its plan
   * for good.
   */
  revoking = false,
  /**
   * The plan currently stored. A GRANT at a tie is a replay only when the
   * stored row is already paid; against a row a revocation just set to
   * 'free' at that same date it is the REVERSAL of that revocation
   * (`REFUND_REVERSED`, `uncancellation`) and must apply — otherwise a
   * refund that Apple then reversed would leave the customer free for good.
   */
  storedPlan: Plan | null | undefined = undefined,
  /**
   * The plan the event grants. At a tie against a paid row, the SAME plan is
   * a replay and a DIFFERENT paid plan is a change — `product_change`,
   * Apple's `DID_CHANGE_RENEWAL_PREF/UPGRADE`, `OFFER_REDEEMED` — which
   * keeps the period end and must apply.
   */
  eventPlan: Plan | null | undefined = undefined,
): boolean {
  if (!eventPeriodEnd || !storedPeriodEnd) return false;
  // Compare INSTANTS, not strings. Superwall and Apple write
  // `…T00:00:00.000Z`; PostgREST returns `…T00:00:00+00:00`, and as strings
  // `'.'` and `'Z'` sort after `'+'`, so the same moment read as "later" and
  // the tie branch below was unreachable in production (verification).
  const event = Date.parse(eventPeriodEnd);
  const stored = Date.parse(storedPeriodEnd);
  if (Number.isNaN(event) || Number.isNaN(stored)) {
    // Unparseable on either side: fall back to the string order with the same
    // tie rule, never to the old "a tie is always stale".
    if (eventPeriodEnd === storedPeriodEnd) return revoking ? false : storedPlan !== 'free';
    return eventPeriodEnd < storedPeriodEnd;
  }
  if (event < stored) return true;
  if (event > stored) return false;
  // A tie.
  if (revoking) return false;
  if (storedPlan === 'free') return false;
  // A caller that does not know the plans is on the safe side: a replay.
  if (storedPlan == null || eventPlan == null) return true;
  return eventPlan === storedPlan;
}

/** Superwall's prefix for an anonymous, pre-`identify()` user id. */
export const ALIAS_PREFIX = '$SuperwallAlias:';

/**
 * Whether a string is a well-formed Superwall anonymous alias.
 *
 * `IdentityLogic.generateAlias()` in SuperwallKit is the prefix followed by a
 * `UUID().uuidString`, so anything else did not come from the SDK. The
 * reconciler checks this before touching the database: it is the difference
 * between a lookup by an opaque 122-bit value and a lookup by whatever a caller
 * felt like sending.
 */
export function isSuperwallAlias(value: string): boolean {
  if (!value.startsWith(ALIAS_PREFIX)) return false;
  const uuid = value.slice(ALIAS_PREFIX.length);
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);
}

/**
 * The single plan a set of stored alias events adds up to.
 *
 * A queue can hold more than one event for one alias — a purchase and then an
 * upgrade, or a purchase and then an expiration — and replaying them in receipt
 * order would let an early event win. So the newest period wins, on the same
 * `expirationAt` authority the live path uses, and events that change nothing
 * are skipped rather than counted as a downgrade to free.
 *
 * Returns null when nothing in the queue asks for a plan at all.
 */
export function reconcile(
  events: readonly { type: string; productId: string | null; periodEnd: string | null }[],
): { plan: Plan; periodEnd: string | null; unmapped: string[] } | null {
  const unmapped: string[] = [];
  let best: { plan: Plan; periodEnd: string | null } | null = null;

  for (const event of events) {
    const verdict = verdictFor(event.type, event.productId);
    if (verdict.kind === 'no_change') continue;
    if (verdict.kind === 'unmapped') {
      // Recorded, not thrown. One unrecognised product must not strand the rest
      // of a queue that this function can settle correctly — but the operator
      // still has to hear about it.
      if (verdict.productId) unmapped.push(verdict.productId);
      continue;
    }

    // A dated event wins only if it is strictly later than the one held, which
    // is `isStale` read the other way round. A DATELESS event always wins,
    // matching the live path's rule that a revocation with no `expirationAt`
    // applies unconditionally — so `subscription_paused` cannot be ignored just
    // because it carries no end date. Since events arrive here in receipt order,
    // that also settles pause-then-repurchase correctly in both directions.
    if (!best) {
      best = { plan: verdict.plan, periodEnd: event.periodEnd };
      continue;
    }
    if (
      !isStale(event.periodEnd, best.periodEnd, REVOKING.has(event.type), best.plan, verdict.plan)
    ) {
      best = { plan: verdict.plan, periodEnd: event.periodEnd };
    }
  }

  return best ? { ...best, unmapped } : null;
}
