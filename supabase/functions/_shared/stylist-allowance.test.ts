/**
 * The Stylist allowance fails CLOSED.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * Every test here corresponds to a hole that was in the first version of this
 * contract, found in review. All four were the same shape — a dependency that
 * could not answer was treated as permission — and all four ended the same
 * way: a chat delivered to a Standard account without being counted, which
 * turns "five a month" into "up to eight".
 *
 * The rule these prove: NOTHING REACHES THE PROVIDER, AND NOTHING IS
 * DELIVERED, unless the allowance is known and the success is on record.
 *
 * Run with `deno test --no-check supabase/functions/_shared/stylist-allowance.test.ts`.
 * `--no-check` because the module's only imports are `import type`, erased at
 * runtime, so the stub below is all it needs — the npm type packages this repo
 * cannot resolve locally are never loaded.
 */

import { assertEquals } from 'jsr:@std/assert@^1';

import {
  completeStylistChat,
  releaseStylistChat,
  reserveStylistChat,
  resolveStylistPlan,
  RESERVATION_WINDOW_SECONDS,
  STANDARD_CHAT_PROMISE,
} from './stylist-allowance.ts';

const USER = '11111111-1111-1111-1111-111111111111';

/** A Supabase stub that records every RPC and answers from a script. */
function stubAdmin(script: Record<string, { data?: unknown; error?: unknown }>) {
  const calls: string[] = [];
  const admin = {
    rpc(name: string) {
      calls.push(name);
      const answer = script[name] ?? { data: null, error: { message: 'unscripted' } };
      return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
    },
    // deno-lint-ignore no-explicit-any
  } as any;
  return { admin, calls };
}

// ---------------------------------------------------------------------------
// The plan read
// ---------------------------------------------------------------------------

Deno.test('a plan RPC failure returns null rather than guessing free', async () => {
  // The original bug: it fell back to `free`, the caller skipped the
  // reservation, and the provider was called anyway.
  const { admin } = stubAdmin({ effective_plan: { error: { message: 'boom' } } });
  assertEquals(await resolveStylistPlan(admin, USER), null);
});

Deno.test('an empty plan answer returns null', async () => {
  const { admin } = stubAdmin({ effective_plan: { data: null } });
  assertEquals(await resolveStylistPlan(admin, USER), null);
});

Deno.test('an unrecognised plan string returns null rather than being trusted', async () => {
  const { admin } = stubAdmin({ effective_plan: { data: 'enterprise' } });
  assertEquals(await resolveStylistPlan(admin, USER), null);
});

Deno.test('the three real plans resolve', async () => {
  for (const p of ['free', 'standard', 'pro'] as const) {
    const { admin } = stubAdmin({ effective_plan: { data: p } });
    assertEquals(await resolveStylistPlan(admin, USER), p);
  }
});

// ---------------------------------------------------------------------------
// The reservation
// ---------------------------------------------------------------------------

Deno.test('A CLAIM RPC FAILURE IS UNAVAILABLE, NEVER A FREE CHAT', async () => {
  // The worst of the four. It used to return "no reservation, carry on", so a
  // database hiccup delivered an uncounted chat — and repeated, a Standard
  // account could take all eight attempt slots as successes.
  const { admin } = stubAdmin({ claim_stylist_chat: { error: { message: 'boom' } } });
  const r = await reserveStylistChat(admin, USER, 'standard');
  assertEquals(r.kind, 'unavailable');
});

Deno.test('an empty claim answer is unavailable', async () => {
  const { admin } = stubAdmin({ claim_stylist_chat: { data: null } });
  assertEquals((await reserveStylistChat(admin, USER, 'standard')).kind, 'unavailable');
});

Deno.test('allowed without a reservation id is unavailable, not a delivery', async () => {
  // A reservation that cannot be settled would deliver an uncounted chat.
  const { admin } = stubAdmin({
    claim_stylist_chat: { data: { allowed: true, reservation_id: null, used: 1, limit: 5 } },
  });
  assertEquals((await reserveStylistChat(admin, USER, 'standard')).kind, 'unavailable');
});

Deno.test('an unknown refusal reason fails closed', async () => {
  const { admin } = stubAdmin({
    claim_stylist_chat: { data: { allowed: false, reason: 'something_new' } },
  });
  assertEquals((await reserveStylistChat(admin, USER, 'standard')).kind, 'unavailable');
});

Deno.test('FREE AT THIS POINT IS PLAN-EXCLUDED, NOT NOT-APPLICABLE', async () => {
  // The TOCTOU: `enforceAiQuota` read the plan a moment earlier and let this
  // request through as Standard. If entitlement lapsed in between, the account
  // is free HERE — and `plan !== 'standard'` used to fold that in with Pro and
  // send it to the provider.
  const { admin, calls } = stubAdmin({});
  const r = await reserveStylistChat(admin, USER, 'free');
  assertEquals(r.kind, 'plan_excluded');
  // And it never even asked to claim.
  assertEquals(calls, []);
});

Deno.test('PRO ALONE IS NOT-APPLICABLE, and never reserves', async () => {
  const { admin, calls } = stubAdmin({});
  const r = await reserveStylistChat(admin, USER, 'pro');
  assertEquals(r.kind, 'not_applicable');
  assertEquals(calls, []);
});

Deno.test('a Standard claim reserves and reports the allowance', async () => {
  const { admin } = stubAdmin({
    claim_stylist_chat: {
      data: { allowed: true, reservation_id: 'res-1', used: 3, limit: 5, remaining: 2 },
    },
  });
  const r = await reserveStylistChat(admin, USER, 'standard');
  assertEquals(r.kind, 'reserved');
  if (r.kind !== 'reserved') throw new Error('unreachable');
  assertEquals(r.id, 'res-1');
  assertEquals(r.allowance, { promiseLimit: 5, successfulUsed: 3, remaining: 2 });
});

Deno.test('an exhausted claim is exhausted, and carries the allowance', async () => {
  const { admin } = stubAdmin({
    claim_stylist_chat: { data: { allowed: false, reason: 'exhausted', used: 5, limit: 5 } },
  });
  const r = await reserveStylistChat(admin, USER, 'standard');
  assertEquals(r.kind, 'exhausted');
  if (r.kind !== 'exhausted') throw new Error('unreachable');
  assertEquals(r.allowance, { promiseLimit: 5, successfulUsed: 5, remaining: 0 });
});

// ---------------------------------------------------------------------------
// The settlement
// ---------------------------------------------------------------------------

Deno.test('A SETTLEMENT RPC FAILURE IS UNAVAILABLE, so no reply is delivered', async () => {
  // It used to return null and the caller delivered the reply anyway — an
  // uncounted chat leaving through the back of the request.
  const { admin } = stubAdmin({ complete_stylist_chat: { error: { message: 'boom' } } });
  assertEquals((await completeStylistChat(admin, 'res-1', USER)).kind, 'unavailable');
});

Deno.test('AN EXPIRED RESERVATION THAT NO LONGER FITS IS EXHAUSTED, not delivered', async () => {
  // The database released it rather than exceed five. The chat happened; it
  // cannot be counted; so it is not delivered either.
  const { admin } = stubAdmin({
    complete_stylist_chat: { data: { state: 'released', changed: false, used: 5, limit: 5 } },
  });
  const s = await completeStylistChat(admin, 'res-1', USER);
  assertEquals(s.kind, 'exhausted');
});

Deno.test('a completed settlement is completed, and so is an idempotent replay', async () => {
  for (const changed of [true, false]) {
    const { admin } = stubAdmin({
      complete_stylist_chat: { data: { state: 'completed', changed, used: 4, limit: 5 } },
    });
    const s = await completeStylistChat(admin, 'res-1', USER);
    assertEquals(s.kind, 'completed');
    if (s.kind !== 'completed') throw new Error('unreachable');
    assertEquals(s.allowance, { promiseLimit: 5, successfulUsed: 4, remaining: 1 });
  }
});

Deno.test('an unknown reservation is unavailable, never a delivery', async () => {
  // An id that does not belong to this account, or no longer exists.
  const { admin } = stubAdmin({
    complete_stylist_chat: { data: { state: 'unknown', changed: false } },
  });
  assertEquals((await completeStylistChat(admin, 'res-x', USER)).kind, 'unavailable');
});

Deno.test('Pro settles as not-applicable and calls nothing', async () => {
  const { admin, calls } = stubAdmin({});
  assertEquals((await completeStylistChat(admin, null, USER)).kind, 'not_applicable');
  assertEquals(calls, []);
});

// ---------------------------------------------------------------------------
// Release, and the bounds of what travels
// ---------------------------------------------------------------------------

Deno.test('releasing without a reservation calls nothing', async () => {
  const { admin, calls } = stubAdmin({});
  await releaseStylistChat(admin, null, USER);
  assertEquals(calls, []);
});

Deno.test('the allowance is clamped both ways and never exceeds the promise', async () => {
  const { admin } = stubAdmin({
    // A counter that somehow read high must not produce a figure nobody can
    // explain, and a negative one is a bug wearing a minus sign.
    claim_stylist_chat: { data: { allowed: true, reservation_id: 'r', used: 99, limit: 5 } },
  });
  const r = await reserveStylistChat(admin, USER, 'standard');
  if (r.kind !== 'reserved') throw new Error('unreachable');
  assertEquals(r.allowance, { promiseLimit: 5, successfulUsed: 5, remaining: 0 });
});

Deno.test('the promise is five, and it is not the eight-attempt ceiling', async () => {
  assertEquals(STANDARD_CHAT_PROMISE, 5);
});

// ---------------------------------------------------------------------------
// Two refusals that must never be confused for each other
// ---------------------------------------------------------------------------

Deno.test('a held slot is its own refusal, and reports the four real successes', async () => {
  const { admin } = stubAdmin({
    claim_stylist_chat: {
      data: {
        allowed: false,
        reason: 'capacity_held',
        used: 4,
        limit: 5,
        remaining: 1,
        retry_after_seconds: 900,
      },
    },
  });
  const r = await reserveStylistChat(admin, USER, 'standard');
  assertEquals(r.kind, 'capacity_held');
  if (r.kind !== 'capacity_held') throw new Error('unreachable');
  // The allowance beside the refusal says four, not five. This is the whole
  // point of the split: the sentence and the mark have to agree.
  assertEquals(r.allowance, { promiseLimit: 5, successfulUsed: 4, remaining: 1 });
  assertEquals(r.retryAfterSeconds, 900);
});

Deno.test('the retry hint is clamped to the reservation window', async () => {
  const { admin } = stubAdmin({
    claim_stylist_chat: {
      data: { allowed: false, reason: 'capacity_held', used: 0, limit: 5, retry_after_seconds: 99999 },
    },
  });
  const r = await reserveStylistChat(admin, USER, 'standard');
  if (r.kind !== 'capacity_held') throw new Error('unreachable');
  assertEquals(r.retryAfterSeconds, RESERVATION_WINDOW_SECONDS);
});

Deno.test('a missing or nonsense retry hint still yields a usable wait', async () => {
  for (const retry_after_seconds of [undefined, 0, -5, 'soon', null]) {
    const { admin } = stubAdmin({
      claim_stylist_chat: {
        data: { allowed: false, reason: 'capacity_held', used: 1, limit: 5, retry_after_seconds },
      },
    });
    const r = await reserveStylistChat(admin, USER, 'standard');
    if (r.kind !== 'capacity_held') throw new Error('unreachable');
    assertEquals(r.retryAfterSeconds, 60);
  }
});

Deno.test('exhaustion stays exhaustion, and reports five spent', async () => {
  const { admin } = stubAdmin({
    claim_stylist_chat: {
      data: { allowed: false, reason: 'exhausted', used: 5, limit: 5, remaining: 0 },
    },
  });
  const r = await reserveStylistChat(admin, USER, 'standard');
  assertEquals(r.kind, 'exhausted');
  if (r.kind !== 'exhausted') throw new Error('unreachable');
  assertEquals(r.allowance, { promiseLimit: 5, successfulUsed: 5, remaining: 0 });
});

Deno.test('a live reservation never inflates the successes reported', async () => {
  // Four completed and one live is capacity of five, and four successes. The
  // helper reads what the RPC reports rather than deriving it from capacity,
  // which is exactly what the earlier contract got wrong.
  const { admin } = stubAdmin({
    claim_stylist_chat: {
      data: { allowed: false, reason: 'capacity_held', used: 4, limit: 5, remaining: 1, retry_after_seconds: 12 },
    },
  });
  const r = await reserveStylistChat(admin, USER, 'standard');
  if (r.kind !== 'capacity_held') throw new Error('unreachable');
  assertEquals(r.allowance?.successfulUsed, 4);
  assertEquals(r.allowance!.successfulUsed + r.allowance!.remaining, STANDARD_CHAT_PROMISE);
});
