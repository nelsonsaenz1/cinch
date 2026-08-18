import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from './database.types.ts';
import type { Plan } from './plans.ts';

/**
 * Standard's FIVE successful stylist chats a month.
 *
 * ── WHY THIS IS NOT `enforceAiQuota` ────────────────────────────────────────
 *
 * `enforceAiQuota` counts ATTEMPTS, and for `stylist_chat` on Standard it is
 * set to eight. That eight is deliberate slack: it is what keeps five
 * deliverable through a failed call or two, and it is an abuse ceiling rather
 * than a product promise. Exposing it as "chats" would tell somebody they had
 * eight, and the eighth is the one they would remember.
 *
 * So this is a second, dedicated counter with a different meaning, and it
 * lives in its own file for a specific reason: `enforceAiQuota` is called from
 * twelve sites across seven production functions, and changing its signature
 * to carry a number only the stylist needs would put six unrelated functions
 * in the blast radius of a presentation change.
 *
 * ── RESERVE, THEN SETTLE ────────────────────────────────────────────────────
 *
 * The slot is reserved BEFORE the provider call and settled after, by opaque
 * id. Reserving first is what makes the boundary true across devices — the
 * database serialises two claimants on a per-user advisory lock, so the second
 * reads the first's reservation and is refused. Settling by id is what makes
 * completion and release idempotent: a retried release finds the row already
 * settled and changes nothing, and a release that arrives after the reply
 * landed cannot erase a real success.
 *
 * PRO NEVER RESERVES. It is unlimited as a product; its 100/day ceiling is
 * anti-abuse and is enforced by `enforceAiQuota` alone, never surfaced.
 * FREE is normally refused earlier by `enforceAiQuota` with 402 — but it can
 * still arrive, because this is a SECOND plan read and entitlement can lapse
 * between the two. It is answered here rather than assumed away.
 */

/** The number Standard is sold. Never the eight-attempt ceiling. */
export const STANDARD_CHAT_PROMISE = 5;

/**
 * The reservation window, mirrored from `stylist_reservation_window()`.
 *
 * Used only to CLAMP a retry hint the database already computed — never to
 * decide anything. The database owns the window; this is the ceiling that
 * stops a malformed hint outliving it.
 */
export const RESERVATION_WINDOW_SECONDS = 15 * 60;

/** The bounded fact the client is allowed to see. Nothing else travels. */
export type StylistAllowance = {
  promiseLimit: number;
  successfulUsed: number;
  remaining: number;
};

/**
 * The outcome of trying to reserve a chat.
 *
 * A DISCRIMINATED UNION rather than a nullable id, because the previous shape
 * had exactly one dangerous state: "no reservation, carry on". A claim that
 * failed and a plan that does not reserve looked identical to the caller, so a
 * database hiccup silently produced an uncounted chat — and repeated, a
 * Standard account could take all EIGHT attempt slots as successes. The union
 * makes "I could not tell" a state the caller has to answer.
 */
export type StylistReservation =
  | { kind: 'reserved'; id: string; allowance: StylistAllowance | null }
  /** Standard, and this month's five successes are on record. Answers 429. */
  | { kind: 'exhausted'; allowance: StylistAllowance | null }
  /**
   * Fewer than five successes, but every slot is momentarily held by a live
   * reservation — another device mid-chat, or this one retrying.
   *
   * A DIFFERENT REFUSAL, because it has a different remedy and a different
   * truth: it clears on its own, and saying "you have used this month's chats"
   * over an allowance that reports one remaining would contradict itself in two
   * adjacent sentences. It says nothing about what is holding the slot —
   * whose device it is, or that one exists, is not this response's business.
   */
  | { kind: 'capacity_held'; allowance: StylistAllowance | null; retryAfterSeconds: number }
  /**
   * PRO ONLY. Unlimited as a product; nothing to reserve and nothing to
   * report. Deliberately not "every plan that is not Standard" — see below.
   */
  | { kind: 'not_applicable' }
  /**
   * The account resolved to free HERE, after `enforceAiQuota` had already let
   * it through as Standard. Entitlement changed mid-request — a lapse, or a
   * webhook landing between the two reads — and the caller answers the same
   * 402 a free account would have got, without calling the provider.
   */
  | { kind: 'plan_excluded' }
  /**
   * The allowance could not be determined. The caller answers 503 and DOES NOT
   * CALL THE PROVIDER — see the note on `reserveStylistChat`.
   */
  | { kind: 'unavailable' };

/**
 * The outcome of settling a reservation after the provider answered.
 *
 * Settlement is AUTHORITATIVE, not advisory. A reply may only be delivered
 * once the success is on record: returning `ok: true` alongside a settlement
 * that failed, or one the database refused, would deliver an uncounted chat —
 * the same leak as an unreserved one, arriving through the other end.
 */
export type StylistSettlement =
  /** On record. Includes the idempotent case where it already was. */
  | { kind: 'completed'; allowance: StylistAllowance | null }
  /**
   * An expired reservation that no longer fits: the database released it
   * rather than exceed five. The caller answers 429 and does not deliver.
   */
  | { kind: 'exhausted'; allowance: StylistAllowance | null }
  /** Pro, or no reservation to settle. Deliver normally. */
  | { kind: 'not_applicable' }
  /** The settlement call failed. The caller answers 503 and does not deliver. */
  | { kind: 'unavailable' };

function toAllowance(row: Record<string, unknown> | null): StylistAllowance | null {
  if (!row) return null;
  const used = Number(row.used ?? 0);
  const limit = Number(row.limit ?? STANDARD_CHAT_PROMISE);
  if (!Number.isFinite(used) || !Number.isFinite(limit)) return null;
  return {
    promiseLimit: limit,
    // Clamped both ways. A figure above the promise is a number nobody can
    // explain, and a negative one is a bug wearing a minus sign.
    successfulUsed: Math.max(0, Math.min(used, limit)),
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Reserve a chat for a Standard account.
 *
 * Returns `{id: null, allowance: null}` for every other plan, which the caller
 * treats as "nothing to settle and nothing to report" — Pro is unlimited and
 * has no allowance fact to show.
 */
export async function reserveStylistChat(
  admin: SupabaseClient<Database>,
  userId: string,
  plan: Plan,
): Promise<StylistReservation> {
  // ── EXPLICIT PER PLAN, NOT "ANYTHING BUT STANDARD" ──────────────────────
  //
  // `plan !== 'standard'` folded FREE in with Pro, and that is a real
  // time-of-check/time-of-use hole: `enforceAiQuota` resolved the plan a
  // moment ago and let this request through, and this is a SECOND read. An
  // entitlement that lapsed in between arrives here as free, took the
  // not-applicable branch, and was sent to the provider — the one thing a
  // free account must never reach.
  if (plan === 'pro') return { kind: 'not_applicable' };
  if (plan === 'free') return { kind: 'plan_excluded' };

  const { data, error } = await admin.rpc('claim_stylist_chat', {
    p_user_id: userId,
    p_limit: STANDARD_CHAT_PROMISE,
  });

  // ── FAIL CLOSED ─────────────────────────────────────────────────────────
  //
  // This used to carry on: a failed claim returned "no reservation" and the
  // caller called the provider anyway. That is not a degraded mark, it is a
  // FREE CHAT — and repeated, a Standard account could take all eight attempt
  // slots as successes, which is the exact promise this whole contract exists
  // to keep.
  //
  // `enforceAiQuota` in this same request already fails closed with 503 on an
  // unreachable counter, for the same reason: the one dependency whose job is
  // to bound spending must not be optional precisely when it is unhealthy.
  if (error || !data) return { kind: 'unavailable' };

  const row = data as Record<string, unknown>;

  if (row.allowed === true) {
    const id = typeof row.reservation_id === 'string' ? row.reservation_id : null;
    // Allowed but no id is incoherent — a reservation that cannot be settled
    // would deliver an uncounted chat. Treated as unavailable rather than
    // guessed at.
    if (!id) return { kind: 'unavailable' };
    return { kind: 'reserved', id, allowance: toAllowance(row) };
  }

  if (row.reason === 'exhausted') return { kind: 'exhausted', allowance: toAllowance(row) };

  if (row.reason === 'capacity_held') {
    const raw = Number(row.retry_after_seconds);
    // Bounded by the reservation window either way: a hint longer than the
    // window would outlive the thing it is waiting for.
    const retryAfterSeconds =
      Number.isFinite(raw) && raw > 0 ? Math.min(Math.ceil(raw), RESERVATION_WINDOW_SECONDS) : 60;
    return { kind: 'capacity_held', allowance: toAllowance(row), retryAfterSeconds };
  }

  // `plan_excluded` from the RPC would mean a zero limit for an account that
  // reached here as Standard, which this build has no coherent reading for —
  // and any other reason is one it does not know. Unknown refusals fail
  // closed rather than guess.
  return { kind: 'unavailable' };
}

/**
 * Settle a reservation as a real success. Idempotent for that exact id.
 *
 * ── WHY THIS RETURNS A STATE RATHER THAN A NUMBER ───────────────────────────
 *
 * It used to return `StylistAllowance | null`, and the caller delivered the
 * reply either way. Two states leaked an uncounted chat through that:
 *
 *   * a FAILED settlement call returned null, and the reply went out anyway;
 *   * an EXPIRED reservation that no longer fitted was RELEASED by the
 *     database — correctly, rather than exceed five — and the reply still went
 *     out, as a sixth chat nobody counted.
 *
 * So the caller is now told what happened and must answer it. A reply is
 * delivered only against a success that is on record.
 */
export async function completeStylistChat(
  admin: SupabaseClient<Database>,
  reservationId: string | null,
  userId: string,
): Promise<StylistSettlement> {
  if (!reservationId) return { kind: 'not_applicable' };

  const { data, error } = await admin.rpc('complete_stylist_chat', {
    p_reservation_id: reservationId,
    p_user_id: userId,
    p_limit: STANDARD_CHAT_PROMISE,
  });

  if (error || !data) return { kind: 'unavailable' };

  const row = data as Record<string, unknown>;
  const allowance = toAllowance(row);

  // `completed` covers the idempotent replay: a second settlement finds the
  // row already completed, reports `changed: false`, and is still a success on
  // record.
  if (row.state === 'completed') return { kind: 'completed', allowance };

  // The database refused to let an expired reservation exceed five and
  // released it instead. The chat happened; it cannot be counted; so it is not
  // delivered either.
  if (row.state === 'released') return { kind: 'exhausted', allowance };

  // `unknown` — an id that does not belong to this account, or no longer
  // exists. Nothing to stand a delivery on.
  return { kind: 'unavailable' };
}

/**
 * Give a reservation back after a failed provider call.
 *
 * Best effort by design: if this call itself fails, the reservation expires on
 * its own window and stops holding the slot. An abandoned reservation costs a
 * quarter of an hour, never a chat.
 */
export async function releaseStylistChat(
  admin: SupabaseClient<Database>,
  reservationId: string | null,
  userId: string,
): Promise<void> {
  if (!reservationId) return;
  await admin.rpc('release_stylist_chat', {
    p_reservation_id: reservationId,
    p_user_id: userId,
    p_limit: STANDARD_CHAT_PROMISE,
  });
}

/**
 * The plan this account is entitled to right now, trial included.
 *
 * Re-derived here from the same `effective_plan` RPC `quota.ts` reads, rather
 * than exporting its private copy. Two callers of one server-side function is
 * not duplication of policy — the policy lives in the database — and it keeps
 * this file from being a reason to edit a module seven production functions
 * import.
 *
 * Returns NULL when the plan cannot be determined — never a guess. The
 * least-privilege default that is right in `quota.ts` inverts here: a Standard
 * account misread as free would skip its reservation and still be sent to the
 * provider, so the honest answer is "I could not tell" and the caller stops.
 */
export async function resolveStylistPlan(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<Plan | null> {
  const { data, error } = await admin.rpc('effective_plan', { p_user_id: userId });
  // ── FAIL CLOSED ─────────────────────────────────────────────────────────
  //
  // This used to fall back to `free`, borrowing `quota.ts`'s least-privilege
  // default — and that default is right THERE, where a wrong guess costs
  // somebody a tagging call. Here it inverted: a Standard account misread as
  // free skipped the reservation entirely and the provider was called anyway,
  // so a plan hiccup produced an uncounted chat.
  //
  // Null means "I could not tell", and the caller answers 503 rather than
  // choosing on the account's behalf.
  if (error || !data) return null;
  const plan = data as string;
  return plan === 'free' || plan === 'standard' || plan === 'pro' ? (plan as Plan) : null;
}
