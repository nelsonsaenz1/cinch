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
  PUSH_ASK_SEEN_DEPTH,
  PUSH_ASK_TAB_BAR_OCCLUSION,
  pushAskAnsweredProps,
  pushAskSeen,
  pushAskShownProps,
  pushPermissionResultProps,
  pushTokenRegisteredProps,
  shouldOfferPushAsk,
  type PushAskInput,
} from '../src/features/push/ask-spec';
import { TODAY_ACTIVATION_FLOOR } from '../src/features/today/today-spec';

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
  closet: 'usable',
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
  // Once, ever.
  assert.equal(shouldOfferPushAsk({ ...OPEN, answered: true }), false);
});

test('A44 — the activation floor is not a gate, only an unread closet is', () => {
  // Three real people on the push build, zero garments each, zero asks:
  // the floor used to be the gate. Now the floor draws the card too …
  assert.equal(shouldOfferPushAsk({ ...OPEN, closet: 'floor' }), true);
  // … and only a closet the screen has not read yet holds it back, because
  // the sentence depends on the verdict and must never be the wrong one.
  assert.equal(shouldOfferPushAsk({ ...OPEN, closet: 'unread' }), false);
});

test('an unresolved read is "not yet", never "yes"', () => {
  assert.equal(shouldOfferPushAsk({ ...OPEN, permission: undefined }), false);
  assert.equal(shouldOfferPushAsk({ ...OPEN, answered: undefined }), false);
});

test('two closets, two sentences — and the floor one is conditional', () => {
  const floor = PUSH_ASK_COPY.line('floor');
  const usable = PUSH_ASK_COPY.line('usable');
  assert.notEqual(floor, usable);
  // The floor promise names the condition in the word every other floor
  // sentence on Today uses, spelled, never a numeral.
  assert.match(floor, /^Once your ten are in, /);
  // The hour is the only numeral either sentence carries.
  assert.doesNotMatch(floor.replace('7:30am', ''), /\d/);
  assert.doesNotMatch(usable, /Once your ten/);
  // Both keep the channel's own promise: one note, at the hour.
  for (const line of [floor, usable]) {
    assert.match(line, /One note at 7:30am, nothing else\.$/);
    assert.doesNotMatch(line, /!/);
  }
  assert.deepEqual(pushAskShownProps('floor'), { closet: 'floor' });
  assert.deepEqual(pushAskShownProps('usable'), { closet: 'usable' });
});

test('the sender keeps the floor sentence: the claim counts to the same ten', () => {
  // The card says "once your ten are in"; the note says "the day's look is
  // ready" and opens Today. The claim function is what makes the first true
  // of the second — nobody under the floor is claimed.
  const migration = readFileSync(
    'supabase/migrations/20260905000000_morning_edit_needs_a_closet.sql',
    'utf8',
  );
  const guard = migration.match(
    /\(select count\(\*\) from public\.items i where i\.user_id = n\.user_id\) >= (\d+)/,
  );
  assert.ok(guard, 'the claim has lost its closet guard');
  assert.equal(Number(guard[1]), TODAY_ACTIVATION_FLOOR);
  assert.equal(TODAY_ACTIVATION_FLOOR, 10);
  // The guard sits inside the `due` CTE, before the claim is written.
  assert.ok(migration.indexOf('>= 10') < migration.indexOf('insert into public.push_sends'));
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
  assert.doesNotMatch(PUSH_ASK_COPY.line('usable'), /!/);
  assert.match(PUSH_ASK_COPY.line('usable'), /7:30am/);
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

test('Today draws the card on both sides of the floor, and the card reports its own mount', () => {
  // The verdict is the PRODUCT's floor — the same `belowActivationFloor`
  // that picks the floor branch — never the engine's eight on its own.
  assert.match(
    TODAY,
    /const pushAskCloset: PushAskCloset =\s*wardrobe\.isLoading \|\| wardrobe\.isError\s*\? 'unread'\s*: belowActivationFloor\(items\.length, canGenerate\(items\)\)\s*\? 'floor'\s*: 'usable';/,
  );
  assert.match(TODAY, /usePushAsk\(pushAskCloset\)/);
  // The plate's card, behind the refusal gate, with the plain sentence.
  assert.match(TODAY, /\{!nothingWorks && pushAsk\.show \? \(\s*<PushAskCard\s*closet="usable"/);
  // The floor's card (A44): inside the floor branch, UNDER the doors — after
  // `ClosetFloor`, before the consent sheet — hidden on the pending-consent
  // floor, with the conditional sentence.
  const floorBranch = TODAY.slice(
    TODAY.indexOf('if (belowActivationFloor(items.length, canGenerate(items))) {'),
    TODAY.indexOf('// T-09 · OFFLINE'),
  );
  assert.match(floorBranch, /\{!pendingConsentFloor && pushAsk\.show \? \(\s*<PushAskCard\s*closet="floor"/);
  assert.ok(floorBranch.indexOf('<ClosetFloor') < floorBranch.indexOf('<PushAskCard'));
  assert.ok(floorBranch.indexOf('<PushAskCard') < floorBranch.indexOf('<ConsentSheet'));
  assert.equal((TODAY.match(/<PushAskCard/g) ?? []).length, 2);
  assert.match(TODAY, /visited=\{visited\}/);
  assert.match(TODAY, /onTurnOn=\{\(\) => void pushAsk\.turnOn\(\)\}/);
  assert.match(TODAY, /onNotNow=\{pushAsk\.notNow\}/);
  // The impression: once per person, and only on a focused tab — NativeTabs
  // mounts every tab at launch, so an unfocused mount was not seen. It
  // carries which sentence was on screen, so the floor audience is a number.
  assert.match(CARD, /if \(visited\) trackOnce\('push_ask_shown', pushAskShownProps\(closet\)\)/);
  assert.match(CARD, /\{PUSH_ASK_COPY\.line\(closet\)\}/);
  assert.doesNotMatch(CARD, /\btrack\(/);
  // The one import path rule from native.ts — nothing outside it names the package.
  for (const source of [HOOK, SPEC, TODAY, CARD]) assert.doesNotMatch(source, /'expo-notifications'/);
});

// ---------------------------------------------------------------------------
// Seen, not mounted — ledger A48, 2026-09-06
// ---------------------------------------------------------------------------

test('"seen" is the card’s top 40pt inside the viewport above the tab bar — and a worklet', () => {
  assert.equal(PUSH_ASK_SEEN_DEPTH, 40);
  assert.equal(PUSH_ASK_TAB_BAR_OCCLUSION, 96);
  // A 800pt viewport: the usable bottom is 704. A card at y=600 is seen
  // (600 + 40 ≤ 704); one at y=680 is only a strip under the tab bar.
  assert.equal(pushAskSeen({ cardTop: 600, viewportHeight: 800, scrollOffset: 0 }), true);
  assert.equal(pushAskSeen({ cardTop: 680, viewportHeight: 800, scrollOffset: 0 }), false);
  assert.equal(pushAskSeen({ cardTop: 680, viewportHeight: 800, scrollOffset: 16 }), true);
  // A long floor page: the card at 1400 needs the reader to scroll.
  assert.equal(pushAskSeen({ cardTop: 1400, viewportHeight: 800, scrollOffset: 0 }), false);
  assert.equal(pushAskSeen({ cardTop: 1400, viewportHeight: 800, scrollOffset: 736 }), true);
  // Unmeasured is never seen.
  assert.equal(pushAskSeen({ cardTop: -1, viewportHeight: 800, scrollOffset: 0 }), false);
  assert.equal(pushAskSeen({ cardTop: 100, viewportHeight: -1, scrollOffset: 0 }), false);
  assert.match(SPEC, /export function pushAskSeen\([\s\S]{0,200}\{\s*'worklet';/);
});

test('the card hands up its y; Today measures from every layout, the floor’s scroll and the happy path’s worklet', () => {
  assert.match(POSTHOG, /\| 'push_ask_seen'/);
  assert.match(CARD, /onLayout\?: \(y: number\) => void;/);
  assert.match(CARD, /onLayout=\{onLayout \? \(e: LayoutChangeEvent\) => onLayout\(e\.nativeEvent\.layout\.y\) : undefined\}/);
  // Both cards report their layout.
  assert.equal((TODAY.match(/onLayout=\{onPushAskLayout\}/g) ?? []).length, 2);
  // Both ScrollViews report their viewport.
  assert.equal((TODAY.match(/onLayout=\{onScrollViewportLayout\}/g) ?? []).length, 1);
  assert.match(TODAY, /const floorSeenProps = \{\s*onLayout: onScrollViewportLayout,\s*scrollEventThrottle: 100,\s*onScroll: onFloorScroll,\s*\};/);
  assert.match(TODAY, /const onScrollViewportLayout = \(e: LayoutChangeEvent\) => \{\s*pushAskViewport\.value = e\.nativeEvent\.layout\.height;\s*maybePushAskSeen\(floorScrollOffset\.current\);/);
  assert.match(TODAY, /<ScrollView[\s\S]{0,400}\{\.\.\.floorSeenProps\}>/);
  // The floor's plain scroll checks from JS; the happy path checks on the UI
  // thread and hops to JS exactly once.
  assert.match(TODAY, /floorScrollOffset\.current = e\.nativeEvent\.contentOffset\.y;\s*maybePushAskSeen\(floorScrollOffset\.current\);/);
  assert.match(
    TODAY,
    /const onHappyPathScroll = useAnimatedScrollHandler\(\(e\) => \{\s*scrollY\.value = e\.contentOffset\.y;[\s\S]{0,600}pushAskSeenReported\.value = true;\s*runOnJS\(reportPushAskSeen\)\(\);/,
  );
  // One report, once per person, carrying the sentence that was on screen.
  assert.match(TODAY, /trackOnce\('push_ask_seen', \{ closet \}\)/);
  assert.equal((TODAY.match(/push_ask_seen/g) ?? []).length, 1);
  // The rule is the spec's, on both threads — never a second copy of the maths.
  assert.equal((TODAY.match(/pushAskSeen\(\{/g) ?? []).length, 2);
  assert.doesNotMatch(TODAY, /\+ 40\b|- 96\b/);
});
