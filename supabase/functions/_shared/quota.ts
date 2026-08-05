/**
 * Per-account daily ceilings for paid AI work.
 *
 * Every AI endpoint requires a signed-in user and, until this file existed,
 * nothing else — so one account with a script could loop `tag-item` and spend
 * the whole OpenRouter budget before anybody noticed. Authentication is not a
 * billing control: it says who is spending, not how much.
 *
 * The limits live here rather than in each function so that "what does one
 * account cost us per day, worst case" is a single readable number rather than
 * something you reconstruct from three files.
 *
 * The counter itself is `claim_ai_quota` in migration 20260804200000, which
 * increments and decides in one statement so two concurrent calls cannot both
 * see the last unit. It runs under the service role only — the function takes a
 * user id as an argument, so a client able to call it could spend someone
 * else's allowance.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from './database.types.ts';

/**
 * Numbers chosen from what the feature actually does in a day, not from a
 * budget target — a limit nobody legitimately reaches is the only kind that
 * costs nothing and still caps abuse.
 *
 *   tagging (vision, one call per photograph)
 *     Bulk import is the real workload: a person photographs their wardrobe
 *     once, in one sitting. A large tracked closet is a few hundred garments,
 *     so 400 covers a complete import plus re-tags in the same day. This is
 *     deliberately far above the other two: it is per-photo, and hitting it
 *     during onboarding would look like the app is broken.
 *
 *   outfit_generation (re-rank of an on-device shortlist)
 *     The home screen re-ranks when the shortlist, note or weather changes,
 *     and the client caches for 15 minutes with retry disabled. Even a user
 *     opening the app hourly and fiddling with the note lands well under 80.
 *
 *   stylist_chat (one call per message sent)
 *     A styling conversation is a handful of turns. 60 messages in one day is
 *     already an unusual amount of typing, and this workload carries the
 *     largest prompt (digest + shortlist + history) of the three.
 *
 * Consumption is not refunded when the provider call then fails: a failed call
 * still costs us latency and sometimes tokens, and a refund path would hand an
 * attacker a free retry loop by deliberately provoking failures.
 */
export const AI_DAILY_LIMITS = {
  tagging: 400,
  outfit_generation: 80,
  stylist_chat: 60,
} as const;

export type AiQuotaKind = keyof typeof AI_DAILY_LIMITS;

/** Seconds until the counter's day rolls over. */
function secondsUntilReset(): number {
  // `claim_ai_quota` keys on `current_date`, which is the database's date, and
  // Supabase databases run in UTC. Computing the same boundary here keeps
  // Retry-After honest rather than a made-up round number.
  const now = new Date();
  const midnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((midnightUtc - now.getTime()) / 1000));
}

/**
 * Consume one unit of `kind` for `userId`.
 *
 * Returns a ready `Response` when the caller must stop — 429 over the limit,
 * 503 when the quota table itself cannot be reached — and `null` when the
 * provider call may proceed.
 *
 * Failing closed on an unreachable counter is deliberate. The alternative
 * fails open, which means the one dependency whose job is to bound spending
 * disappears exactly when the database is unhealthy.
 */
export async function enforceAiQuota(
  admin: SupabaseClient<Database>,
  userId: string,
  kind: AiQuotaKind,
): Promise<Response | null> {
  const limit = AI_DAILY_LIMITS[kind];

  const { data, error } = await admin.rpc('claim_ai_quota', {
    p_user_id: userId,
    p_kind: kind,
    p_daily_limit: limit,
  });

  if (error) {
    return Response.json(
      {
        error: 'quota_unavailable',
        message: 'We could not check your daily allowance. Please try again shortly.',
      },
      { status: 503, headers: { 'Retry-After': '30' } },
    );
  }

  const decision = (data ?? {}) as { allowed?: boolean; used?: number; limit?: number };

  if (decision.allowed === true) return null;

  const retryAfter = secondsUntilReset();
  return Response.json(
    {
      error: 'ai_quota_exceeded',
      kind,
      used: decision.used ?? limit,
      limit: decision.limit ?? limit,
      retryAfterSeconds: retryAfter,
      message: "You have used today's styling allowance. It resets at midnight UTC.",
    },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}
