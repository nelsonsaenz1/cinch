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
 * MB-08 asks for a "Move to Pro" row into MB-09. It is not drawn, and the
 * reason is a hard one rather than a scheduling one — see the group-6 record.
 *
 * MB-09 is a **selling** surface: three delta rows plus two term rows whose
 * prices and CTA label are live StoreKit reads. This app has no StoreKit
 * module (`profile.tsx` says so where it links out to Apple's own page); every
 * price it has ever shown came from Superwall rendering its own paywall. So an
 * upgrade row could only lead to a Superwall placement, and every placement
 * name in `placements.ts` is a contract with a campaign in the dashboard: an
 * unmatched name resolves silently to nothing at all. Inventing one here would
 * ship a row that looks like a door and is a wall — the exact dead control the
 * refusals forbid — and creating the campaign is production configuration, not
 * an implementation task.
 *
 * So the row waits on D-5. Nothing about MB-08 depends on it: an existing
 * member managing their membership is a complete page without an upsell in it,
 * which is what "a management page, not a sales page" means.
 */
export const UPGRADE_ROW_PARKED = true;

/** Plans that have anything to manage. Free never reaches this page. */
export function isManageablePlan(plan: Plan): boolean {
  return plan !== 'free';
}
