/**
 * MB-09 — Standard → Pro, stated as the difference and nothing else.
 *
 * "An upgrade for someone who already pays states only the delta: three rows,
 * each with the current figure and the new one, so nothing has to be
 * remembered from another screen."
 *
 * ── WHAT IS HERE, AND WHAT IS DELIBERATELY NOT ────────────────────────────
 *
 * Here: the three entitlements that differ between the two tiers and can be
 * sourced. Active pieces and stored pieces come straight off `PLANS`, which
 * mirrors `item_limit_for_plan()` and `item_total_limit_for_plan()`. Packing
 * is a delta because correction 18 resolved it as Pro-only, and
 * `use-packing-access.ts` is the gate that makes that true.
 *
 * NOT here: any price, any period, any per-month arithmetic, any renewal date,
 * any proration figure, and any trial. The atlas draws two term rows with
 * "App Store price" in them and calls those positions live StoreKit reads —
 * and this app has no StoreKit module, so it cannot make one. Every price
 * Cinch has ever shown came from Superwall rendering its own document. The
 * terms therefore live on paywall 254200, which carries all four products, and
 * the CTA here opens it. That is the atlas's actual requirement (a live read,
 * never a literal) rather than its sketch of where the read is rendered.
 *
 * `tests/upgrade-delta.test.ts` fails if a currency symbol, a period or a
 * trial phrase ever reaches one of these strings.
 *
 * Pure and React-free, like its two neighbours, so the shipping route and
 * `dev-w3-g6-mb-09.tsx` compute the identical table.
 */

import { PLANS, type Plan } from './plans';

export type DeltaRow = {
  readonly label: string;
  /** What the member has now. */
  readonly from: string;
  /** What they would have. */
  readonly to: string;
};

const n = (v: number) => v.toLocaleString('en-US');

/**
 * The three rows, from the tier the subscription read named.
 *
 * Takes the current plan rather than assuming Standard: `usePlan()` is the
 * only thing that knows which tier this member is on, and a table that
 * hard-coded 150 → 1,000 would be wrong the moment it was reached from
 * anywhere else.
 */
export function upgradeDelta(from: Plan): readonly DeltaRow[] {
  const current = PLANS[from];
  const pro = PLANS.pro;

  return [
    { label: 'Active pieces', from: n(current.items), to: n(pro.items) },
    { label: 'Stored pieces', from: n(current.storedItems), to: n(pro.storedItems) },
    // The one non-numeric row. Correction 18: packing is Pro-only, gated in
    // the app by `use-packing-access.ts` and backed server-side by the
    // stylist allowance free and Standard cannot claim.
    { label: 'Packing memos', from: 'Not included', to: 'Included' },
  ];
}

/** The reassurance under the table. Nothing is lost by moving up. */
export const UPGRADE_KEEPS_LINE = 'Everything you already have stays exactly as it is.';

/**
 * The CTA.
 *
 * It names the ACT and not the terms, because the terms are on the next
 * surface and this one has not read them. "See both terms" is what the button
 * honestly does: it opens the paywall where the monthly and annual prices are
 * rendered from the store in the reader's own currency. A label like "Move to
 * Pro — $119/yr" would be the literal the whole page exists to avoid.
 */
export const UPGRADE_CTA = 'See both terms';
/** The real exit, with no second attempt after it. */
export const UPGRADE_DECLINE = 'Stay on Standard';

/**
 * What the App Store handles, said plainly rather than computed.
 *
 * Proration is Apple's: an upgrade mid-term is credited by the store against
 * the remaining balance, and nothing in this app models that. Naming a figure
 * would be inventing one.
 */
export const UPGRADE_PRORATION_LINE =
  'The App Store handles the balance of your current term, and shows you what it comes to before anything is charged.';

/**
 * MB-09's own failure, and the reason this page is not a dead control.
 *
 * `gate.present()` resolves `unavailable` when no usable offer reached the
 * user — the document failed to load, timed out, rendered broken, or (today's
 * case) has never been published. The fail-safe in `use-gate.ts` tears the
 * sheet down, and without this line the member would be left looking at a
 * button that appears to do nothing.
 *
 * It does not apologise for a price it cannot show, because it does not know
 * one. It says the terms could not be reached and names the place they can
 * always be reached from.
 */
export const UPGRADE_UNAVAILABLE_LINE =
  'The terms could not be loaded just now, so nothing was started. Nothing has changed on your membership — try again in a moment.';

/** Only a member below Pro has an upgrade to be offered. */
export function canUpgrade(plan: Plan): boolean {
  return plan === 'standard';
}
