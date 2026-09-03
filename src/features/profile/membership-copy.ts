import type { Plan, PlanCopy } from '@/features/billing/plans';

/**
 * What the Profile sheet's Membership row can honestly say (contract §4.1 —
 * `docs/design/system-safety-contract.md`).
 *
 * The atlas draws "Cinch Unlimited · Renews 4 September · $8.99 / month".
 * None of that exists: the app sells Standard and Pro, at the prices in
 * `plans.ts`, and free has no membership row at all. The renewal date is
 * printed ONLY once `current_period_end` is known — that column stays null
 * until the billing webhook fills it (`supabase/functions/superwall-webhook`),
 * and `membership-thanks.tsx` treats the same null the same way.
 *
 * Pure and side-effect free so `profile.tsx` (real data from `usePlan()`) and
 * `dev-account.tsx` (fixture data, including both a known and a null
 * `currentPeriodEnd`) compute the identical row from the identical inputs —
 * the one honesty rule that must never drift between the shipping screen and
 * the fixture that is supposed to prove it.
 */
export type MembershipCopyInput = {
  plan: Plan;
  copy: PlanCopy;
  /** `PlanState.paid` — outranks `trialing` (verification, UX-3). */
  paid: boolean;
  trialing: boolean;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

export type MembershipCopy = {
  /** False for a free, non-trialing account — the row does not render at all. */
  visible: boolean;
  /** "Cinch Standard" / "Cinch Pro" / "Pro trial". Empty when `!visible`. */
  title: string;
  /** Price and (if known) renewal date, or the trial's own clock. May be empty. */
  subtitle: string;
  /** Whether "Manage" (the hand-off to the App Store) should render. */
  paidPlan: boolean;
};

function formatDay(date: Date): string {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

export function membershipCopyFor(input: MembershipCopyInput): MembershipCopy {
  // A paid row with a stale trial date is paying: read it as paid, not trialing.
  const trialing = input.trialing && !input.paid;
  const paidPlan = input.paid || (!trialing && input.plan !== 'free');

  if (!trialing && input.plan === 'free') {
    return { visible: false, title: '', subtitle: '', paidPlan: false };
  }

  const title = trialing ? `${input.copy.name} trial` : `Cinch ${input.copy.name}`;
  const renewsOn = input.currentPeriodEnd ? formatDay(input.currentPeriodEnd) : null;
  const subtitle = trialing
    ? input.trialEndsAt
      ? `Trial ends ${formatDay(input.trialEndsAt)}`
      : ''
    : input.copy.monthlyPriceHint
      ? renewsOn
        ? `${input.copy.monthlyPriceHint} / month · Renews ${renewsOn}`
        : `${input.copy.monthlyPriceHint} / month`
      : '';

  return { visible: true, title, subtitle, paidPlan };
}
