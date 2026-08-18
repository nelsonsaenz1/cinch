/**
 * The Stylist allowance contract, asserted against the Edge Function's source.
 *
 * `supabase/functions/_shared/stylist-allowance.test.ts` proves the helper
 * returns the right STATE for every failure. This file proves the CALLER
 * answers each of those states in the right place — because a helper that
 * fails closed is worthless if the handler ignores it, and every one of the
 * four holes found in review was exactly that: a state the caller did not act
 * on.
 *
 * The rule, in one line: no fail-closed branch may sit below the provider
 * call, and `ok: true` may only appear below a confirmed settlement.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FN_RAW = readFileSync('supabase/functions/stylist-chat/index.ts', 'utf8');
const HELPER_RAW = readFileSync('supabase/functions/_shared/stylist-allowance.ts', 'utf8');
const QUOTA_RAW = readFileSync('supabase/functions/_shared/quota.ts', 'utf8');
const stripped = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const FN = stripped(FN_RAW);
const HELPER = stripped(HELPER_RAW);

/** Where the money is spent. Everything that guards it must be above this. */
const PROVIDER = FN.indexOf('await completeStructured<ChatResult>');
/** Where a reply is handed to the reader. */
const DELIVERY = FN.indexOf('ok: true');

test('the provider call and the delivery are both found', () => {
  assert.ok(PROVIDER > 0, 'the provider call site moved');
  assert.ok(DELIVERY > PROVIDER, 'the delivery is not after the provider call');
});

// ---------------------------------------------------------------------------
// Nothing reaches the provider without a known allowance
// ---------------------------------------------------------------------------

/** The `return Response.json(...)` a branch answers with, and nothing past it. */
const branchBody = (needle: string) => {
  const at = FN.indexOf(needle);
  assert.ok(at > 0, `${needle} is not handled at all`);
  const start = FN.indexOf('return Response.json(', at);
  const end = FN.indexOf('\n      }\n', start);
  assert.ok(start > at && end > start, `${needle} has no bounded response`);
  return FN.slice(start, end);
};

const before = (needle: string, what: string) => {
  const at = FN.indexOf(needle);
  assert.ok(at > 0, `${what} is not handled at all`);
  assert.ok(at < PROVIDER, `${what} is handled BELOW the provider call`);
  return at;
};

test('AN UNKNOWN PLAN STOPS BEFORE THE PROVIDER', () => {
  // It used to fall back to free, skip the reservation, and call the provider
  // anyway — an uncounted chat for a Standard account.
  const at = before('if (plan === null) {', 'an undeterminable plan');
  const block = FN.slice(at, at + 400);
  assert.match(block, /status: 503/);
  assert.match(block, /'Retry-After': '30'/);
});

test('A FAILED CLAIM STOPS BEFORE THE PROVIDER', () => {
  // The worst of the four: repeated, it let Standard take all eight attempt
  // slots as successes.
  const at = before("reservation.kind === 'unavailable'", 'an unavailable reservation');
  assert.match(FN.slice(at, at + 400), /status: 503/);
});

test('A FREE PLAN AT RESERVATION TIME STOPS BEFORE THE PROVIDER', () => {
  // The TOCTOU: entitlement can lapse between `enforceAiQuota`'s plan read and
  // this one, and `plan !== 'standard'` used to fold free in with Pro.
  const at = before("reservation.kind === 'plan_excluded'", 'a lapsed entitlement');
  const block = FN.slice(at, at + 500);
  assert.match(block, /status: 402/);
  assert.match(block, /plan_upgrade_required/);
  // 402 is a boundary, not a clock: no retry hint.
  assert.doesNotMatch(block, /Retry-After/);
});

test('AN EXHAUSTED ALLOWANCE STOPS BEFORE THE PROVIDER', () => {
  const at = before("reservation.kind === 'exhausted'", 'an exhausted allowance');
  const block = FN.slice(at, at + 500);
  assert.match(block, /status: 429/);
  assert.match(block, /allowance: reservation\.allowance/);
});

test('every reservation state is answered — none can fall through', () => {
  for (const kind of ['plan_excluded', 'unavailable', 'exhausted', 'capacity_held']) {
    assert.match(FN, new RegExp(`reservation\\.kind === '${kind}'`), `${kind} is unhandled`);
  }
  // `reserved` and `not_applicable` are the two that proceed, and they are the
  // only two the helper can return that are not checked above.
  assert.match(FN, /reservation\.kind === 'reserved' \? reservation\.id : null/);
});

// ---------------------------------------------------------------------------
// The two refusals say two different things
// ---------------------------------------------------------------------------

test('A HELD SLOT STOPS BEFORE THE PROVIDER', () => {
  before("reservation.kind === 'capacity_held'", 'a momentarily held slot');
  const block = branchBody("reservation.kind === 'capacity_held'");
  assert.match(block, /status: 503/);
  assert.match(block, /'Retry-After': String\(reservation\.retryAfterSeconds\)/);
  // It carries the allowance, so the mark beside the refusal stays truthful.
  assert.match(block, /allowance: reservation\.allowance/);
});

test('THE HELD-SLOT REFUSAL NEVER CLAIMS THE MONTH IS SPENT', () => {
  const block = branchBody("reservation.kind === 'capacity_held'");
  // Not exhaustion's words, which would contradict an allowance of 4 of 5.
  assert.doesNotMatch(block, /this month|used all|no chats left|out of chats/i);
  // Not five, and not the eight-attempt ceiling either.
  assert.doesNotMatch(block, /\b(five|5|eight|8)\b/i);
});

test('THE HELD-SLOT REFUSAL NEVER DISCLOSES ANOTHER DEVICE OR PERSON', () => {
  const message = /message: '([^']+)'/.exec(branchBody("reservation.kind === 'capacity_held'"))?.[1] ?? '';
  assert.ok(message.length > 0, 'the held-slot refusal has no message');
  // "Another stylist chat" is a fact about this account's own allowance.
  // "Another device", "someone else", a session or a person is not.
  assert.doesNotMatch(message, /device|phone|someone|somebody|another user|session|elsewhere|signed in/i);
});

test('A HELD SLOT IS NOT ROUTED TO A PAYWALL', () => {
  // 429 is what the shared client classifier turns into an upgrade placement.
  // Selling an upgrade to somebody who must wait fifteen seconds — and who has
  // a chat left — is the failure this whole split exists to prevent.
  const block = branchBody("reservation.kind === 'capacity_held'");
  assert.doesNotMatch(block, /status: 429/);
  assert.doesNotMatch(block, /status: 402/);
});

test('the two refusals are distinct codes, and neither is the other', () => {
  const held = FN.indexOf("error: 'stylist_capacity_held'");
  assert.ok(held > 0, 'the held-slot refusal has no bounded code');
  // Exhaustion keeps the 429 it always had; the codes never collide.
  const exhausted = FN.indexOf("reservation.kind === 'exhausted'");
  assert.match(FN.slice(exhausted, exhausted + 700), /status: 429/);
});

test('the retry hint is bounded by the window, in the one place that clamps it', () => {
  assert.match(HELPER, /RESERVATION_WINDOW_SECONDS = 15 \* 60/);
  assert.match(HELPER, /Math\.min\(Math\.ceil\(raw\), RESERVATION_WINDOW_SECONDS\)/);
});

// ---------------------------------------------------------------------------
// Nothing is delivered without a confirmed settlement
// ---------------------------------------------------------------------------

test('A FAILED SETTLEMENT IS NOT DELIVERED', () => {
  // It used to return null and the reply went out anyway.
  const at = FN.indexOf("settlement.kind === 'unavailable'");
  assert.ok(at > 0, 'a failed settlement is unhandled');
  assert.ok(at < DELIVERY, 'a failed settlement is checked after the delivery');
  assert.match(FN.slice(at, at + 400), /status: 503/);
});

test('AN EXPIRED-AND-FULL SETTLEMENT IS NOT DELIVERED', () => {
  // The database released it rather than exceed five. The chat happened, it
  // cannot be counted, so it is not delivered either.
  const at = FN.indexOf("settlement.kind === 'exhausted'");
  assert.ok(at > 0, 'an exhausted settlement is unhandled');
  assert.ok(at < DELIVERY, 'an exhausted settlement is checked after the delivery');
  assert.match(FN.slice(at, at + 400), /status: 429/);
});

test('the reply is delivered exactly once, and only past both settlement guards', () => {
  assert.equal((FN.match(/ok: true/g) ?? []).length, 1);
  assert.match(FN, /settlement\.kind === 'completed' \? settlement\.allowance : null/);
});

test('a failed provider call releases the reservation', () => {
  // The CALL SITE, not the import — which naturally sits at the top of the
  // file, above everything.
  const at = FN.indexOf('await releaseStylistChat(');
  assert.ok(at > PROVIDER, 'the release is not on the failure path');
  assert.ok(at < DELIVERY, 'the release is below the delivery');
  assert.match(FN, /await releaseStylistChat\(admin, reservationId, userId\)/);
});

// ---------------------------------------------------------------------------
// The blast radius stayed where it was promised
// ---------------------------------------------------------------------------

test('the shared quota helper is untouched — seven other functions depend on it', () => {
  // The whole reason this lives in its own module.
  assert.doesNotMatch(QUOTA_RAW, /stylist_success|claim_stylist_chat|StylistAllowance/);
  assert.match(QUOTA_RAW, /export async function enforceAiQuota/);
});

test('the attempt ceiling is still claimed, and before the product allowance', () => {
  const ceiling = FN.indexOf("enforceAiQuota(admin, userId, 'stylist_chat')");
  const product = FN.indexOf('reserveStylistChat(admin, userId, plan)');
  assert.ok(ceiling > 0 && product > ceiling, 'the abuse ceiling no longer runs first');
});

test('the eight-attempt ceiling is never presented as the allowance', () => {
  // Standard is sold five. Eight is failure and abuse slack.
  assert.match(HELPER, /STANDARD_CHAT_PROMISE = 5/);
  assert.doesNotMatch(HELPER, /promiseLimit: 8|limit: 8/);
});

test('Pro is unlimited as a product and never reserves', () => {
  assert.match(HELPER, /if \(plan === 'pro'\) return \{ kind: 'not_applicable' \}/);
  // And its 100/day anti-abuse ceiling never reaches DRAWN CODE. The stripped
  // source is the right subject: the docblock names the number precisely in
  // order to say it must not be surfaced, and a sweep that flagged that
  // explanation would be a gate nobody can satisfy.
  assert.doesNotMatch(HELPER, /\b100\b/);
});

// ---------------------------------------------------------------------------
// What travels
// ---------------------------------------------------------------------------

test('the allowance fact is three bounded integers and nothing else', () => {
  const shape = HELPER.slice(HELPER.indexOf('export type StylistAllowance'), HELPER.indexOf('export type StylistReservation'));
  const fields = [...shape.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(fields, ['promiseLimit', 'successfulUsed', 'remaining']);
});

test('no server error message is forwarded to the client', () => {
  // A raw error string is free text that one day carries a row id.
  const responses = FN.match(/Response\.json\(\s*\{[\s\S]{0,400}?\},\s*\{\s*status: (?:402|429|503)/g) ?? [];
  assert.ok(responses.length >= 4, `expected the bounded refusals, found ${responses.length}`);
  for (const r of responses) {
    assert.doesNotMatch(r, /error\.message|err\.message|String\(error\)/, r);
  }
});
