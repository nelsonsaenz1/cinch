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
 * ── THE FREE ROW, AND WHY IT CAME BACK (2026-09-02) ───────────────────────
 *
 * Correction 30 hid it, and the reasoning was sound for the page that existed
 * then: there was no Free membership object for a row to be about, and
 * `/membership` met a free account with "There is no membership on this
 * account to manage" and a way back. A row leading to that was a row leading
 * nowhere.
 *
 * `/membership` is no longer that page. A free account now sees what it holds,
 * what each paid tier adds, and one door through the gate — so Settings hiding
 * the only entrance to it left the page reachable from `/friends` and a deep
 * link and from nowhere a person would look.
 *
 * The original objection does not survive the move either. It was that
 * printing "Free" presents `usePlan()`'s least-privilege default as a
 * confirmed fact — but this branch is reached only AFTER `loading` and
 * `unconfirmed` have been ruled out, which is exactly what makes it confirmed.
 * The two states that genuinely have not read anything still name no tier.
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
  /** `PlanState.paid` — a paid row is paid whatever its trial date says. */
  readonly paid: boolean;
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
  /**
   * Kept, and now always true for a signed-in account.
   *
   * It was the free account's absence, and that absence is the defect — see
   * the note at the top of this file. The field stays because the row it
   * governs is drawn by a component that has to be able to draw nothing, and
   * because removing a prop from a settled plate is a wider change than this
   * one is: a future state with genuinely nothing to say still has a way to
   * say so.
   */
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

  if (input.trialing && !input.paid) {
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
    // A CONFIRMED free account. The tier and its active ceiling, both read
    // rather than assumed, and a chevron into the page that says what a
    // membership would add. No price, no offer and no badge on the row — the
    // selling is the paywall's job, two surfaces on.
    const copy = PLANS.free;
    return {
      state: 'confirmed',
      visible: true,
      label: `Cinch ${copy.name}`,
      value: activeCeilingPhrase(copy),
      chevron: true,
      retry: false,
    };
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
