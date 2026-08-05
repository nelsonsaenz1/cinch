import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/auth/use-session';
import { supabase } from '@/lib/supabase';

import { PLANS, type Plan, type PlanCopy } from './plans';

export interface PlanState {
  /** The plan in force right now, trial folded in. */
  readonly plan: Plan;
  /** What the plan is called and what it includes, for display. */
  readonly copy: PlanCopy;
  /** True while the 14-day trial is running — the user is on `pro` but has not paid. */
  readonly trialing: boolean;
  /** When the trial ends, if one is running. */
  readonly trialEndsAt: Date | null;
  readonly loading: boolean;
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

  const { data, isPending } = useQuery({
    queryKey: ['subscription', userId],
    enabled: Boolean(userId),
    // The plan changes on purchase, on trial expiry, and essentially never
    // otherwise. Refetching on focus catches the purchase that happened in the
    // App Store sheet; the stale time keeps it from being chatty.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, trial_ends_at')
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
      };
    },
  });

  const trialEndsAt = data?.trialEndsAt ? new Date(data.trialEndsAt) : null;
  const trialing = data?.trialing ?? false;
  const plan: Plan = trialing ? 'pro' : (data?.plan ?? 'free');

  return {
    plan,
    copy: PLANS[plan],
    trialing,
    trialEndsAt,
    loading: isPending && Boolean(userId),
  };
}
