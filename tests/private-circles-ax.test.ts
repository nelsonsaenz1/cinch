/**
 * The private-groups kit's accessibility contract, asserted where VoiceOver and
 * Dynamic Type actually read from.
 *
 * Speech cannot be driven headlessly and a fontScale cannot be raised without a
 * renderer, so this file works the way `tests/daily-social-ax.test.ts` and
 * `tests/event-detail-ax.test.ts` do: the decisions that would otherwise be
 * constants in the markup are pure functions and get CALLED, and the rest is
 * asserted against the source the platform reads — role, label, hint, state,
 * and the geometry around them.
 *
 * Four rules are held here, and the third is the one PC-10 states about itself:
 *
 *   · **≥44 pt, and every control labelled.**
 *   · **Nothing is capped, truncated, ellipsised or scaled down.** At every
 *     setting composition changes and HEIGHT IS ALLOWED. A state that survives
 *     AX-XXXL by shrinking has not survived it.
 *   · **No meaning is carried by colour alone.** Every unavailable row states
 *     its reason as text on the row; the Owner badge is a word; a chosen row is
 *     a shape and an `accessibilityState`.
 *   · **Reduce Motion is honoured**, and by the house hook rather than by hand.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  INELIGIBILITY_REASONS,
  ineligibilityReason,
  MANAGE,
  pickerRowAccessibilityLabel,
} from '../src/features/circles/copy.ts';
import { MIN_TAP_TARGET } from '../src/theme/metrics.ts';

const code = (path: string) => readFileSync(path, 'utf8');
const body = (path: string) =>
  code(path)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const DIR = 'src/components/circles';
const componentFiles = () => readdirSync(DIR).filter((f) => /\.tsx$/.test(f));

// ---------------------------------------------------------------------------
// 1 · The 44 pt floor
// ---------------------------------------------------------------------------

test('the census finds the kit, so a pass here is never vacuous', () => {
  const files = componentFiles();
  assert.ok(files.length >= 6, `the component census found only ${files.length} files`);
  for (const required of [
    'group-row.tsx',
    'member-row.tsx',
    'picker-row.tsx',
    'invitation-card.tsx',
    'confirm-dialogs.tsx',
    'state-screens.tsx',
  ]) {
    assert.ok(files.includes(required), `${required} is missing from the kit`);
  }
});

test('every row and every control carries the 44 pt floor, as a minimum not a height', () => {
  assert.equal(MIN_TAP_TARGET, 44);
  // A fixed 44 would clip a name the moment it wraps. Every geometry in the kit
  // is a `minHeight`, and the floor is imported rather than typed as a number.
  for (const file of ['group-row.tsx', 'member-row.tsx', 'picker-row.tsx', 'state-screens.tsx']) {
    const src = body(`${DIR}/${file}`);
    assert.match(src, /minHeight: MIN_TAP_TARGET/, `${file} does not carry the floor`);
    assert.doesNotMatch(src, /minHeight:\s*\d/, `${file} types the floor as a number`);
  }
});

test('every control the ROUTES draw carries the floor as well', () => {
  // The kit is not the whole surface: three of the atlas's controls live in
  // nav bars, which are the screens' own — PC-02's Create, PC-06's Manage and
  // PC-07's Done. A floor held only inside `components/circles/` would be a
  // floor with three holes in it.
  for (const file of [
    'src/app/groups/create.tsx',
    'src/app/groups/[circleId]/index.tsx',
    'src/app/groups/[circleId]/manage.tsx',
  ]) {
    const src = body(file);
    assert.match(src, /minHeight: MIN_TAP_TARGET/, `${file} draws a control under the floor`);
    assert.match(src, /hitSlop=\{8\}/, `${file} has a nav control with no slop around it`);
  }
});

test('nothing anywhere in the kit is given a fixed height', () => {
  // Every file here renders text. `height:` around words is what clips them at
  // AX-XXXL, and there is no picture in this kit that would want one.
  const offenders: string[] = [];
  for (const file of componentFiles()) {
    const src = body(`${DIR}/${file}`);
    if (/(?<!min)(?<!max)[Hh]eight:\s*\d/.test(src)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `a fixed height sits around text in:\n${offenders.join('\n')}`);
});

test('the destructive control keeps its own target, away from the row beside it', () => {
  // A roster row is not pressable, but the Remove beside it is — and a
  // destructive control must never be a graze off anything.
  const src = body(`${DIR}/member-row.tsx`);
  assert.match(src, /hitSlop=\{8\}/);
  assert.match(src, /flexGrow: 0, flexShrink: 0/);
});

// ---------------------------------------------------------------------------
// 2 · Every control is labelled
// ---------------------------------------------------------------------------

/** Every pressable opening tag in a file, read to its own `>`. */
function pressableTags(source: string): { kind: string; tag: string }[] {
  const out: { kind: string; tag: string }[] = [];
  for (const kind of ['PressableSurface', 'Pressable', 'TouchableOpacity', 'Button']) {
    for (const rest of source.split(`<${kind}`).slice(1)) {
      // `<PressableSurface` also matches `<Pressable`; skip the continuation so
      // a wrapper is not counted twice under the shorter name.
      if (/^[A-Za-z]/.test(rest)) continue;
      const end = rest.indexOf('>');
      out.push({ kind, tag: end === -1 ? rest : rest.slice(0, end) });
    }
  }
  return out;
}

test('every pressable in the kit carries an accessibilityLabel', () => {
  const unlabelled: string[] = [];
  let counted = 0;
  for (const file of componentFiles()) {
    for (const { kind, tag } of pressableTags(body(`${DIR}/${file}`))) {
      counted += 1;
      if (!/accessibilityLabel/.test(tag)) unlabelled.push(`${file}: <${kind}>`);
    }
  }
  assert.ok(counted >= 8, `the control census found only ${counted} controls`);
  assert.deepEqual(unlabelled, [], `unlabelled controls:\n${unlabelled.join('\n')}`);
});

test('every pressable also declares a role and, where it has one, a state', () => {
  const rows = body(`${DIR}/picker-row.tsx`);
  assert.match(rows, /accessibilityRole="checkbox"/);
  assert.match(rows, /accessibilityState=\{\{ checked: selected, disabled: unavailable \}\}/);

  const group = body(`${DIR}/group-row.tsx`);
  assert.match(group, /accessibilityRole="button"/);

  const member = body(`${DIR}/member-row.tsx`);
  assert.match(member, /accessibilityRole="button"/);
  assert.match(member, /accessibilityRole="text"/);
});

test('the failed read is announced, and the boundary states are not', () => {
  // `alert` for the state that appears after a wait; `summary` for the ones
  // that are simply the page. `ErrorState` sets the first, so the offline
  // screen inherits it by using the kit rather than redrawing it.
  assert.match(code('src/components/ui/error-state.tsx'), /accessibilityRole="alert"/);
  const screens = body(`${DIR}/state-screens.tsx`);
  assert.match(screens, /<ErrorState/);
  assert.match(screens, /accessibilityRole="summary"/);
  assert.doesNotMatch(screens, /accessibilityRole="alert"/);
});

test('the offline state is never a dead end', () => {
  const screens = body(`${DIR}/state-screens.tsx`);
  assert.match(screens, /onRetry: \(\) => void;/);
  assert.match(screens, /onRetry=\{onRetry\}/);
});

// ---------------------------------------------------------------------------
// 3 · No meaning is carried by colour alone
// ---------------------------------------------------------------------------

test('an unavailable row is disabled ONLY by having a reason, so it can never be silent', () => {
  // The structural half of PC-10's rule: `reason` being non-null is the only
  // thing that turns the row off, and the same value is what prints. There is
  // no `disabled` prop to pass without words.
  const src = body(`${DIR}/picker-row.tsx`);
  assert.match(src, /const why = ineligibilityReason\(reason\);/);
  assert.match(src, /const unavailable = why !== null;/);
  assert.match(src, /disabled=\{unavailable\}/);
  // And the reason is DRAWN, not only computed.
  assert.match(src, /\{why \? \(/);
  assert.match(src, /\{why\}/);
  // No separate boolean could ever be handed in without one.
  assert.doesNotMatch(src, /disabled\??:\s*boolean/);
});

test('every reason resolves to a printable sentence, and nothing resolves to a colour', () => {
  assert.equal(ineligibilityReason(null), null);
  // All four PC-03 and PC-10 draw, not just the two refusals. A seat-holder's
  // row is inert too, and an inert row with no words is the failure this whole
  // mechanism exists to prevent — which is exactly how the picker used to
  // handle them, by deleting the row.
  for (const reason of ['group_full', 'not_mutual', 'already_member', 'invite_pending'] as const) {
    const text = ineligibilityReason(reason);
    assert.equal(text, INELIGIBILITY_REASONS[reason]);
    assert.ok(text && text.length > 0);
    // The spoken label carries it too: a reader who cannot see the row is
    // exactly the reader who cannot see why it did nothing.
    assert.match(pickerRowAccessibilityLabel({ name: 'Ellis Moore', reason }), new RegExp(text!));
  }
});

test('the Owner badge is a word, not a tint and not a weight', () => {
  assert.equal(MANAGE.ownerBadge, 'Owner');
  const src = body(`${DIR}/member-row.tsx`);
  assert.match(src, /\{badge\}/);
  // The app has one sans cut and hierarchy is never carried by weight (TY-01).
  assert.doesNotMatch(src, /fontWeight/);
  // And no icon stands in for the word.
  assert.doesNotMatch(src, /crown|star\.fill|shield/i);
});

test('a chosen picker row is a shape and a state, never a fill', () => {
  const src = body(`${DIR}/picker-row.tsx`);
  assert.match(src, /name="checkmark"/);
  assert.match(src, /\{selected \? \(/);
  // Nothing repaints the row or the name on selection.
  assert.doesNotMatch(src, /selected \? theme\./);
  assert.doesNotMatch(src, /bg-(accent|ink|blush)/);
});

test('no forbidden token is set as text anywhere in the kit', () => {
  // `byline` is 2.61:1 and banned as text by the frozen census; `faint` and
  // `ghost` are below it. `constitution.test.ts` runs the app-wide scan — this
  // is the local one, so a regression is reported against this lane rather than
  // against a debt list this lane must never join.
  for (const file of readdirSync(DIR).filter((f) => /\.tsx?$/.test(f))) {
    const src = body(`${DIR}/${file}`);
    for (const token of ['byline', 'faint', 'ghost']) {
      assert.doesNotMatch(src, new RegExp(`text-${token}\\b`), `${file} sets ${token} as text`);
      assert.doesNotMatch(
        src,
        new RegExp(`color:\\s*(\\w+ \\? )?theme\\.${token}\\b`),
        `${file} sets ${token} as text`,
      );
    }
  }
});

test('the kit introduces no colour of its own', () => {
  // Every ground and every label comes from the palette through `useTheme()` or
  // a Tailwind token. A hex here would be a tenth colour nobody can trace, and
  // one the contrast census would never see.
  for (const file of readdirSync(DIR).filter((f) => /\.tsx?$/.test(f))) {
    assert.doesNotMatch(
      body(`${DIR}/${file}`),
      /#[0-9A-Fa-f]{6}\b|rgba?\(/,
      `${file} hand-writes a colour`,
    );
  }
});

// ---------------------------------------------------------------------------
// 4 · Dynamic Type to AX-XXXL
// ---------------------------------------------------------------------------

test('no decision in this kit ever answers by shrinking or truncating text', () => {
  const offenders: string[] = [];
  for (const file of readdirSync(DIR).filter((f) => /\.tsx?$/.test(f))) {
    const src = body(`${DIR}/${file}`);
    if (/numberOfLines|ellipsizeMode|adjustsFontSize|maxFontSizeMultiplier|allowFontScaling/.test(src)) {
      offenders.push(file);
    }
    // A hand-written `fontSize` over a `Text` variant is the other half of the
    // same failure: the variants carry line heights computed from the real font
    // metrics, and a size set beside one clips the tops of the glyphs.
    if (/fontSize:/.test(src)) offenders.push(`${file} (fontSize)`);
  }
  assert.deepEqual(offenders, [], `text is capped or resized in:\n${offenders.join('\n')}`);
});

test('the identity block reflows rather than truncating — PC-06-AX', () => {
  // At AX-XXXL the Owner badge drops BELOW the name and the join date takes its
  // own line. `flex-wrap` on the row plus `minWidth: 0` on the flexible block is
  // what does it: no measurement, no breakpoint, and it behaves identically at
  // every Dynamic Type size rather than at the one somebody tested.
  const src = body(`${DIR}/member-row.tsx`);
  assert.match(src, /flex-row flex-wrap items-center/);
  assert.match(src, /minWidth: 0/);
});

test('a destructive confirmation can never hide half of what it is warning about', () => {
  // Three sentences of consequence at AX-XXXL is taller than the viewport. The
  // card scrolls; it does not cap, and it does not clip.
  const src = body(`${DIR}/confirm-dialogs.tsx`);
  assert.match(src, /<ScrollView/);
  assert.doesNotMatch(src, /maxHeight/);
});

// ---------------------------------------------------------------------------
// 5 · Reduce Motion
// ---------------------------------------------------------------------------

test('the only motion in the kit is honoured by the house hook', () => {
  const dialogs = body(`${DIR}/confirm-dialogs.tsx`);
  assert.match(dialogs, /useReducedMotion\(\)/);
  assert.match(dialogs, /animationType=\{reduced \? 'none' : 'fade'\}/);

  // Nothing else animates by hand. `PressableSurface` and `Button` both carry
  // Reduce Motion by construction; anything hand-rolled here would need its own
  // handling and would not have it.
  for (const file of readdirSync(DIR).filter((f) => /\.tsx?$/.test(f))) {
    assert.doesNotMatch(
      body(`${DIR}/${file}`),
      /withTiming|withSpring|withRepeat|useSharedValue|LayoutAnimation/,
      `${file} animates by hand; Reduce Motion now needs handling`,
    );
  }
});

test('an incidental dismissal always lands on the safe branch', () => {
  // The scrim and the Android back gesture both resolve to the calm option. A
  // destructive dialog whose accidental dismissals confirmed it would be a trap.
  const src = body(`${DIR}/confirm-dialogs.tsx`);
  assert.match(src, /const dismiss = pending \? undefined : onSafe;/);
  assert.match(src, /onRequestClose=\{dismiss \?\? \(\(\) => undefined\)\}/);
  assert.match(src, /onPress=\{dismiss\}/);
  assert.match(src, /accessibilityViewIsModal/);
  // And the safe choice is drawn FIRST, so the eye lands on it.
  assert.ok(src.indexOf('title={safeTitle}') < src.indexOf('title={confirmTitle}'));
});

// ---------------------------------------------------------------------------
// 6 · No free text, no camera, no discoverability affordance
// ---------------------------------------------------------------------------

test('the kit ships no free-text field of its own', () => {
  // The group NAME is free text and it is a field the composing screen owns —
  // `assert_clean_ugc('name')` gates it in the schema. Nothing in the
  // presentational kit collects text, so there is no second, ungated path.
  for (const file of componentFiles()) {
    const src = body(`${DIR}/${file}`);
    assert.doesNotMatch(src, /<TextInput|<SearchField|multiline/, `${file} has a text field`);
  }
});

test('nothing in the kit offers a way to find a group or a stranger', () => {
  for (const file of componentFiles()) {
    const src = body(`${DIR}/${file}`);
    assert.doesNotMatch(src, /magnifyingglass|onSearch|SearchField/, `${file} offers a search`);
  }
});
