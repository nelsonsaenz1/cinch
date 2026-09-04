/**
 * The code path's three beats — ledger A42, 2026-09-04.
 *
 * On 2026-09-03 the day's only real signup left an account row with
 * `last_sign_in_at = NULL` (so a code WAS sent) and the funnel could only say
 * `auth_started` ×2, then nothing. Three events now name where inside the
 * email/phone flow a person stops: the address screen refusing to send, a
 * code being sent, six digits being submitted.
 *
 * Under proof: every send path reports a sent code exactly once and only on
 * success; every verify path reports the entry BEFORE the request; the
 * screens pass the resend flag and the attempt number; and — the privacy
 * property — none of the new calls can carry an address, a number, the digits
 * or a provider sentence.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ACTIONS = readFileSync('src/features/auth/actions.ts', 'utf8');
const CODE = readFileSync('src/app/(auth)/code.tsx', 'utf8');
const EMAIL = readFileSync('src/app/(auth)/email.tsx', 'utf8');
const PHONE = readFileSync('src/app/(auth)/phone.tsx', 'utf8');
const POSTHOG = readFileSync('src/lib/posthog.tsx', 'utf8');

function body(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + 1);
  assert.ok(start >= 0 && end > start, `${from} … ${to} not found`);
  return source.slice(start, end);
}

test('the three names are in the union', () => {
  for (const name of ['auth_address_refused', 'auth_code_sent', 'auth_code_entered']) {
    assert.match(POSTHOG, new RegExp(`\\| '${name}'`), name);
  }
});

test('a sent code is reported by the SCREENS on the branch that moves on, never by actions.ts', () => {
  // The address screens race the send against an 8-second ceiling; a late
  // success (and a second press after it) must not count as a code the person
  // saw. So the emit sits on the `result.ok` branch that pushes the code
  // screen, and the send functions themselves stay silent.
  assert.doesNotMatch(ACTIONS, /auth_code_sent'/);
  for (const [screen, method] of [
    [EMAIL, 'email'],
    [PHONE, 'phone'],
  ] as const) {
    const sent = screen.match(/track\('auth_code_sent'[^)]*\)/g) ?? [];
    assert.equal(sent.length, 1, `${method}: one auth_code_sent`);
    assert.match(sent[0], new RegExp(`method: '${method}', resend: false`));
    const at = screen.indexOf("track('auth_code_sent'");
    const okBranch = screen.lastIndexOf('if (result.ok) {', at);
    const push = screen.indexOf("router.push({ pathname: '/(auth)/code'", at);
    assert.ok(okBranch >= 0 && okBranch < at && at < push, `${method}: inside the ok branch, before the push`);
  }
});

test('a submitted code is reported before the request, with the attempt', () => {
  for (const [fn, method, next] of [
    ['export async function verifyEmailCode', 'email', 'export async function sendPhoneCode'],
    ['export async function verifyPhoneCode', 'phone', 'export const CALLBACK_SCHEME'],
  ] as const) {
    const verify = body(ACTIONS, fn, next);
    const entered = verify.indexOf("track('auth_code_entered'");
    assert.ok(entered >= 0, `${method}: auth_code_entered`);
    assert.ok(entered < verify.indexOf('supabase.auth.verifyOtp'), `${method}: before verifyOtp`);
    assert.match(verify, new RegExp(`method: '${method}', attempt: options\\.attempt \\?\\? 1`));
    // The digits are `token`; they must not be in the same call.
    const call = verify.slice(entered, verify.indexOf(')', entered));
    assert.doesNotMatch(call, /token/);
  }
});

test('the code screen marks its sends as resends and numbers its attempts', () => {
  const sent = CODE.match(/track\('auth_code_sent'[^)]*\)/g) ?? [];
  assert.equal(sent.length, 1);
  assert.match(sent[0], /method: viaPhone \? 'phone' : 'email', resend: true/);
  // On the ok branch of the resend, not before it.
  const at = CODE.indexOf("track('auth_code_sent'");
  assert.ok(CODE.lastIndexOf('const result = await sendCode();', at) >= 0);
  assert.ok(CODE.lastIndexOf('if (result.ok) {', at) > CODE.lastIndexOf('const result = await sendCode();', at));
  assert.match(CODE, /verifyPhoneCode\(phone, code, \{ attempt \}\)/);
  assert.match(CODE, /verifyEmailCode\(email, code, \{ attempt \}\)/);
  assert.match(CODE, /verifyCode\(code, MAX_ATTEMPTS - attemptsLeft \+ 1\)/);
});

test('the address screens name their own two refusals, and only those', () => {
  for (const [screen, method] of [
    [EMAIL, 'email'],
    [PHONE, 'phone'],
  ] as const) {
    const refused = screen.match(/track\('auth_address_refused', \{ method: '(\w+)', reason: '(\w+)' \}\)/g) ?? [];
    assert.equal(refused.length, 2, `${method}: two refusals`);
    assert.ok(refused.every((r) => r.includes(`method: '${method}'`)));
    const reasons = refused.map((r) => /reason: '(\w+)'/.exec(r)?.[1]).sort();
    assert.deepEqual(reasons, ['invalid', 'offline']);
  }
});

test('none of the new calls forward a message, an address, a number or a code', () => {
  const calls = [ACTIONS, CODE, EMAIL, PHONE]
    .flatMap((s) => s.match(/track\('auth_(?:address_refused|code_sent|code_entered)'[^)]*\)/g) ?? []);
  assert.ok(calls.length >= 8, `found ${calls.length} calls`);
  for (const call of calls) {
    // The properties only — the event names themselves say "address" and "code".
    const props = call.slice(call.indexOf(','));
    assert.doesNotMatch(props, /message|address|email:|phone:|number|token|digits|code:/, call);
  }
});
