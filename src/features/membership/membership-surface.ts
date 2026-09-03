/**
 * ONE membership state, resolved once, for every surface that draws one.
 *
 * ── THE DEFECT THIS FILE EXISTS TO CLOSE ──────────────────────────────────
 *
 * Two pages read the same hook and disagreed about the same account. MB-08
 * branched on `plan !== 'free'` and MB-09 branched on `canUpgrade(plan)`, and
 * a legacy-trial account — a `free` row with `trial_ends_at` in the future,
 * which `usePlan()` folds up to `pro` — fell through them in opposite
 * directions: "There is no membership on this account to manage" on one page,
 * "This account is already on Pro" on the next. Both sentences were computed
 * correctly. Neither was true. A free account got the second one too, which is
 * a plain lie told to the exact person the app is asking for money.
 *
 * The fix is not a better branch on either page. It is that "what kind of
 * membership is this" stops being a boolean either page is allowed to invent.
 * `membershipSurface()` is the only thing that decides, both pages render what
 * it returns, and `tests/membership-surface.test.ts` pins every input.
 *
 * ── WHY `paid` AND NOT `plan !== 'free'` ──────────────────────────────────
 *
 * Because the fold is deliberately lossy in the direction that matters here.
 * `plan` answers "what may this account DO", which is the question every
 * ceiling, gate and allowance asks, and a trial answers it identically to a
 * purchase. These pages ask a different question — "what does this account
 * OWN" — and only `PlanState.paid` answers it. Nothing below re-derives it.
 *
 * ── ORDER OF THE ANSWERS, AND WHY IT IS THAT ORDER ────────────────────────
 *
 *   reading      the read is in flight. Names no tier, claims nothing.
 *   unconfirmed  the read FAILED. Never collapsed into "free" — telling a
 *                paying member they have no membership is the worst available
 *                lie on a billing page, and `usePlan()` keeps the two cases
 *                apart precisely so this one can be drawn as itself.
 *   paid         a live subscription row, or StoreKit's own entitlement.
 *                Manage, cancel and restore belong to this state alone.
 *   trialing     access the SERVER granted, with a date on it. Not a purchase;
 *                there is nothing to cancel and nothing to manage, so the page
 *                says when it ends and what happens after.
 *   free         a CONFIRMED free account. It sees what it has, what a
 *                membership adds, and one door — never a dead end.
 *
 * `paid` outranks `trialing` because a paying member with a stale
 * `trial_ends_at` still on the row is a paying member; `usePlan()`'s own fold
 * settled that in the same direction (a paid row wins, the trial lifts only a
 * free one) and this file must not disagree with it.
 *
 * Pure and React-free, for the reason `manage-membership-spec.ts` gives: the
 * shipping routes and the `dev-mm-*` fixtures have to compute identical states
 * from identical inputs, and on a surface about somebody's money "looks
 * correct" and "is correct" are different claims.
 */

import { PLANS, type Plan, type PlanCopy } from '@/features/billing/plans';
import { canUpgrade } from '@/features/billing/upgrade-delta';

import { freeLinePhrase, membershipDateLong } from './manage-membership-spec';

export type MembershipSurfaceKind = 'reading' | 'unconfirmed' | 'paid' | 'trialing' | 'free';

/**
 * `PlanState`, narrowed to the fields a membership page may look at.
 *
 * A structural type rather than `Pick<PlanState, …>` so the resolver can be
 * tested and posed without React, and so a fixture cannot accidentally satisfy
 * it by passing a whole live hook result.
 */
export type MembershipSurfaceInput = {
  readonly plan: Plan;
  readonly paid: boolean;
  readonly trialing: boolean;
  readonly trialEndsAt: Date | null;
  readonly currentPeriodEnd: Date | null;
  readonly loading: boolean;
  readonly unconfirmed: boolean;
};

export type MembershipSurface = {
  readonly kind: MembershipSurfaceKind;
  /** The folded plan. NEVER drawn while `reading` or `unconfirmed`. */
  readonly plan: Plan;
  /**
   * The tier the account OWNS — the "from" of any comparison. `plan` answers
   * what the account may do today (a trial answers that as Pro); `owned`
   * answers what it holds, which for a trial is nothing. A comparison drawn
   * from `plan` showed a trialing account a table of losses under a kicker
   * promising additions (verification, UX-1).
   */
  readonly owned: Plan;
  /** `PLANS[plan]`, for the one place a tier is named. Same rule as above. */
  readonly copy: PlanCopy;
  /** Cancel and the term colophon — a subscription, and only a subscription. */
  readonly manageable: boolean;
  /** The plan comparison and the door through the gate. */
  readonly comparison: boolean;
  /** Standard → Pro, MB-09's own row. False for everything else. */
  readonly upgradable: boolean;
  /**
   * A restore row is honest in every SETTLED state: a membership bought on
   * another device is exactly the thing a free-looking account might be
   * missing, and refusing to offer the check is its own dead end.
   */
  readonly restorable: boolean;
  /** Only ever set while `trialing`. */
  readonly trialEndsAt: Date | null;
  /** Only ever set while `paid` — a trial's clock is not a billing period. */
  readonly currentPeriodEnd: Date | null;
};

export function membershipSurface(input: MembershipSurfaceInput): MembershipSurface {
  const base = {
    plan: input.plan,
    owned: input.paid ? input.plan : 'free',
    copy: PLANS[input.plan],
    manageable: false,
    comparison: false,
    upgradable: false,
    restorable: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
  } as const;

  if (input.loading) return { ...base, kind: 'reading' };
  if (input.unconfirmed) return { ...base, kind: 'unconfirmed' };

  if (input.paid) {
    return {
      ...base,
      kind: 'paid',
      manageable: true,
      upgradable: canUpgrade(input.plan),
      restorable: true,
      currentPeriodEnd: input.currentPeriodEnd,
    };
  }

  if (input.trialing) {
    return {
      ...base,
      kind: 'trialing',
      comparison: true,
      restorable: true,
      trialEndsAt: input.trialEndsAt,
    };
  }

  return { ...base, kind: 'free', comparison: true, restorable: true };
}

// ---------------------------------------------------------------------------
// What each state is allowed to say
// ---------------------------------------------------------------------------

/**
 * The comparison plate's head, in the same oxblood kicker `WHAT YOU HAVE` and
 * `CHANGE` take. "Adds" rather than "costs": every row under it is an
 * entitlement out of `PLANS`, and not one of them is a price.
 *
 * The masthead over it names the tier the read returned — including Free,
 * which at this point is a CONFIRMED answer rather than `usePlan()`'s
 * least-privilege default. That distinction is the whole reason
 * `MASTHEAD_UNREAD` still stands over the other two states.
 */
export const COMPARISON_KICKER = 'WHAT A MEMBERSHIP ADDS';

/**
 * The door, on every surface that offers a first purchase.
 *
 * It names the ACT, exactly as `UPGRADE_CTA` does and for the same reason: the
 * prices are a live StoreKit read inside paywall 254200, and a label carrying
 * a figure would be the literal D-5 forbids. "See plans" rather than "See both
 * terms" because a free account is choosing between two tiers, not reading the
 * terms of one.
 */
export const PLANS_CTA = 'See plans';

/** The free page's one-line consequence, under the tier plate. */
export function freeLead(): string {
  return `This account is on Cinch ${PLANS.free.name}, which holds ${freeLinePhrase()}.`;
}

/**
 * A paywall the reader closed, on a surface where "Still on Standard" would
 * name the wrong tier. No second ask follows it anywhere.
 */
export const NOTHING_STARTED = {
  title: 'Nothing was started',
  body: 'Nothing has changed on this account and nothing was charged.',
} as const;

/**
 * The trial, said as a date and a consequence.
 *
 * REPORTS `subscriptions.trial_ends_at` and offers nothing — the same rule
 * `TRIAL_MARK_PREFIX` is held to. The server wrote this date; naming it is
 * reading a row out loud, which is the opposite of promising a trial.
 *
 * The null branch cannot be reached from `usePlan()` (`trialing` is derived
 * from the date's existence) and is written anyway, because a headline that
 * interpolated "undefined" onto a billing page is not a state worth leaving to
 * an invariant two modules away.
 */
export function trialEndsTitle(endsAt: Date | null): string {
  return endsAt ? `Your trial ends on ${membershipDateLong(endsAt)}` : 'Your trial is running';
}

/**
 * What happens after, in the same two clauses `endingNote()` uses — because it
 * is the same event. Nothing is deleted; adding and restoring pause until the
 * closet is back under the free line.
 */
export function trialEndsBody(): string {
  return (
    `After that this account moves to Cinch ${PLANS.free.name}. Nothing is deleted — adding ` +
    `and restoring pause until the closet is back under ${freeLinePhrase()}.`
  );
}

// ---------------------------------------------------------------------------
// MB-09, resolved from the same state
// ---------------------------------------------------------------------------

/**
 * The upgrade route's four answers.
 *
 *   reading  the read is in flight.
 *   delta    a paying member below Pro — the shipped MB-09, unchanged.
 *   plans    free, or on a trial. There is no "upgrade" here; there is a first
 *            purchase, and it gets the comparison and the same gate. This is
 *            the branch that used to tell a free account it was "already on
 *            Pro" — the folded plan said `pro` for a trial and `canUpgrade`
 *            said false for free, and one refusal string served both.
 *   at-top   a paying Pro member. The refusal is now only ever shown to the
 *            one account it is true of.
 */
export type UpgradeSurfaceKind = 'reading' | 'delta' | 'plans' | 'at-top';

export function upgradeSurface(input: MembershipSurfaceInput): {
  readonly kind: UpgradeSurfaceKind;
  readonly plan: Plan;
  readonly owned: Plan;
  readonly copy: PlanCopy;
  readonly trialEndsAt: Date | null;
} {
  const surface = membershipSurface(input);
  const kind: UpgradeSurfaceKind =
    surface.kind === 'reading' || surface.kind === 'unconfirmed'
      ? // An unread subscription is not an upgrade decision. The upgrade page
        // has no retry of its own and no state worth drawing on a failed read,
        // so it waits rather than guessing which of the three it is looking at.
        'reading'
      : surface.kind === 'paid'
        ? surface.upgradable
          ? 'delta'
          : 'at-top'
        : 'plans';

  return {
    kind,
    plan: surface.plan,
    owned: surface.owned,
    copy: surface.copy,
    trialEndsAt: surface.trialEndsAt,
  };
}

// ---------------------------------------------------------------------------
// MB-06 — the thanks screen's own gate
// ---------------------------------------------------------------------------

/**
 * Whether MB-06 may say a purchase happened.
 *
 * A route is not evidence. `/membership-thanks` is a real path in the route
 * tree, reachable by a typed deep link, a restored navigation state or a
 * `router.push` somebody adds later — and it opened confidently saying "Your
 * purchase went through" on any of them.
 *
 * The ONLY evidence is `paywall-origin.ts`'s record, which `use-gate.ts`
 * writes in `settle()` and writes nowhere else: it is set from `onDismiss`
 * when Superwall reports a real `purchased` or `restored` result, and
 * deliberately NOT set for a silent skip (an already-entitled user the
 * campaign let through, who bought nothing). So the record's presence is
 * exactly the claim the screen wants to make, and its absence is exactly the
 * case that must not be dressed as a receipt.
 *
 * `plan` is not evidence either, and cannot be made into it: a member who
 * subscribed last month reads `pro` on every launch.
 */
export function thanksVerified(record: { result: 'purchased' | 'restored' } | null): boolean {
  return record !== null;
}

/** MB-06 with no purchase behind it. A reconciliation, not a receipt. */
export const THANKS_UNVERIFIED_TITLE = 'Checking your membership';
export const THANKS_UNVERIFIED_BODY =
  'There is no purchase to confirm on this device. If you have just bought a membership, it lands here as soon as the App Store reports it.';
