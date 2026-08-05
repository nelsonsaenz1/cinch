/**
 * Per-plan ceilings for paid AI work.
 *
 * Every AI endpoint requires a signed-in user and, until this file existed,
 * nothing else — so one account with a script could loop `tag-item` and spend
 * the whole OpenRouter budget before anybody noticed. Authentication is not a
 * billing control: it says who is spending, not how much.
 *
 * The limits themselves live in `plans.ts`, which is the single place they are
 * written down. This file is only the enforcement: resolve the caller's plan,
 * look up the allowance, and consume one unit atomically.
 *
 * WHY THE PLAN IS READ HERE AND NOT PASSED IN
 * A plan handed up from the client is a plan the client can choose. The lookup
 * runs under the service role against `effective_plan()`, which also folds in
 * the trial, so a caller cannot upgrade itself by lying and cannot lose its
 * trial by forgetting to mention it.
 *
 * Consumption is not refunded when the provider call then fails: a failed call
 * still costs latency and sometimes tokens, and a refund path would hand an
 * attacker a free retry loop by deliberately provoking failures. The ceilings
 * in `plans.ts` are set above the advertised allowance precisely to absorb that.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from './database.types.ts';
import { allowanceFor, type AiQuotaKind, type Plan, type QuotaPeriod } from './plans.ts';

export type { AiQuotaKind };

/**
 * Seconds until the current period rolls over.
 *
 * Must agree with `claim_ai_quota`, which truncates `now() at time zone 'utc'`
 * to the period. A Retry-After computed against a different boundary is worse
 * than none: the client waits, retries, and gets the same 429.
 *
 * Weeks are ISO weeks — Postgres `date_trunc('week', …)` starts on Monday.
 */
function secondsUntilReset(period: QuotaPeriod): number {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  let next: number;
  if (period === 'day') {
    next = Date.UTC(y, m, d + 1);
  } else if (period === 'month') {
    next = Date.UTC(y, m + 1, 1);
  } else {
    // Days until next Monday. getUTCDay(): 0 = Sunday.
    const dow = now.getUTCDay();
    next = Date.UTC(y, m, d + ((8 - (dow === 0 ? 7 : dow)) % 7 || 7));
  }
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/**
 * The plan this user is entitled to right now, trial included.
 *
 * Falls back to 'free' when the lookup fails. That is the least-privilege
 * answer, and the alternative — failing the request outright — would take
 * tagging down for everyone whenever the subscriptions table hiccuped. A paid
 * user briefly treated as free is a support ticket; a broken import is a
 * refund.
 */
async function resolvePlan(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<Plan> {
  const { data, error } = await admin.rpc('effective_plan', { p_user_id: userId });
  if (error || !data) return 'free';
  return data as Plan;
}

/**
 * Consume one unit of `kind` for `userId`, against their plan's allowance.
 *
 * Returns a ready `Response` when the caller must stop, and `null` when the
 * provider call may proceed.
 *
 *   402  the plan does not include this at all (free tier, stylist). The client
 *        shows an upgrade, not a clock — "try again tomorrow" would never come
 *        true, and telling someone to wait for something that will not arrive
 *        is the kind of small lie that costs a subscription.
 *   429  the plan includes it and this period's allowance is spent.
 *   503  the counter itself is unreachable.
 *
 * Failing closed on an unreachable counter is deliberate: the alternative fails
 * open, which removes the one dependency whose job is to bound spending exactly
 * when the database is unhealthy.
 */
export async function enforceAiQuota(
  admin: SupabaseClient<Database>,
  userId: string,
  kind: AiQuotaKind,
): Promise<Response | null> {
  const plan = await resolvePlan(admin, userId);
  const { limit, period } = allowanceFor(plan, kind);

  const { data, error } = await admin.rpc('claim_ai_quota', {
    p_user_id: userId,
    p_kind: kind,
    p_limit: limit,
    p_period: period,
  });

  if (error) {
    return Response.json(
      {
        error: 'quota_unavailable',
        message: 'We could not check your allowance. Please try again shortly.',
      },
      { status: 503, headers: { 'Retry-After': '30' } },
    );
  }

  const decision = (data ?? {}) as {
    allowed?: boolean;
    used?: number;
    limit?: number;
    reason?: string;
  };

  if (decision.allowed === true) return null;

  if (decision.reason === 'plan_excluded') {
    return Response.json(
      {
        error: 'plan_upgrade_required',
        kind,
        plan,
        message: 'The stylist is part of Standard and Pro.',
      },
      { status: 402 },
    );
  }

  const retryAfter = secondsUntilReset(period);
  return Response.json(
    {
      error: 'ai_quota_exceeded',
      kind,
      plan,
      period,
      used: decision.used ?? limit,
      limit: decision.limit ?? limit,
      retryAfterSeconds: retryAfter,
      message:
        period === 'day'
          ? "You have used today's styling allowance."
          : period === 'week'
            ? "You have used this week's styling allowance."
            : "You have used this month's styling allowance.",
    },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}
