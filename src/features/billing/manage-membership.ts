/**
 * MB-08 — managing what you already pay for.
 *
 * A management page, not a sales page: no price, no accent, no retention
 * attempt. Everything on it is either a counter with a real read behind it or a
 * sentence about what happens next, and the two things it cannot do — cancel a
 * store subscription, and move overflow pieces into storage for you — are named
 * as somebody else's job rather than quietly promised.
 *
 * ── CORRECTION 36: ONLY MEASURABLE COUNTERS ───────────────────────────────
 *
 * The band is active and stored pieces, and nothing else. `useCapacity()`
 * counts both off `items` against `PLANS[plan]`, mirroring the two database
 * ceilings (20260805160000 and 20260808190100). The stylist-message and
 * hosted-event rows the earlier drawing carried had no read behind them:
 * `claim_ai_quota` holds the stylist allowance server-side and no client query
 * reads consumption, and nothing counts live hosted events either. A counter
 * with no read is a number the screen makes up.
 *
 * ── CORRECTION 35: NO AUTO-DOWNGRADE PROMISE ──────────────────────────────
 *
 * There is no job that files overflow into storage on downgrade, and the free
 * total ceiling is 30, so the overflow would in general have nowhere to go.
 * What the database actually does is narrower and better news, and is what this
 * page says: both ceilings are enforced `before insert on items`
 * (20260805160000:284) and `before update of is_archived`
 * (20260808190100:130). Neither fires on an existing row. So an over-ceiling
 * closet after a downgrade **stays exactly as it is** — every piece, every
 * photograph — and only adding and restoring are refused until it is back
 * under.
 *
 * THE ATLAS'S "Cinch will ask, and will not choose for you" IS NOT WRITTEN.
 * That sentence promises a chooser flow, and no such screen, mutation or job
 * exists anywhere in `src/` or `supabase/`. It is dependency C in the atlas's
 * own list; see `docs/design/wave-3-group-6.md`. Promising a flow that does not
 * exist is the same defect as promising an automatic one.
 *
 * Pure and React-free, for the reason `membership-row.ts` gives.
 */

import { PLANS, type Plan, type PlanCopy } from './plans';

import { membershipDate } from './membership-row';

/**
 * The page's opening sentence. Two facts: which tier, and how long the paid
 * access lasts — the second only when `current_period_end` is known.
 */
export function paidAccessLine(copy: PlanCopy, currentPeriodEnd: Date | null): string {
  const tier = `Cinch ${copy.name}.`;
  return currentPeriodEnd
    ? `${tier} Your paid access lasts through ${membershipDate(currentPeriodEnd)}, and everything below stays as it is until then.`
    : // No date read yet. The clause that needed one is dropped whole rather
      // than softened into "lasts until the end of your term", which sounds
      // like a fact and is a paraphrase of a value we do not have.
      `${tier} Everything below stays as it is for the rest of the term the App Store is holding.`;
}

/** One label-and-value pair in the entitlement band. */
export type EntitlementRow = { readonly label: string; readonly value: string };

/**
 * "Active pieces 148 of 150". Printed only when the count is known — `null`
 * while `useCapacity()` is in flight, because "0 of 150" is a claim about
 * somebody's closet and a pending count is not a zero.
 */
export function entitlementBand(input: {
  copy: PlanCopy;
  used: number | null;
  stored: number | null;
}): readonly EntitlementRow[] {
  const n = (v: number) => v.toLocaleString('en-US');
  const rows: EntitlementRow[] = [];
  if (input.used !== null) {
    rows.push({ label: 'Active pieces', value: `${n(input.used)} of ${n(input.copy.items)}` });
  }
  if (input.stored !== null) {
    rows.push({
      label: 'Stored pieces',
      value: `${n(input.stored)} of ${n(input.copy.storedItems)}`,
    });
  }
  return rows;
}

/** The row that hands cancellation to the party that actually owns it. */
export const CANCEL_ROW_LABEL = 'Cancel or change billing';
export const CANCEL_ROW_DETAIL = 'Opens the App Store, where the subscription lives';

/**
 * What a cancellation actually costs, stated before anyone taps anything.
 *
 * Every clause traces: paid access runs to `current_period_end`; the free
 * ceilings are `PLANS.free.items` / `storedItems`, which mirror
 * `item_limit_for_plan()` and `item_total_limit_for_plan()`; and "nothing is
 * deleted" is the two triggers not firing on existing rows (see the module
 * docblock). The last sentence is the honest version of the atlas's chooser
 * promise: what a member can actually do about it today is store or delete
 * pieces themselves.
 */
export function cancellationConsequence(currentPeriodEnd: Date | null): string {
  const free = PLANS.free;
  const through = currentPeriodEnd
    ? ` and your paid access lasts through ${membershipDate(currentPeriodEnd)}`
    : '';
  return (
    `If you cancel, nothing is deleted${through}. After that Cinch Free holds ` +
    `${free.items} active pieces and ${free.storedItems} in total, and a closet already over ` +
    `that line stays whole — every piece and every photograph. What stops is adding and ` +
    `restoring, until you have put enough into storage or deleted enough to be back under.`
  );
}

/**
 * MB-08's upgrade row — UNPARKED (D-5, 2026-08-12).
 *
 * It was withheld for a packet because it could only lead to a Superwall
 * placement, and every placement name is a contract with a campaign in the
 * dashboard that an unmatched name resolves silently past. That is no longer
 * true: the founder confirmed the existing Membership v3 document and the four
 * live products, and campaign **101571 "Membership upgrade"** now routes
 * placement `membership_upgrade` to paywall 254200 at 100%.
 *
 * The row still carries NO price and NO term. Its sub-line is the one
 * entitlement fact that makes the move legible — the Pro active ceiling, from
 * `PLANS`, and packing — and the terms are two surfaces on, where a live
 * StoreKit read renders them.
 *
 * It renders only for a member who can actually move up, which is what keeps
 * it out of a Pro member's page.
 */
export const UPGRADE_ROW_LABEL = 'Move to Pro';

export function upgradeRowDetail(): string {
  return `${PLANS.pro.items.toLocaleString('en-US')} active pieces, and packing memos`;
}

/** Plans that have anything to manage. Free never reaches this page. */
export function isManageablePlan(plan: Plan): boolean {
  return plan !== 'free';
}
