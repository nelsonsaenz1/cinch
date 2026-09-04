/**
 * The morning-edit ask — ledger A14, 2026-09-04.
 *
 * Six nights of `push_tokens = 0` on a binary that has carried the module and
 * the entitlement since build 43: nobody was asked. This holds the ask's
 * decision to its four gates, its event shapes to bounded values, and the
 * wiring to the one path the Settings switch already takes.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  PUSH_ASK_ANSWERED_KEY,
  PUSH_ASK_COPY,
  pushAskAnsweredProps,
  pushPermissionResultProps,
  pushTokenRegisteredProps,
  shouldOfferPushAsk,
  type PushAskInput,
} from '../src/features/push/ask-spec';

const SPEC = readFileSync('src/features/push/ask-spec.ts', 'utf8');
const HOOK = readFileSync('src/features/push/use-push-ask.ts', 'utf8');
const PERMISSION = readFileSync('src/features/push/permission.ts', 'utf8');
const TOKEN = readFileSync('src/features/push/token.ts', 'utf8');
const TODAY = readFileSync('src/app/(tabs)/index.tsx', 'utf8');
const CARD = readFileSync('src/components/today/push-ask-card.tsx', 'utf8');
const POSTHOG = readFileSync('src/lib/posthog.tsx', 'utf8');

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

const OPEN: PushAskInput = {
  available: true,
  permission: 'undetermined',
  closetUsable: true,
  answered: false,
};

test('the card draws only when every gate is open', () => {
  assert.equal(shouldOfferPushAsk(OPEN), true);
  // The binary has no module — the switch in Settings is hidden too.
  assert.equal(shouldOfferPushAsk({ ...OPEN, available: false }), false);
  // Nothing to ask: iOS already said yes, or will not ask again.
  assert.equal(shouldOfferPushAsk({ ...OPEN, permission: 'granted' }), false);
  assert.equal(shouldOfferPushAsk({ ...OPEN, permission: 'denied' }), false);
  assert.equal(shouldOfferPushAsk({ ...OPEN, permission: 'unsupported' }), false);
  // The morning edit has nothing to say to a closet that cannot be dressed.
  assert.equal(shouldOfferPushAsk({ ...OPEN, closetUsable: false }), false);
  // Once, ever.
  assert.equal(shouldOfferPushAsk({ ...OPEN, answered: true }), false);
});

test('an unresolved read is "not yet", never "yes"', () => {
  assert.equal(shouldOfferPushAsk({ ...OPEN, permission: undefined }), false);
  assert.equal(shouldOfferPushAsk({ ...OPEN, answered: undefined }), false);
});

// ---------------------------------------------------------------------------
// The shapes — bounded, and nothing of the person in them
// ---------------------------------------------------------------------------

test('every builder returns enums and booleans only', () => {
  assert.deepEqual(pushAskAnsweredProps('turn_on'), { action: 'turn_on' });
  assert.deepEqual(pushAskAnsweredProps('not_now'), { action: 'not_now' });
  assert.deepEqual(pushPermissionResultProps('granted', true), { result: 'granted', prompted: true });
  assert.deepEqual(pushPermissionResultProps('denied', false), { result: 'denied', prompted: false });
  assert.deepEqual(pushTokenRegisteredProps({ ok: true }), { ok: true });
  assert.deepEqual(pushTokenRegisteredProps({ ok: false, reason: 'mint' }), { ok: false, reason: 'mint' });
  assert.deepEqual(pushTokenRegisteredProps({ ok: false, reason: 'write' }), { ok: false, reason: 'write' });
});

test('the spec is pure and the key is per install', () => {
  // Imports only — the docblock is allowed to name the package it explains.
  const imports = SPEC.match(/^import .*$/gm) ?? [];
  for (const line of imports) assert.doesNotMatch(line, /@\/lib\/posthog|expo-notifications|supabase/, line);
  assert.equal(PUSH_ASK_ANSWERED_KEY, 'cinch.push.morning-ask.answered');
  // Taste bar of the Today card: no numeral in the headline, no urgency.
  assert.doesNotMatch(PUSH_ASK_COPY.kicker, /\d|!/);
  assert.doesNotMatch(PUSH_ASK_COPY.line(), /!/);
  assert.match(PUSH_ASK_COPY.line(), /7:30am/);
});

// ---------------------------------------------------------------------------
// The wiring
// ---------------------------------------------------------------------------

test('the four names are in the union', () => {
  for (const name of [
    'push_ask_shown',
    'push_ask_answered',
    'push_permission_result',
    'push_token_registered',
  ]) {
    assert.match(POSTHOG, new RegExp(`\\| '${name}'`), name);
  }
});

test('turning on takes the Settings switch\'s own path and writes the row the sender reads', () => {
  // The same ask the Notifications screen makes — one place raises the prompt.
  assert.match(HOOK, /await askPushPermission\(\)/);
  assert.match(HOOK, /qc\.setQueryData\(pushPermissionKey, result\)/);
  // The claim function joins `notification_prefs`; absence is invisible to it.
  // Whole set, composed from the SERVER at the moment of writing — never a
  // render's closure, which can be `undefined` and become a row of defaults.
  assert.match(HOOK, /qc\.fetchQuery\(\{\s*queryKey: notificationPrefsKey,\s*queryFn: readNotificationPrefs,/);
  assert.match(HOOK, /await save\.mutateAsync\(\{ \.\.\.current, morning_edit: true \}\)/);
  assert.doesNotMatch(HOOK, /prefs\.data|useNotificationPrefs|DEFAULT_NOTIFICATION_PREFS/);
  // A grant whose write failed is owed: recorded, retried on the next mount.
  assert.match(HOOK, /AsyncStorage\.setItem\(PUSH_ASK_PENDING_WRITE_KEY, '1'\)/);
  assert.match(HOOK, /AsyncStorage\.getItem\(PUSH_ASK_PENDING_WRITE_KEY\)/);
  assert.match(HOOK, /AsyncStorage\.removeItem\(PUSH_ASK_PENDING_WRITE_KEY\)/);
  // Either answer settles the card; settle hides first and persists after.
  assert.match(HOOK, /setAnswered\(true\);\s*void AsyncStorage\.setItem\(PUSH_ASK_ANSWERED_KEY, '1'\)/);
  assert.match(HOOK, /finally \{\s*inFlight\.current = false;\s*setBusy\(false\);\s*settle\(\);/);
  // A second press before the re-render commits is refused by the ref.
  assert.match(HOOK, /if \(inFlight\.current\) return;\s*inFlight\.current = true;/);
  // The hook does not report the impression — it cannot see Today's gates.
  assert.doesNotMatch(HOOK, /push_ask_shown/);
});

test('the system\'s answer and the token write are reported from the shared paths', () => {
  // permission.ts: three outcomes, three reports, and the prompted flag is honest.
  assert.match(PERMISSION, /pushPermissionResultProps\('granted', false\)/);
  assert.match(PERMISSION, /pushPermissionResultProps\('denied', false\)/);
  assert.match(PERMISSION, /pushPermissionResultProps\(result === 'granted' \? 'granted' : 'denied', true\)/);
  // token.ts: every terminal path past "there is a session" reports.
  assert.match(TOKEN, /pushTokenRegisteredProps\(\{ ok: false, reason: 'mint' \}\)/);
  assert.match(TOKEN, /pushTokenRegisteredProps\(\{ ok: false, reason: 'write' \}\)/);
  assert.match(TOKEN, /pushTokenRegisteredProps\(\{ ok: true \}\)/);
  // Never the token.
  const calls = TOKEN.match(/track\('push_token_registered'[^)]*\)\)/g) ?? [];
  assert.equal(calls.length, 3);
  // The properties only — the event name itself says "token".
  for (const call of calls) assert.doesNotMatch(call.slice(call.indexOf(',')), /token/);
});

test('Today draws the card behind the closet gate and the refusal gate, and the card reports its own mount', () => {
  assert.match(TODAY, /usePushAsk\(!wardrobe\.isLoading && !wardrobe\.isError && canGenerate\(items\)\)/);
  assert.match(TODAY, /\{!nothingWorks && pushAsk\.show \? \(\s*<PushAskCard/);
  assert.match(TODAY, /visited=\{visited\}/);
  assert.match(TODAY, /onTurnOn=\{\(\) => void pushAsk\.turnOn\(\)\}/);
  assert.match(TODAY, /onNotNow=\{pushAsk\.notNow\}/);
  // The impression: once per person, and only on a focused tab — NativeTabs
  // mounts every tab at launch, so an unfocused mount was not seen.
  assert.match(CARD, /if \(visited\) trackOnce\('push_ask_shown'\)/);
  assert.doesNotMatch(CARD, /\btrack\(/);
  // The one import path rule from native.ts — nothing outside it names the package.
  for (const source of [HOOK, SPEC, TODAY, CARD]) assert.doesNotMatch(source, /'expo-notifications'/);
});
