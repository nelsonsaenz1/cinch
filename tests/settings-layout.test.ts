/**
 * Redesign 29 — the Settings page's own inventory and its derived strings.
 *
 * `profile-settings-split.test.ts` proves no capability crossed between Profile
 * and Settings. This proves the other half, which that test cannot see: that
 * the REDESIGN of Settings kept every row the shipped page carried, that the
 * conditional rows are absent rather than disabled, and that the strings the
 * new page derives rather than types are derived correctly.
 *
 * Source-text assertions plus pure functions, matching the way this repo
 * already pins route contracts. There is no renderer in the test runner, and a
 * rendered check of a screen with nine live queries behind it would be testing
 * the mocks.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { membershipRowFor } from '../src/features/billing/membership-row';
import {
  DIAGNOSTICS_ROW_LABEL,
  PRIVACY_POLICY_DETAIL,
  SETTINGS_KICKERS,
  diagnosticsSummary,
  restoreRowDetail,
  switchStateWord,
  versionMark,
  whereToBuyDetail,
} from '../src/features/settings/settings-spec';

const ROUTE = readFileSync('src/app/settings.tsx', 'utf8');
const BODY = readFileSync('src/components/settings/settings-body.tsx', 'utf8');
const PARTS = readFileSync('src/components/settings/settings-parts.tsx', 'utf8');
const SURFACE = [ROUTE, BODY, PARTS].join('\n');

// ---------------------------------------------------------------------------
// The inventory
// ---------------------------------------------------------------------------

/**
 * Every row the artifact's own handoff enumerates, and the evidence that it is
 * still drawn. "Nothing was dropped and nothing was invented" is the sentence
 * the design signs off on; this is it, checkable.
 */
const ROWS: readonly (readonly [string, string])[] = [
  ['membership', 'MembershipPlate'],
  ['daily outfit styling', 'DAILY_STYLING_LABEL'],
  ['show where to buy', 'SHOW_WHERE_TO_BUY_LABEL'],
  ['privacy & data', 'label="Privacy & data"'],
  ['invite a friend', 'InviteRow'],
  ['friends', 'label="Friends"'],
  ['borrow requests', 'label="Borrow requests"'],
  ['blocked people', 'label="Blocked people"'],
  ['notifications', 'label="Notifications"'],
  ['restore purchases', 'label="Restore purchases"'],
  ['help', 'label="Help"'],
  ['privacy policy', 'label="Privacy Policy"'],
  ['sign out', 'label="Sign out"'],
  ['delete account', 'label="Delete account"'],
  ['update diagnostics', 'DIAGNOSTICS_ROW_LABEL'],
  ['version mark', 'versionMark'],
];

test('every row the shipped page carried is still drawn', () => {
  for (const [row, evidence] of ROWS) {
    assert.ok(SURFACE.includes(evidence), `the "${row}" row is gone — looked for ${evidence}`);
  }
  // A guard on the guard: relaxing this by deleting a line is exactly as bad
  // as deleting the row, and silent in the same way.
  assert.equal(ROWS.length, 16);
});

test('the destination of every row is still the route it shipped with', () => {
  for (const path of [
    "'/membership' as Href",
    "router.push('/privacy')",
    "router.push('/invite')",
    "router.push('/friends')",
    "router.push('/borrow')",
    "router.push('/friends/blocked')",
    "router.push('/notifications')",
    "router.push('/help')",
  ]) {
    assert.ok(ROUTE.includes(path), `a row lost its destination — looked for ${path}`);
  }
  // The policy is the one door that leaves, and it still leaves for the URL
  // App Store Connect carries.
  assert.match(ROUTE, /const PRIVACY_URL = 'https:\/\/cinchstyle\.com\/privacy'/);
  assert.match(ROUTE, /Linking\.openURL\(PRIVACY_URL\)/);
});

test('a capability that cannot work is absent, never disabled', () => {
  // Three conditionals, and all three are the same refusal: a row whose
  // destination cannot work is a dead end wearing a chevron, and an absent row
  // requests nothing. Notifications in particular is what lets this bundle ship
  // over the air onto a binary with no push module.
  assert.match(BODY, /props\.notificationsAvailable \? \(/);
  assert.match(BODY, /props\.restoreAvailable \? \(/);
  assert.match(BODY, /props\.inviteLink \? \(/);
  assert.match(ROUTE, /notificationsAvailable=\{NOTIFICATION_SETTINGS_AVAILABLE\}/);
  // And none of them is expressed as a dimmed control instead.
  assert.ok(!BODY.includes('disabled={!props.'), 'a missing capability must not be drawn disabled');
});

test('an unknown count is omitted, never printed as zero', () => {
  // The row that must never say somebody's blocks are gone. `null` reaches the
  // row only when the list genuinely has not answered.
  assert.match(BODY, /props\.blockedCount === null \? undefined : String\(props\.blockedCount\)/);
  assert.match(ROUTE, /blockedUsers\.data\?\.length \?\? null/);
  // Borrow is the same rule with a different shape: a count is derived only
  // from data that arrived, so a failed read omits rather than reporting 0.
  assert.match(ROUTE, /const pendingAsks = borrow\.data\s*\n?\s*\? borrow\.data/);
});

test('delete account is the only accent row, and sign out sits above it in ink', () => {
  const accents = BODY.match(/tone="accent"/g) ?? [];
  assert.equal(accents.length, 1, 'exactly one critical-coloured row on the page');
  assert.ok(BODY.indexOf('label="Sign out"') < BODY.indexOf('label="Delete account"'));
  assert.ok(
    !BODY.includes('label="Sign out"\n              tone='),
    'signing out is reversible and must never be dressed as deletion',
  );
});

// ---------------------------------------------------------------------------
// Membership — the derivation this redesign is forbidden from touching
// ---------------------------------------------------------------------------

test('the plan door still derives from membership-row, byte for byte', () => {
  // The redesign changes the PLATE. If it ever changed the reading, this is
  // where a member on a slow network starts being told they are not one.
  const reading = membershipRowFor({
    plan: 'standard', paid: false,
    trialing: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
    loading: true,
    unconfirmed: false,
  });
  assert.equal(reading.value, 'Checking…');
  assert.equal(reading.chevron, false);

  const failed = membershipRowFor({
    plan: 'free', paid: false,
    trialing: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
    loading: false,
    unconfirmed: true,
  });
  // The refusal that matters most: a read that failed is never drawn as free.
  assert.equal(failed.visible, true);
  assert.equal(failed.retry, true);
  assert.equal(failed.chevron, false);

  const free = membershipRowFor({
    plan: 'free', paid: false,
    trialing: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
    loading: false,
    unconfirmed: false,
  });
  // CHANGED 2026-09-02, and this line is the founder's finding #21 in one
  // assertion. It read `free.visible === false` — "free is the absence of a
  // plate, never an upsell" — which was right while `/membership` met a free
  // account with "There is no membership on this account to manage". It does
  // not any more; it draws what the account holds, what each tier adds, and
  // one door. Hiding the row left that page reachable only from `/friends` and
  // a deep link, so a free account looking for its plan in Settings found
  // nothing at all.
  //
  // The RULE the old assertion carried — that the row never becomes an upsell
  // — is unchanged, and the sweep at the end of this test still holds it: the
  // row names the tier and its active ceiling, and carries no price, no
  // renewal intent and no upgrade word.
  assert.equal(free.visible, true);
  assert.equal(free.chevron, true);
  assert.match(free.label, /^Cinch /);

  const paid = membershipRowFor({
    plan: 'standard', paid: true,
    trialing: false,
    trialEndsAt: null,
    currentPeriodEnd: new Date('2026-09-14T00:00:00Z'),
    loading: false,
    unconfirmed: false,
  });
  assert.equal(paid.chevron, true);
  assert.match(paid.label, /^Cinch /);
  // No price, no renewal intent, no upgrade word — in any of the five.
  for (const row of [reading, failed, free, paid]) {
    assert.doesNotMatch(`${row.label} ${row.value}`, /\$|price|renew|upgrade/i);
  }
});

test('the plate draws the derivation and re-decides none of it', () => {
  assert.ok(PARTS.includes('row.chevron'), 'the chevron is the helper’s answer');
  assert.ok(PARTS.includes('row.retry'), 'so is the retry');
  // `visible` is the caller's gate, and it must be a gate rather than a style.
  assert.match(BODY, /props\.membership\.visible \? \(/);
  assert.ok(!PARTS.includes("=== 'free'"), 'no second plan state machine on the page');
});

// ---------------------------------------------------------------------------
// The one real control
// ---------------------------------------------------------------------------

test('the switch prints its state as a word, so it never rests on colour', () => {
  assert.equal(switchStateWord(true), 'ON');
  assert.equal(switchStateWord(false), 'OFF');
});

test('the detail line reports the state, and reports a write as a wait', () => {
  assert.match(whereToBuyDetail({ on: true, writing: false }), /Merchant suggestions/);
  assert.match(whereToBuyDetail({ on: false, writing: false }), /Gaps stay silent/);
  // Mid-write it asserts NEITHER state — the server has not agreed yet.
  assert.equal(whereToBuyDetail({ on: true, writing: true }), 'Saving…');
  assert.equal(whereToBuyDetail({ on: false, writing: true }), 'Saving…');
});

test('a write in flight locks the control and a failure says nothing changed', () => {
  assert.match(PARTS, /disabled=\{writing\}/);
  assert.match(ROUTE, /whereToBuyWriting=\{setShowWhereToBuy\.isPending\}/);
  assert.match(ROUTE, /whereToBuyFailed=\{setShowWhereToBuy\.isError\}/);
  assert.match(BODY, /WHERE_TO_BUY_FAILED\.body/);
});

test('the governed commerce disclosure is still said in full', () => {
  // Shortening the visible line is a design decision. Dropping the sentence
  // commerce-directive.md governs is not, so it goes to VoiceOver intact.
  assert.match(BODY, /hint=\{whereToBuyHint\(SHOW_WHERE_TO_BUY_DETAIL\)\}/);
  assert.match(PARTS, /accessibilityHint=\{hint\}/);
});

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

test('restore explains itself without promising a purchase exists', () => {
  const resting = restoreRowDetail(false);
  assert.match(resting, /another device/);
  assert.doesNotMatch(resting, /your (membership|subscription)/i);
  // In flight it names who is being asked, so the wait reads as the store's.
  assert.match(restoreRowDetail(true), /App Store/);
});

test('a row that acts in place wears no chevron', () => {
  // `chevron.right` means "further in" and `arrow.up.right` means "out of the
  // app". Restore says neither; it acts here and reports here.
  assert.match(BODY, /affordance="none"/);
});

test('the external policy names where it goes before the tap', () => {
  assert.equal(PRIVACY_POLICY_DETAIL, 'cinchstyle.com');
  assert.match(BODY, /detail=\{PRIVACY_POLICY_DETAIL\}\s*\n\s*external/);
});

// ---------------------------------------------------------------------------
// Diagnostics — the summary that must not become a deletion
// ---------------------------------------------------------------------------

const FACTS = [
  { label: 'Build', value: '412' },
  { label: 'Update channel', value: 'production' },
  { label: 'Runtime', value: '1.8.0' },
  { label: 'Running update', value: '4c1f2ab' },
  { label: 'Updates', value: 'Enabled' },
];

test('the collapsed row summarises three facts, in the frame’s words', () => {
  assert.equal(diagnosticsSummary(FACTS), 'Channel production · runtime 1.8.0 · update 4c1f2ab');
});

test('an embedded launch is written as prose, not as a broken template', () => {
  const embedded = FACTS.map((f) =>
    f.label === 'Running update' ? { ...f, value: 'Embedded in build' } : f,
  );
  assert.equal(diagnosticsSummary(embedded), 'Channel production · runtime 1.8.0 · embedded update');
});

test('a fact the reader did not answer is dropped, never printed as unknown', () => {
  assert.equal(diagnosticsSummary([{ label: 'Runtime', value: '1.8.0' }]), 'runtime 1.8.0');
  assert.equal(diagnosticsSummary([]), '');
});

test('the summary is a summary — every fact stays reachable underneath', () => {
  // The frame draws one row where five shipped. Collapsing five facts into a
  // three-fact line and stopping there would drop Build and Updates-enabled,
  // which is the quiet capability loss this whole page is forbidden to cause.
  // So the row discloses in place and draws all of them.
  assert.match(PARTS, /facts\.map\(\(fact\) => \(/);
  assert.match(PARTS, /accessibilityState=\{\{ expanded \}\}/);
  assert.match(ROUTE, /diagnostics=\{updateFacts\}/);
  assert.equal(DIAGNOSTICS_ROW_LABEL, 'Update diagnostics');
});

// ---------------------------------------------------------------------------
// The edition mark
// ---------------------------------------------------------------------------

test('the version mark drops the build rather than padding it', () => {
  assert.equal(versionMark('1.8.0', '412'), 'Cinch 1.8.0 (412)');
  assert.equal(versionMark('1.8.0', null), 'Cinch 1.8.0');
  assert.equal(versionMark(null, '412'), null, 'no version is no mark, not "Cinch undefined"');
});

// ---------------------------------------------------------------------------
// The grouping the brief asked for
// ---------------------------------------------------------------------------

test('the page is grouped, and every group is named', () => {
  for (const kicker of Object.values(SETTINGS_KICKERS)) {
    assert.ok(
      BODY.includes(`SETTINGS_KICKERS.${kicker.toLowerCase()}`),
      `the ${kicker} group lost its head`,
    );
  }
  assert.equal(Object.keys(SETTINGS_KICKERS).length, 5);
  // Membership deliberately has none: it is a plate about this account, not a
  // group of controls a reader would go looking under a heading for.
  assert.ok(BODY.indexOf('MembershipPlate') < BODY.indexOf('SETTINGS_KICKERS.styling'));
});

test('every control on the page clears the tap floor', () => {
  // The parts draw their own containers, so the floor has to be stated in each
  // rather than inherited from `SettingsRow`.
  const floors = PARTS.match(/minHeight: MIN_TAP_TARGET/g) ?? [];
  assert.ok(floors.length >= 5, `only ${floors.length} explicit tap floors in the parts`);
  assert.ok(!PARTS.includes('minHeight: 40'), 'no control below the floor');
});

test('the page carries no weight, and no colour-only state', () => {
  // TY-01/TY-02: one sans cut. The frames set two labels in Helvetica Bold and
  // the app answers that with a size step instead — `variant="heading"`.
  for (const source of [BODY, PARTS]) {
    assert.ok(!/fontWeight/.test(source), 'no weight on a Settings surface');
  }
  assert.match(PARTS, /variant="heading"/);
});
