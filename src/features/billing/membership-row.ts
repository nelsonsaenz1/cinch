/**
 * PR-02 — one row shape, four reads.
 *
 * Correction 31: the Membership row on Profile is a **Supabase subscription
 * read**, not a store call. `usePlan()` selects `plan, trial_ends_at,
 * current_period_end` from `subscriptions`; that is the whole source, and this
 * module turns its four possible outcomes into the four states the atlas draws:
 *
 *   reading    the query is in flight → "Checking…", no chevron, no claim
 *   confirmed  a paid plan → tier, term and the plan's active ceiling
 *   trialing   `trial_ends_at` in the future → "Trial through <date>"
 *   failed     the read errored → "Membership can't be confirmed" + Retry
 *
 * ── WHY THERE IS NO FREE ROW (correction 30) ──────────────────────────────
 *
 * The frozen contract describes no Free membership object, so there is nothing
 * for the row to be about. `usePlan()` resolves a missing subscription row to
 * `free` deliberately — least privilege for anything deciding what to draw —
 * and a row that printed "Free" would be presenting that safety default as a
 * confirmed fact about the account. `visible: false` is the whole answer.
 *
 * ── WHY READING IS ITS OWN STATE ──────────────────────────────────────────
 *
 * Because the silent fallback is indistinguishable from a real answer. Before
 * this, a member on a slow network saw no membership row at all, which reads
 * as "you are not a member" — the app asserting something about somebody's
 * money that it had not yet read.
 *
 * ── NO PRICE, EVER, ON THIS ROW ───────────────────────────────────────────
 *
 * `PLANS.*.monthlyPriceHint` exists for the paywall's own convenience and is a
 * HINT by its own docblock: the real figure is a localized StoreKit read. A
 * settings row is a layout, and a price typed into a layout is wrong in every
 * country but one. The row names the tier and the term and stops.
 *
 * Pure and React-free so the shipping screen and `dev-w3-g6-pr-02.tsx` compute
 * identical rows from identical inputs, and `tests/membership-row.test.ts` can
 * pin all four without a renderer.
 */

import { PLANS, type Plan, type PlanCopy } from './plans';

export type MembershipReadState = 'reading' | 'confirmed' | 'trialing' | 'failed';

export type MembershipRowInput = {
  readonly plan: Plan;
  readonly trialing: boolean;
  readonly trialEndsAt: Date | null;
  /**
   * `subscriptions.current_period_end`. NULL until the billing webhook fills
   * it, which genuinely lags a purchase — so null means "not known yet" and
   * the term is dropped rather than computed. Never guessed.
   */
  readonly currentPeriodEnd: Date | null;
  readonly loading: boolean;
  /** The row could not be READ. Not "this account is free". */
  readonly unconfirmed: boolean;
};

export type MembershipRow = {
  readonly state: MembershipReadState;
  /** False only for a settled, confirmed free account. */
  readonly visible: boolean;
  /** "Membership" while reading or failed; "Cinch Standard" once known. */
  readonly label: string;
  /** The second line. Empty when there is nothing true to put there. */
  readonly value: string;
  /** A confirmed member gets a chevron into MB-08. Nothing else does. */
  readonly chevron: boolean;
  /** Only the failed read offers one, and it offers nothing else. */
  readonly retry: boolean;
};

/** "3 March" — day and month, in the reader's own locale ordering. */
export function membershipDate(date: Date): string {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

/** "150 active pieces" — the ceiling of the plan the READ named, never a tier we assumed. */
export function activeCeilingPhrase(copy: PlanCopy): string {
  return `${copy.items.toLocaleString('en-US')} active pieces`;
}

export function membershipRowFor(input: MembershipRowInput): MembershipRow {
  const blank = { chevron: false, retry: false } as const;

  if (input.loading) {
    return { state: 'reading', visible: true, label: 'Membership', value: 'Checking…', ...blank };
  }

  if (input.unconfirmed) {
    return {
      state: 'failed',
      visible: true,
      label: 'Membership can’t be confirmed',
      // No renewal date on a failed read — a guessed date is worse than none —
      // and no alarm either: the server checks entitlements independently, so
      // nothing has actually been taken away while this row cannot read.
      value: 'Nothing has changed and nothing is locked',
      chevron: false,
      retry: true,
    };
  }

  if (input.trialing) {
    const copy = PLANS[input.plan];
    const through = input.trialEndsAt ? `Trial through ${membershipDate(input.trialEndsAt)}` : null;
    return {
      state: 'trialing',
      visible: true,
      label: `Cinch ${copy.name}`,
      // Both facts when the date is known, the ceiling alone when it is not.
      // Never a bare "Trial" with no end — a trial with no stated end is the
      // one shape correction 06 forbids.
      value: [through, activeCeilingPhrase(copy)].filter(Boolean).join(' · '),
      chevron: true,
      retry: false,
    };
  }

  if (input.plan === 'free') {
    return { state: 'confirmed', visible: false, label: '', value: '', ...blank };
  }

  const copy = PLANS[input.plan];
  const through = input.currentPeriodEnd
    ? `Through ${membershipDate(input.currentPeriodEnd)}`
    : null;

  return {
    state: 'confirmed',
    visible: true,
    label: `Cinch ${copy.name}`,
    // "Through", not "Renews on": renewal is the store's to decide, and this
    // app has never read a renewal intent. What it knows is how long the paid
    // access it can see lasts.
    value: [through, activeCeilingPhrase(copy)].filter(Boolean).join(' · '),
    chevron: true,
    retry: false,
  };
}
