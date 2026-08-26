import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/auth/use-session';
import { supabase } from '@/lib/supabase';

import { foldPlan } from './plan-fold';
import { PLANS, type Plan, type PlanCopy } from './plans';
import { useSdkPlan } from './use-sdk-plan';

export interface PlanState {
  /** The plan in force right now, trial folded in. */
  readonly plan: Plan;
  /** What the plan is called and what it includes, for display. */
  readonly copy: PlanCopy;
  /** True while the 14-day trial is running — the user is on `pro` but has not paid. */
  readonly trialing: boolean;
  /** When the trial ends, if one is running. */
  readonly trialEndsAt: Date | null;
  /**
   * When the current billing period renews — MB-06's Renews row.
   *
   * NULL UNTIL THE WEBHOOK FILLS IT (`supabase/functions/superwall-webhook`),
   * which can genuinely lag a purchase by a few seconds. `membership-thanks.tsx`
   * treats null as "not known yet" and drops the row rather than computing or
   * guessing a date — the contract's own words are "the single most important
   * honesty rule on the screen" (§7).
   */
  readonly currentPeriodEnd: Date | null;
  readonly loading: boolean;
  /**
   * The subscription row could not be READ — not "this account is free".
   *
   * `plan` still resolves to `free` when this is true, because least privilege
   * is the right default for anything that decides what to draw. But a surface
   * that has to fail OPEN needs the two cases distinguished, and until this
   * existed the only way to tell them apart was to reach into react-query's
   * cache from outside and match on this hook's own key — a coupling to an
   * implementation detail that could break silently. K-06's third failure
   * ("Membership can't be confirmed") is the caller this exists for: a member
   * whose entitlement cannot be verified is treated as a member, and the
   * server checks independently, so the exposure is bounded.
   */
  readonly unconfirmed: boolean;
  /**
   * Ask again. PR-02's failed read draws a Retry, and a retry that cannot
   * retry is the dead control the refusals forbid — so the caller needs the
   * query's own refetch rather than a page reload standing in for one.
   */
  readonly refetch: () => void;
}

/**
 * The signed-in user's membership.
 *
 * Reads the row directly rather than calling `effective_plan()`: RLS already
 * limits the table to the owner, the row is two columns, and having
 * `trial_ends_at` on the client is what lets the UI say "4 days left" instead
 * of just naming a tier. The trial is then folded in here with the same rule
 * the database uses.
 *
 * A missing row resolves to `free`, matching `effective_plan()`. The row is
 * created by a trigger on signup, so absence means either a brand-new account
 * mid-provisioning or a failure — and in both cases the safe answer is the
 * least privilege, not an error screen.
 *
 * Deliberately NOT the authority on anything. The server re-derives the plan on
 * every AI call from its own read; this hook only decides what to draw.
 */
export function usePlan(): PlanState {
  const session = useSession();
  const userId = session.userId;
  // StoreKit's own answer, via the Superwall SDK — folded in below so a
  // purchase is honoured the moment it exists, and across a relaunch, even
  // while the webhook that writes `subscriptions.plan` is still on its way.
  // It can only ever RAISE the plan (see plan-fold.ts).
  const sdkPlan = useSdkPlan();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['subscription', userId],
    enabled: Boolean(userId),
    // The plan changes on purchase, on trial expiry, and essentially never
    // otherwise. Refetching on focus catches the purchase that happened in the
    // App Store sheet; the stale time keeps it from being chatty.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, trial_ends_at, current_period_end')
        // RLS already scopes this to the owner; the filter makes single-ness
        // not depend on that, so a future policy widening cannot turn
        // maybeSingle into a runtime error.
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;

      // `trialing` is resolved HERE rather than during render.
      //
      // `Date.now()` in a render path is an impure call, which the React
      // Compiler rejects — and it is a real bug, not just a lint: the value
      // would change on any incidental re-render, so a component could flip out
      // of the trial for reasons unrelated to the clock. Reading it once per
      // fetch is stable. The refetch cadence above (5 minutes, plus on focus) is
      // far finer than a 14-day trial needs; the cost is that expiry can lag by
      // up to one stale window, which nobody can perceive.
      //
      // `trial_ends_at` stays an ISO string so the value survives dehydration
      // into SQLite unchanged — a Date would come back as a string anyway.
      const trialEnds = data?.trial_ends_at ?? null;
      return {
        plan: (data?.plan as Plan | undefined) ?? 'free',
        trialEndsAt: trialEnds,
        trialing: trialEnds !== null && new Date(trialEnds).getTime() > Date.now(),
        // Stays an ISO string (or null) for the same dehydration reason
        // `trialEndsAt` does, above.
        currentPeriodEnd: data?.current_period_end ?? null,
      };
    },
  });

  const trialEndsAt = data?.trialEndsAt ? new Date(data.trialEndsAt) : null;
  const currentPeriodEnd = data?.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null;
  const trialing = data?.trialing ?? false;
  const plan: Plan = foldPlan(trialing ? 'pro' : (data?.plan ?? 'free'), sdkPlan);

  return {
    plan,
    copy: PLANS[plan],
    trialing,
    trialEndsAt,
    currentPeriodEnd,
    loading: isPending && Boolean(userId),
    unconfirmed: isError,
    refetch: () => void refetch(),
  };
}
