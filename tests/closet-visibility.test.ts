/**
 * The four flags that shipped without a control.
 *
 * `20260808110000_friend_closet_privacy_layer.sql` added `closet_hidden`,
 * `stat_pieces_hidden`, `stat_wears_hidden` and `stat_cost_per_wear_hidden`,
 * wired them into `friend_items` and `friend_closet_meta`, and said at :18 that
 * the toggle UI would land "in a later Profile session". It did not, so the
 * read path spent two weeks honouring flags no user could reach.
 *
 * The risk in the control is not the write — it is the INVERSION. The columns
 * are `*_hidden`; the switches read "friends can see this". Get that backwards
 * once and the app hides a closet somebody meant to show, or shows one they
 * meant to hide, and neither failure announces itself. The inversion lives in
 * `visibility-flags.ts`, which has no React Native in it precisely so these can
 * exercise the real functions rather than describe them.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ALL_VISIBLE,
  friendSees,
  statsOverridden,
  VISIBILITY_COLUMNS,
  visibilityFromRow,
  visibilityPatch,
  type ClosetVisibility,
  type VisibilityFlag,
} from '../src/features/privacy/visibility-flags.ts';
import {
  VISIBILITY_INDEX_DETAIL,
  VISIBILITY_LABELS,
  VISIBILITY_LEAD,
  VISIBILITY_OVERRIDDEN_REASON,
  VISIBILITY_TITLE,
  visibilityState,
} from '../src/features/privacy/visibility-copy.ts';

const body = (path: string) =>
  readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const MIGRATION = readFileSync(
  'supabase/migrations/20260808110000_friend_closet_privacy_layer.sql',
  'utf8',
);

const FLAGS: VisibilityFlag[] = [
  'closetVisible',
  'piecesVisible',
  'wearsVisible',
  'costPerWearVisible',
];

// ---------------------------------------------------------------------------
// 1 · The four columns, and the fourth in particular
// ---------------------------------------------------------------------------

test('all four columns are covered, including cost per wear', () => {
  // The fourth is the one most easily dropped: "closet, pieces and wears" is
  // three, and the money one — what a piece cost its owner per wear — is the
  // fourth and the most sensitive.
  assert.deepEqual([...Object.keys(VISIBILITY_COLUMNS)].sort(), [...FLAGS].sort());
  assert.deepEqual([...Object.values(VISIBILITY_COLUMNS)].sort(), [
    'closet_hidden',
    'stat_cost_per_wear_hidden',
    'stat_pieces_hidden',
    'stat_wears_hidden',
  ]);
});

test('every column name is one the migration actually added', () => {
  for (const column of Object.values(VISIBILITY_COLUMNS)) {
    assert.match(
      MIGRATION,
      new RegExp(`add column ${column}\\s+boolean not null default false`),
      `${column} is not a column this migration added`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2 · The inversion, both directions, by execution
// ---------------------------------------------------------------------------

test('visible writes hidden=false, and hidden writes hidden=true', () => {
  for (const flag of FLAGS) {
    const column = VISIBILITY_COLUMNS[flag];
    assert.deepEqual(visibilityPatch(flag, true), { [column]: false }, `${flag} shown`);
    assert.deepEqual(visibilityPatch(flag, false), { [column]: true }, `${flag} hidden`);
  }
});

test('a stored hidden flag reads back as not visible', () => {
  assert.deepEqual(visibilityFromRow({ closet_hidden: true }), {
    ...ALL_VISIBLE,
    closetVisible: false,
  });
  assert.deepEqual(visibilityFromRow({ stat_cost_per_wear_hidden: true }), {
    ...ALL_VISIBLE,
    costPerWearVisible: false,
  });
});

test('the round trip is the identity', () => {
  // Write it, read it back, get the same switch position — for all sixteen
  // combinations, not just the two obvious ones.
  for (let mask = 0; mask < 16; mask += 1) {
    const wanted: ClosetVisibility = {
      closetVisible: Boolean(mask & 1),
      piecesVisible: Boolean(mask & 2),
      wearsVisible: Boolean(mask & 4),
      costPerWearVisible: Boolean(mask & 8),
    };
    const row = FLAGS.reduce<Record<string, boolean>>(
      (acc, flag) => ({ ...acc, ...visibilityPatch(flag, wanted[flag]) }),
      {},
    );
    assert.deepEqual(visibilityFromRow(row), wanted, `mask ${mask}`);
  }
});

test('an absent row, and an absent column, both read as today’s default', () => {
  // The failure this prevents: a new account appearing to have hidden a closet
  // it never touched, or a row written before these columns existed reading as
  // hidden. `?? false` on the HIDDEN side is what makes both come out visible.
  assert.deepEqual(visibilityFromRow(null), ALL_VISIBLE);
  assert.deepEqual(visibilityFromRow({}), ALL_VISIBLE);
  assert.deepEqual(visibilityFromRow({ closet_hidden: null }), ALL_VISIBLE);
});

// ---------------------------------------------------------------------------
// 3 · What a friend actually receives
// ---------------------------------------------------------------------------

test('hiding the closet hides all three stats with it', () => {
  const closetOff: ClosetVisibility = { ...ALL_VISIBLE, closetVisible: false };
  assert.deepEqual(friendSees(closetOff), {
    closet: false,
    pieces: false,
    wears: false,
    costPerWear: false,
  });
  // Even with every stat switch left on — which is the state somebody who
  // hides the closet and never touches the others is actually in.
  assert.equal(friendSees(closetOff).wears, false);
});

test('the SQL agrees: closet_hidden nulls each stat', () => {
  // `friendSees` mirrors the views. If they ever disagree the SQL wins, so the
  // mirror is checked against the SQL rather than assumed.
  assert.match(MIGRATION, /case when p\.closet_hidden or p\.stat_pieces_hidden/);
  assert.match(MIGRATION, /case when p\.closet_hidden or p\.stat_wears_hidden/);
  assert.match(MIGRATION, /case when p\.closet_hidden or p\.stat_cost_per_wear_hidden/);
  assert.match(MIGRATION, /not p\.closet_hidden/);
});

test('one hidden stat hides only itself', () => {
  assert.deepEqual(friendSees({ ...ALL_VISIBLE, costPerWearVisible: false }), {
    closet: true,
    pieces: true,
    wears: true,
    costPerWear: false,
  });
});

test('the default state shows everything to a friend, and nothing changes that here', () => {
  // The packet must not move a default. Today every flag is false — visible —
  // and this is the assertion that fails if someone "tightens" it silently.
  assert.deepEqual(friendSees(ALL_VISIBLE), {
    closet: true,
    pieces: true,
    wears: true,
    costPerWear: true,
  });
  assert.match(MIGRATION, /add column closet_hidden\s+boolean not null default false/);
});

// ---------------------------------------------------------------------------
// 4 · The control
// ---------------------------------------------------------------------------

test('the stat switches go inert exactly when the closet is hidden', () => {
  assert.equal(statsOverridden(ALL_VISIBLE), false);
  assert.equal(statsOverridden({ ...ALL_VISIBLE, closetVisible: false }), true);

  const page = body('src/components/privacy/closet-visibility-page.tsx');
  assert.match(page, /overridden=\{closetHidden\}/);
  assert.match(page, /overriddenReason=\{VISIBILITY_OVERRIDDEN_REASON\}/);
  assert.match(VISIBILITY_OVERRIDDEN_REASON, /closet is hidden/i);
});

test('the closet switch is not itself overridable', () => {
  // The gate cannot gate itself: if the closet row ever took `overridden`, a
  // hidden closet could never be shown again from this screen.
  const page = body('src/components/privacy/closet-visibility-page.tsx');
  const from = page.indexOf('VISIBILITY_LABELS.closetVisible');
  assert.ok(from > 0);
  assert.doesNotMatch(page.slice(from, from + page.slice(from).indexOf('/>')), /overridden/);
});

test('the switch writes with update, scoped to the owner, never upsert', () => {
  // An upsert would create a profile row as a side effect of hiding a stat,
  // giving the account a username-less profile it never asked for.
  const src = body('src/features/privacy/use-closet-visibility.ts');
  assert.match(src, /\.from\('profiles'\)/);
  assert.match(src, /\.update\(/);
  assert.match(src, /\.eq\('user_id', userId\)/);
  assert.doesNotMatch(src, /\.upsert\(/);
});

test('a failed write puts the switch back', () => {
  const src = body('src/features/privacy/use-closet-visibility.ts');
  assert.match(src, /onMutate:/);
  assert.match(src, /setQueryData\(CLOSET_VISIBILITY_KEY, context\.previous\)/);
});

test('flipping a flag invalidates every friend-facing projection of this account', () => {
  const src = body('src/features/privacy/use-closet-visibility.ts');
  for (const key of ['friend-closet', 'friend-closet-meta', 'social-profile']) {
    assert.match(src, new RegExp(`queryKey: \\['${key}'\\]`));
  }
});

// ---------------------------------------------------------------------------
// 5 · The words
// ---------------------------------------------------------------------------

test('every switch has a label and a state sentence in both positions', () => {
  for (const flag of FLAGS) {
    assert.ok(VISIBILITY_LABELS[flag].length > 0, `${flag} has no label`);
    for (const visible of [true, false]) {
      const state = visibilityState(flag, visible);
      assert.ok(state.length > 0, `${flag}/${visible} has no state line`);
      assert.match(state, /\.$/, 'a state line is a sentence');
    }
  }
});

test('on and off never say the same thing', () => {
  for (const flag of FLAGS) {
    assert.notEqual(visibilityState(flag, true), visibilityState(flag, false), flag);
  }
});

test('the copy never promises privacy from anyone but friends', () => {
  // These four govern one audience. The public boundary is
  // `profiles.visibility`, a different control with a different default, and
  // copy that blurred them would be a false promise.
  const all = [
    VISIBILITY_TITLE,
    VISIBILITY_LEAD,
    VISIBILITY_INDEX_DETAIL,
    ...FLAGS.flatMap((f) => [visibilityState(f, true), visibilityState(f, false)]),
  ].join(' ');
  assert.doesNotMatch(all, /\banyone\b|\beveryone can\b|\bthe public\b|\bnobody can\b/i);
  assert.match(VISIBILITY_LEAD, /friends/i);
  assert.match(VISIBILITY_LEAD, /private to everyone else/i);
});

test('the route is reachable from the privacy index', () => {
  assert.match(body('src/components/privacy/privacy-index-page.tsx'), /onOpenVisibility/);
  assert.match(
    body('src/app/privacy.tsx'),
    /onOpenVisibility=\{\(\) => router\.push\('\/privacy\/visibility'\)\}/,
  );
});

// ---------------------------------------------------------------------------
// 6 · Accessibility, asserted where VoiceOver actually reads from
// ---------------------------------------------------------------------------

test('every switch is announced as a switch, with its state and a reason when inert', () => {
  // VoiceOver speech cannot be driven headlessly, so the contract is asserted
  // at the source it reads: role, label, checked/disabled, and a hint that is
  // the state line — or, when the control cannot act, the reason it cannot.
  const row = readFileSync('src/components/ui/settled-row.tsx', 'utf8');
  const toggle = row.slice(row.indexOf('export function ToggleRow'));
  assert.match(toggle, /accessibilityRole="switch"/);
  assert.match(toggle, /accessibilityState=\{\{ checked: value, disabled: overridden \}\}/);
  assert.match(toggle, /accessibilityLabel=\{label\}/);
  assert.match(toggle, /accessibilityHint=\{overridden \? overriddenReason : state\}/);
  // 44pt, so the switch is reachable as well as announced.
  assert.match(toggle, /minHeight: MIN_TAP_TARGET/);
});

test('an inert switch keeps its label at full strength', () => {
  // WCAG's exemption for a disabled control has never covered the prose beside
  // one, and this page turns three switches inert whenever the closet is off.
  const row = readFileSync('src/components/ui/settled-row.tsx', 'utf8');
  const toggle = row.slice(row.indexOf('export function ToggleRow'));
  // The dimming is applied to the track and thumb, never to the Text.
  assert.match(toggle, /trackColor=\{\{[^}]*overridden \? theme\.tray/s);
  const labelText = toggle.slice(toggle.indexOf('<Text variant="body">'));
  assert.doesNotMatch(labelText.slice(0, 120), /opacity|theme\.faint|theme\.tray/);
});

test('nothing on this surface animates, so Reduce Motion has nothing to reduce', () => {
  for (const file of [
    'src/components/privacy/closet-visibility-page.tsx',
    'src/components/ui/settled-row.tsx',
  ]) {
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /Animated|withTiming|withSpring|useSharedValue|LayoutAnimation/,
      `${file} animates; Reduce Motion now needs handling`,
    );
  }
});

test('the help articles no longer say the toggle does not exist', () => {
  const help = readFileSync('src/features/help/articles.ts', 'utf8');
  assert.doesNotMatch(help, /There is no privacy toggle\./);
  assert.match(help, /What friends can see/);
});
