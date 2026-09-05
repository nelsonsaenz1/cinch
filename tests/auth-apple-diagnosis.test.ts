/**
 * The Apple sign-in diagnosis — added 2026-08-30, when nine users across ten
 * days failed `apple/failed` on the welcome screen (every one on iOS 26.6.1,
 * retrying four to seven times, none ever completing) and the funnel could
 * not say why, because `reportAuth` rightly refuses to send error MESSAGES
 * to the vendor.
 *
 * Two things are under proof: the diagnostic `code` is drawn from a closed
 * set and never a sentence, and the welcome screen stops implying that one
 * more identical tap will differ — the second real failure names the email
 * door instead.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { appleFailureCode } from '../src/features/auth/sign-in-errors';

// ---------------------------------------------------------------------------
// The closed set
// ---------------------------------------------------------------------------

test('a recognized module code passes through; everything else collapses', () => {
  assert.equal(appleFailureCode({ code: 'ERR_REQUEST_FAILED' }), 'ERR_REQUEST_FAILED');
  assert.equal(appleFailureCode({ code: 'ERR_REQUEST_UNKNOWN' }), 'ERR_REQUEST_UNKNOWN');
  // The collapse is the privacy property: no unrecognized string survives.
  assert.equal(appleFailureCode({ code: 'SOMETHING_NEW' }), 'thrown_other');
  assert.equal(appleFailureCode({ code: 'user@example.com' }), 'thrown_other');
  assert.equal(appleFailureCode(new Error('a whole sentence')), 'thrown_other');
  assert.equal(appleFailureCode(undefined), 'thrown_other');
  assert.equal(appleFailureCode({ code: 42 }), 'thrown_other');
});

// ---------------------------------------------------------------------------
// The wiring, as source contract
// ---------------------------------------------------------------------------

const ACTIONS = readFileSync('src/features/auth/actions.ts', 'utf8');
const SIGN_IN = readFileSync('src/app/(auth)/sign-in.tsx', 'utf8');

test('every apple failure path carries a bounded code, and cancel carries none', () => {
  assert.match(ACTIONS, /code: 'no_identity_token'/);
  assert.match(ACTIONS, /code: `supabase_\$\{error\.status \?\? 'x'\}`/);
  assert.match(ACTIONS, /code: appleFailureCode\(err\)/);
  // A cancel is not a failure worth diagnosing; it must stay code-free so the
  // funnel's most common outcome does not grow a spurious dimension.
  assert.match(ACTIONS, /\{ ok: false, reason: 'canceled' \}/);
});

test('reportAuth forwards the code and still never the message', () => {
  const report = ACTIONS.slice(
    ACTIONS.indexOf('function reportAuth'),
    ACTIONS.indexOf('export async function signInWithApple'),
  );
  assert.match(report, /result\.code/);
  assert.doesNotMatch(report, /result\.message/);
});

test('the second real apple failure names the email door', () => {
  assert.match(SIGN_IN, /appleFailures\.current \+= 1/);
  assert.match(SIGN_IN, /appleFailures\.current >= 2 \? TOAST_APPLE_KEEPS_FAILING : TOAST_DID_NOT_FINISH/);
  assert.match(SIGN_IN, /Use email instead/);
  // The cancel branch must not feed the count — dismissing the sheet twice is
  // not a broken phone.
  const cancelBranch = SIGN_IN.slice(
    SIGN_IN.indexOf("case 'canceled':"),
    SIGN_IN.indexOf("case 'unavailable':"),
  );
  assert.doesNotMatch(cancelBranch, /appleFailures/);
});

test('A45 — a cancelled Apple sheet draws the second door, and still is not a failure', () => {
  // The line, as a question: the sheet may simply have been dismissed.
  assert.match(SIGN_IN, /const CANCEL_HINT = 'Trouble with Apple sign-in\? Use your email instead\.';/);
  const cancelBranch = SIGN_IN.slice(
    SIGN_IN.indexOf("case 'canceled':"),
    SIGN_IN.indexOf("case 'unavailable':"),
  );
  // The first cancel reports once and flips the state; the count of REAL
  // failures is untouched (the earlier test), so the hint and the escalation
  // stay two different sentences for two different facts.
  assert.match(cancelBranch, /if \(!appleCancelled\) track\('auth_cancel_hint_shown'\);\s*setAppleCancelled\(true\);/);
  assert.doesNotMatch(cancelBranch, /appleFailures/);
  // Drawn under the Apple button, only where Apple was offered, and it IS the
  // email door: the same `onEmail` the button below it calls, which fires
  // `auth_started {method: 'email'}` on its own.
  assert.match(
    SIGN_IN,
    /\{appleAvailable && appleCancelled \? \(\s*<Pressable\s*onPress=\{\(\) => \{\s*track\('auth_cancel_hint_taken'\);\s*onEmail\(\);/,
  );
  assert.ok(SIGN_IN.indexOf('Sign in with Apple\n') < SIGN_IN.indexOf('{CANCEL_HINT}'));
  assert.ok(SIGN_IN.indexOf('{CANCEL_HINT}') < SIGN_IN.indexOf('Continue with email\n'));
  // Both names are in the union.
  const posthog = readFileSync('src/lib/posthog.tsx', 'utf8');
  assert.match(posthog, /\| 'auth_cancel_hint_shown'/);
  assert.match(posthog, /\| 'auth_cancel_hint_taken'/);
});

test('a thrown sign-in failure never shows provider text to the user', () => {
  const { describeThrownSignInError } = require('../src/features/auth/sign-in-errors');
  // The two honest classifications keep their sentences…
  assert.match(describeThrownSignInError(new Error('SecureStore unavailable')), /keychain/);
  assert.match(describeThrownSignInError(new Error('Network request failed')), /connection/);
  // …and everything else collapses to the app's own voice, never the throw's.
  const weird = describeThrownSignInError(new Error('duplicate key value violates unique constraint "users_email_key" for user@example.com'));
  assert.doesNotMatch(weird, /user@example|duplicate key|constraint/);
  assert.match(weird, /Nothing was sent/);
});
