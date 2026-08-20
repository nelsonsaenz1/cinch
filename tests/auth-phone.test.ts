/**
 * The phone run's contract — the sibling of `tests/auth-email.test.ts`.
 *
 * What is pinned, and why it is these things:
 *
 *   1. `normalizePhone` is the ONLY door to the server, so its readings are
 *      the whole of "which strings become accounts". A number that normalized
 *      differently on two sign-ins would be two accounts — the E.164 outputs
 *      here are load-bearing, not cosmetic.
 *   2. The phone door stays SHUT (`PHONE_SIGN_IN_ENABLED === false`) until the
 *      SMS provider is live. This assertion is the tripwire: flipping the flag
 *      is deliberate, one line, and fails this test — which is the moment to
 *      delete the assertion, confirm Twilio is connected in Supabase, and ship
 *      knowingly. It cannot flip by accident inside a refactor.
 *   3. The welcome screen does not import the phone flow while the flag is
 *      down — the same boundary auth-run-layout.test.ts holds for the run.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PHONE_SIGN_IN_ENABLED, PHONE_SUBLINE } from '../src/features/auth/auth-run-spec';
import { formatPhoneForDisplay, isValidPhone, normalizePhone } from '../src/features/auth/phone';

test('a bare ten-digit US number normalizes to E.164', () => {
  assert.equal(normalizePhone('3334445555'), '+13334445555');
  assert.equal(normalizePhone('(333) 444-5555'), '+13334445555');
  assert.equal(normalizePhone('333.444.5555'), '+13334445555');
  assert.equal(normalizePhone(' 333 444 5555 '), '+13334445555');
});

test('a US number typed with its country code is read as one, not refused', () => {
  assert.equal(normalizePhone('13334445555'), '+13334445555');
  assert.equal(normalizePhone('1 (333) 444-5555'), '+13334445555');
});

test('an explicit + is taken at its word for any country', () => {
  assert.equal(normalizePhone('+13334445555'), '+13334445555');
  assert.equal(normalizePhone('+44 7911 123456'), '+447911123456');
  assert.equal(normalizePhone('+61 412 345 678'), '+61412345678');
});

test('the same number in different dress normalizes identically', () => {
  // The two-accounts bug this module exists to prevent.
  const forms = ['3334445555', '(333) 444-5555', '+1 333-444-5555', '1.333.444.5555'];
  const readings = new Set(forms.map(normalizePhone));
  assert.deepEqual([...readings], ['+13334445555']);
});

test('shapes with no honest reading are refused, not guessed at', () => {
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone('hello'), null);
  assert.equal(normalizePhone('12345'), null);
  // NANP forbids a leading 0/1 in the area code and the exchange.
  assert.equal(normalizePhone('1334445555'), null);
  assert.equal(normalizePhone('3331445555'), null);
  // A + followed by too few or too many digits is outside E.164.
  assert.equal(normalizePhone('+1234567'), null);
  assert.equal(normalizePhone('+1234567890123456'), null);
  // E.164 has no leading zero.
  assert.equal(normalizePhone('+0123456789'), null);
  assert.equal(isValidPhone('999'), false);
});

test('display formatting is national for US, grouped E.164 for the rest', () => {
  assert.equal(formatPhoneForDisplay('+13334445555'), '(333) 444-5555');
  assert.equal(formatPhoneForDisplay('+447911123456'), '+447911123456');
});

test('the phone door stays shut until the SMS provider is live', () => {
  // Deleting this assertion is part of turning the flag on — see the header.
  assert.equal(PHONE_SIGN_IN_ENABLED, false);

  const welcome = readFileSync('src/app/(auth)/sign-in.tsx', 'utf8');
  assert.ok(
    !welcome.includes('/(auth)/phone'),
    'the welcome screen must not offer the phone door while PHONE_SIGN_IN_ENABLED is false',
  );
});

test('the carrier consent sentence is said where the number is collected', () => {
  assert.match(PHONE_SUBLINE, /Message and data rates may apply/);
});
