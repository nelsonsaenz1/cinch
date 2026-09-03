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
   * Where a running trial CAME FROM — 'legacy_promotional' whenever `trialing`
   * is true, null otherwise.
   *
   * Every server trial is legacy by definition now: the 14-day grant that
   * `handle_new_subscription()` wrote for new accounts is being discontinued,
   * and the rows still carrying a live `trial_ends_at` are existing accounts
   * riding it out as promotional access. Surfaces that talk about ACQUISITION
   * (present-promo.ts's qualification, any "start your trial" copy) need to
   * know the trial they see is a grant, not a StoreKit intro offer — someone
   * inside a grant is not a person to pitch a trial to.
   *
   * `trialing` itself is untouched and keeps its exact semantics —
   * context-lines.ts branches on it for the Reveal's one line, and that copy
   * is correct for a promotional grant too (the access is real, whatever it
   * is called). This field is the annotation, not a replacement.
   */
  readonly trialSource: 'legacy_promotional' | null;
  /**
   * The account is PAYING — a live subscription row, or StoreKit's own answer.
   *
   * `plan` alone cannot say this, and that is the whole reason this field
   * exists. A legacy trial folds a `free` row up to `pro` (see `trialSource`),
   * so `plan === 'pro'` is true both for someone who bought Pro and for
   * someone riding out a grant that expires on a known date. The two owe the
   * reader completely different sentences — one has a subscription to manage
   * and cancel, the other has a trial ending and a decision to make — and
   * every surface that got this wrong drew one of them the other's page.
   *
   * A lapsed paid row is NOT paid (same slack as `effective_plan`), and the
   * SDK's `ACTIVE` entitlement is, even while the webhook that writes the row
   * is still in flight — the same "never down, only up" rule `foldPlan` uses.
   *
   * `membership-surface.ts` is the one consumer that turns this into a state;
   * nothing should re-derive it from `plan` and `trialing` at a call site.
   */
  readonly paid: boolean;
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
/**
 * How long past `current_period_end` a paid row is still honoured.
 *
 * Renewal notifications trail the moment of renewal, and Apple's billing
 * retry keeps entitlement alive while a card is retried. Three days is
 * generous for both and short enough that a missed expiration cannot become
 * a free year. Mirrors the server's `effective_plan`.
 */
const PAID_LAPSE_SLACK_MS = 3 * 24 * 60 * 60 * 1000;

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
    // App Store sheet and the trial that ended while the app was in the
    // background; the stale time keeps it from being chatty. This is a
    // per-query opt-in — the client default is off, and query-client.ts
    // wires `focusManager` to AppState so it actually fires.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
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
      const periodEnd = data?.current_period_end ?? null;
      const now = Date.now();
      const rowPlan = (data?.plan as Plan | undefined) ?? 'free';
      // A paid row whose period has ended is not a paid row. The webhooks
      // normally write the downgrade, but a missed revocation must not read
      // as a subscription forever — `effective_plan` applies the same slack
      // server-side (migration 20260903000000), so the two agree.
      const paidLapsed =
        rowPlan !== 'free' &&
        periodEnd !== null &&
        new Date(periodEnd).getTime() + PAID_LAPSE_SLACK_MS < now;
      return {
        // The ROW's plan, unfolded; `paidLapsed` rides beside it so the fold
        // below can mirror `effective_plan` exactly (a lapsed paid row is
        // free, and the trial lifts only a row that IS free — never a lapsed
        // paid one; migration 20260903000300).
        plan: rowPlan,
        paidLapsed,
        trialEndsAt: trialEnds,
        trialing: trialEnds !== null && new Date(trialEnds).getTime() > now,
        // Stays an ISO string (or null) for the same dehydration reason
        // `trialEndsAt` does, above.
        currentPeriodEnd: periodEnd,
      };
    },
  });

  const trialEndsAt = data?.trialEndsAt ? new Date(data.trialEndsAt) : null;
  const currentPeriodEnd = data?.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null;
  const trialing = data?.trialing ?? false;
  // A PAID ROW WINS; the trial lifts only a free one. The server's
  // `effective_plan` has said so since 2026-09-01 (migration 20260901000000),
  // and until this line agreed a legacy-trial account that bought Standard
  // drew Pro ceilings the trigger would then refuse.
  const rowPlan: Plan = data?.plan ?? 'free';
  const paidLapsed = data?.paidLapsed ?? false;
  const serverPlan: Plan =
    rowPlan !== 'free' ? (paidLapsed ? 'free' : rowPlan) : trialing ? 'pro' : 'free';
  const plan: Plan = foldPlan(serverPlan, sdkPlan);
  // MONEY, not access. The row has to be a live paid row (not a lapsed one),
  // or StoreKit has to hold an active entitlement on this device. A trial
  // lifting a free row to `pro` contributes nothing here, which is the
  // distinction the whole field exists for.
  const paid = (rowPlan !== 'free' && !paidLapsed) || sdkPlan !== null;

  return {
    plan,
    copy: PLANS[plan],
    trialing,
    trialEndsAt,
    paid,
    // Unconditional on `trialing` because there is only one kind of server
    // trial left — see the field's own note. When (if) StoreKit intro offers
    // ever write trials of their own, this is the line that learns to tell
    // them apart.
    trialSource: trialing ? 'legacy_promotional' : null,
    currentPeriodEnd,
    loading: isPending && Boolean(userId),
    unconfirmed: isError,
    refetch: () => void refetch(),
  };
}
