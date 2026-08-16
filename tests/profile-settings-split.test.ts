/**
 * UX-05 — the Profile/Settings split cannot lose a capability.
 *
 * Splitting one screen into two is a move, not a deletion, and "nothing
 * disappeared" is not a claim anybody can eyeball across two files. The
 * reconciliation is `CAPABILITY_HOMES` in `features/profile/settings-copy.ts`;
 * this checks it in BOTH directions, which is the direction that actually
 * catches mistakes: a row present in its new home but also left behind in the
 * old one is a duplicate control writing the same state from two places.
 *
 * Source-text assertions rather than a render, matching the way this repo
 * already pins route contracts (`camera-availability`, `catalogue-voice`,
 * `friends-row-data`). There is no renderer in the test runner, and a rendered
 * check of a screen with eleven live queries behind it would be testing the
 * mocks.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CAPABILITY_HOMES,
  DAILY_STYLING_FACT,
  RESTORE_OUTCOMES,
  SIGN_OUT_CONFIRM,
} from '../src/features/profile/settings-copy';

const PROFILE = readFileSync('src/app/profile.tsx', 'utf8');
const SETTINGS = readFileSync('src/app/settings.tsx', 'utf8');
const LAYOUT = readFileSync('src/app/_layout.tsx', 'utf8');
const RESTORE_HOOK = readFileSync('src/features/profile/use-restore-purchases.ts', 'utf8');

const SOURCE = { profile: PROFILE, settings: SETTINGS };

test('every capability the single Profile screen carried has a home', () => {
  for (const capability of CAPABILITY_HOMES) {
    assert.ok(
      SOURCE[capability.home].includes(capability.evidence),
      `${capability.id} (${capability.note}) is missing from ${capability.home}.tsx — looked for ${capability.evidence}`,
    );
  }
});

test('no capability is left behind in the surface it moved off', () => {
  for (const capability of CAPABILITY_HOMES) {
    const other = capability.home === 'profile' ? 'settings' : 'profile';
    assert.ok(
      !SOURCE[other].includes(capability.evidence),
      `${capability.id} (${capability.note}) also appears in ${other}.tsx — two controls over one piece of state`,
    );
  }
});

test('the reconciliation covers the whole of the old screen', () => {
  // A guard on the guard. Relaxing the check by deleting a row from the table
  // is exactly as bad as deleting the capability, and silent in the same way.
  assert.equal(CAPABILITY_HOMES.length, 22);
  const ids = CAPABILITY_HOMES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate capability id');
  assert.equal(CAPABILITY_HOMES.filter((c) => c.home === 'profile').length, 7);
});

test('Settings is a pushed route, not a tab and not a route group', () => {
  // The accepted plan is explicit: no fifth tab, no new group. A pushed
  // `settings.tsx` at the root of src/app is the whole of the routing change.
  assert.match(LAYOUT, /name="settings"/);
  assert.match(LAYOUT, /name="settings"[\s\S]{0,220}presentation: 'formSheet'/);
  const tabs = readFileSync('src/app/(tabs)/_layout.tsx', 'utf8');
  assert.ok(!tabs.includes('settings'), 'Settings must not become a tab');
});

test('Profile reaches Settings through a labelled control', () => {
  // A bare glyph is unreachable by VoiceOver and unnameable by anyone
  // describing the app to somebody else.
  assert.match(PROFILE, /accessibilityLabel=\{SETTINGS_TITLE\}/);
  assert.match(PROFILE, /gearshape/);
  assert.match(PROFILE, /router\.push\('\/settings'/);
});

test('the nonfunctional Daily outfit styling switch is gone', () => {
  // The fake control: `<Switch value disabled onValueChange={() => {}}>`. It
  // must not exist on either surface — and neither must a Switch import into
  // Profile, which now has no toggles at all.
  assert.ok(!PROFILE.includes('Switch'), 'Profile should carry no switch');
  assert.ok(!SETTINGS.includes('disabled\n'), 'no disabled control stands in for a fact');
  assert.ok(!SETTINGS.includes('onValueChange={() => {}}'), 'no dead toggle handler');

  // The true thing the switch was standing in for survives as prose, and says
  // plainly that there is nothing to operate.
  assert.ok(SETTINGS.includes('DAILY_STYLING_FACT'));
  assert.match(DAILY_STYLING_FACT, /nothing to switch off/);
  // The real toggle beside it is untouched and still writes.
  assert.match(SETTINGS, /onValueChange=\{\(value\) => setShowWhereToBuy\.mutate\(value\)\}/);
});

test('UX-08 — the only blocking Alert left on these surfaces is none', () => {
  // Sign out asks in a sheet (recoverable), restore reports into a toast or a
  // notice band (success / recoverable). Delete account keeps its typed-DELETE
  // card, which was never an Alert and is the one genuinely irreversible act.
  assert.ok(!SETTINGS.includes('Alert.alert'), 'Settings must not open a blocking alert');
  assert.ok(!PROFILE.includes('Alert.alert'), 'Profile must not open a blocking alert');
  assert.ok(SETTINGS.includes('ConfirmSheet'), 'sign out asks in a sheet');
  assert.ok(SETTINGS.includes('DeleteAccountCard'), 'deletion keeps its typed confirmation');
});

test('the sign-out question keeps its option named for what is kept', () => {
  assert.equal(SIGN_OUT_CONFIRM.keepLabel, 'Stay signed in');
  assert.notEqual(SIGN_OUT_CONFIRM.keepLabel, 'Cancel');
  // The promise that makes it non-blocking in the first place.
  assert.match(SIGN_OUT_CONFIRM.body, /sign back in anytime/);
});

test('restore keeps all three of its endings, and each keeps its recovery', () => {
  assert.equal(RESTORE_OUTCOMES.restored.kind, 'toast');
  assert.equal(RESTORE_OUTCOMES.none.kind, 'notice');
  assert.equal(RESTORE_OUTCOMES.failed.kind, 'notice');
  // A recoverable error that hides the way out is the failure mode UX-08 names
  // by itself; both notices carry a retry.
  assert.ok(RESTORE_OUTCOMES.none.action.length > 0);
  assert.ok(RESTORE_OUTCOMES.failed.action.length > 0);
  // The failure copy still promises what it always promised about the store.
  assert.match(RESTORE_OUTCOMES.failed.body, /Nothing has changed/);
  assert.ok(SETTINGS.includes('NoticeBand') && SETTINGS.includes('Toast'));
});

test('the membership page keeps the alerts it did not ask to lose', () => {
  // `/membership` is not this program's surface. The hook reports instead of
  // interrupting only when a caller opts in, so the page that passes nothing
  // behaves exactly as it shipped.
  assert.match(RESTORE_HOOK, /if \(onOutcome\) onOutcome\('restored'\)/);
  assert.ok(RESTORE_HOOK.includes('Alert.alert'), 'the un-opted-in path still alerts');
  const membership = readFileSync('src/app/membership.tsx', 'utf8');
  assert.match(membership, /useRestorePurchases\(\)/, 'membership opts out by passing nothing');
  assert.match(SETTINGS, /useRestorePurchases\(\{ onOutcome: setRestoreOutcome \}\)/);
});
