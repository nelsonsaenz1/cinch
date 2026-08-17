/**
 * The Daily Social kit's accessibility contract, asserted where VoiceOver and
 * Dynamic Type actually read from.
 *
 * Speech cannot be driven headlessly and a fontScale cannot be raised without a
 * renderer, so this file works the way `tests/event-detail-ax.test.ts` does:
 * the decisions that used to be constants in the markup are pure functions and
 * get CALLED, and the rest is asserted against the source the platform reads —
 * role, label, hint, state, and the geometry around them.
 *
 * Two rules are being held:
 *
 *   · **≥44 pt, and every control labelled.** A reaction is the only thing on
 *     this surface a person presses, and there are three of them in a row.
 *   · **Nothing is capped, truncated, ellipsised or scaled down.** At every
 *     setting composition changes and HEIGHT IS ALLOWED. A state that survives
 *     AX-XXXL by shrinking has not survived it.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  DAILY_REACTION_GAP,
  DAILY_REACTION_MIN_HEIGHT,
  dailyReactionsStacked,
  dailyReactionVisual,
} from '../src/components/daily-social/reaction-spec.ts';
import { lookNameTrimmed } from '../src/components/daily-social/look-card-spec.ts';
import { DAILY_REACTIONS } from '../src/features/daily-social/contract-types.ts';
import { REACTION_HINT, reactionAccessibilityLabel } from '../src/features/daily-social/copy.ts';
import { MIN_TAP_TARGET } from '../src/theme/metrics.ts';

const code = (path: string) => readFileSync(path, 'utf8');
const body = (path: string) =>
  code(path)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const DIR = 'src/components/daily-social';
const componentFiles = () => readdirSync(DIR).filter((f) => /\.tsx$/.test(f));

/** iOS's real ladder, as `fontScale` reports it. AX5 is the acceptance shot. */
const DEFAULT = 1;
const LARGEST_STANDARD = 1.35;
const AX_SIZES = [1.64, 2.35, 3.12];

// ---------------------------------------------------------------------------
// 1 · The 44 pt floor
// ---------------------------------------------------------------------------

test('a reaction control is never smaller than the Apple minimum', () => {
  assert.equal(DAILY_REACTION_MIN_HEIGHT, MIN_TAP_TARGET);
  assert.equal(MIN_TAP_TARGET, 44);
  for (const selected of [true, false]) {
    assert.ok(
      dailyReactionVisual(selected).minHeight >= 44,
      `the ${selected ? 'chosen' : 'resting'} state fell under 44`,
    );
  }
});

test('the floor is a minHeight, never a height', () => {
  // A fixed 44 would clip "Noted" the moment the label wraps. The spec says
  // `minHeight` and the row hands it through as `minHeight`; a `height:` in
  // either is the bug this asserts against.
  const spec = body(`${DIR}/reaction-spec.ts`);
  assert.match(spec, /minHeight: DAILY_REACTION_MIN_HEIGHT/);
  assert.doesNotMatch(spec, /\bheight:/);

  const row = body(`${DIR}/reaction-row.tsx`);
  assert.match(row, /minHeight: visual\.minHeight/);
  assert.doesNotMatch(row, /(?<!min)Height:\s*\d/);
});

test('the row is spaced on the app’s own scale, not an invented number', () => {
  assert.equal(DAILY_REACTION_GAP, 8);
});

// ---------------------------------------------------------------------------
// 2 · Every control is labelled
// ---------------------------------------------------------------------------

/** Every pressable opening tag in a file, read to its own `>`. */
function pressableTags(source: string): { file: string; tag: string }[] {
  const out: { file: string; tag: string }[] = [];
  for (const kind of ['PressableSurface', 'Pressable', 'TouchableOpacity', 'Button']) {
    for (const rest of source.split(`<${kind}`).slice(1)) {
      const end = rest.indexOf('>');
      out.push({ file: kind, tag: end === -1 ? rest : rest.slice(0, end) });
    }
  }
  return out;
}

test('every pressable in the kit carries an accessibilityLabel', () => {
  const unlabelled: string[] = [];
  for (const file of componentFiles()) {
    for (const { file: kind, tag } of pressableTags(body(`${DIR}/${file}`))) {
      if (!/accessibilityLabel/.test(tag)) unlabelled.push(`${file}: <${kind}>`);
    }
  }
  assert.deepEqual(unlabelled, [], `unlabelled controls:\n${unlabelled.join('\n')}`);
});

test('the reaction announces its role, its label, its hint and whether it is chosen', () => {
  // Four things, because three of them are not derivable from the fourth: a
  // chosen pill and a resting one differ only in fill and a tick, and neither
  // of those is audible.
  const row = body(`${DIR}/reaction-row.tsx`);
  assert.match(row, /accessibilityRole="button"/);
  assert.match(row, /accessibilityLabel=\{reactionAccessibilityLabel\(kind, lookName\)\}/);
  assert.match(row, /accessibilityHint=\{REACTION_HINT\}/);
  assert.match(row, /accessibilityState=\{visual\.accessibilityState\}/);
  for (const selected of [true, false]) {
    assert.deepEqual(dailyReactionVisual(selected).accessibilityState, { selected });
  }
});

test('every one of the three has a distinct spoken label', () => {
  const labels = DAILY_REACTIONS.map((r) => reactionAccessibilityLabel(r, 'Weekend layers'));
  assert.equal(new Set(labels).size, 3);
  for (const label of labels) assert.ok(label.length > 0);
  assert.ok(REACTION_HINT.length > 0);
});

test('the look is one accessible element and the reactions are not inside it', () => {
  // Wrapping controls in an `accessible` view makes them unreachable on iOS —
  // the three reactions would stop being focusable at all.
  const card = body(`${DIR}/look-card.tsx`);
  const accessibleBlock = card.slice(card.indexOf('accessible\n'), card.indexOf('<ReactionRow'));
  assert.ok(accessibleBlock.length > 0, 'the card no longer has an accessible block');
  assert.doesNotMatch(accessibleBlock, /<ReactionRow/);
  assert.match(card, /accessibilityLabel=\{lookAccessibilityLabel\(/);
});

test('the failed read is announced, and the quiet day is not', () => {
  // `alert` for the state that appears after a wait; `summary` for the one that
  // is simply the page. `ErrorState` sets the first, so the offline screen
  // inherits it by using the kit rather than redrawing it.
  assert.match(code('src/components/ui/error-state.tsx'), /accessibilityRole="alert"/);
  const screens = body(`${DIR}/state-screens.tsx`);
  assert.match(screens, /<ErrorState/);
  assert.match(screens, /kicker=\{OFFLINE\.kicker\}/);
  assert.match(screens, /accessibilityRole="summary"/);
});

test('the offline state is never a dead end', () => {
  // `onRetry` required, not optional: without it the screen has no way out and
  // the state the reader is in is the one where trying again is the whole
  // remedy.
  const screens = body(`${DIR}/state-screens.tsx`);
  assert.match(screens, /onRetry: \(\) => void;/);
  assert.match(screens, /onRetry=\{onRetry\}/);
});

// ---------------------------------------------------------------------------
// 3 · Dynamic Type to AX-XXXL
// ---------------------------------------------------------------------------

test('the three sit across a measure at standard sizes and stack at the accessibility ones', () => {
  assert.equal(dailyReactionsStacked(DEFAULT), false);
  assert.equal(dailyReactionsStacked(1.2), false);
  for (const scale of [LARGEST_STANDARD, ...AX_SIZES]) {
    assert.equal(dailyReactionsStacked(scale), true, `still across at ${scale}`);
  }
});

test('the look’s name keeps its cap-trim only while it is one line', () => {
  // `trim` subtracts a margin sized for ONE line. Applied to a name holding
  // two, it pulls the continuation under the collage.
  assert.equal(lookNameTrimmed(DEFAULT), true);
  assert.equal(lookNameTrimmed(1.2), true);
  for (const scale of [LARGEST_STANDARD, ...AX_SIZES]) {
    assert.equal(lookNameTrimmed(scale), false, `still trimmed at ${scale}`);
  }
});

test('the trim reads the reader’s setting rather than the length of a friend’s outfit name', () => {
  const card = body(`${DIR}/look-card.tsx`);
  assert.match(card, /useWindowDimensions\(\)/);
  assert.match(card, /trim=\{lookNameTrimmed\(fontScale\)\}/);
  // The first draft of this card trimmed on `displayName.length <= 24`, which
  // trims or does not trim depending on how a friend happened to name their
  // outfit and is blind to the setting that actually causes the wrap.
  assert.doesNotMatch(card, /trim=\{[^}]*length/, 'the trim went back to guessing from a name');
  assert.doesNotMatch(card, /displayName\.length/);
});

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

test('nothing that holds text is given a fixed height', () => {
  // The collage's rows carry an `aspectRatio` and hold pictures; the skeleton's
  // blocks carry a height and hold nothing. Neither has a word in it. Every
  // file that renders a `<Text>` must have no `height:` at all.
  const offenders: string[] = [];
  const scanned: string[] = [];
  for (const file of componentFiles()) {
    const src = body(`${DIR}/${file}`);
    if (!/<Text\b/.test(src)) continue;
    scanned.push(file);
    if (/(?<!min)(?<!max)[Hh]eight:\s*\d/.test(src)) offenders.push(file);
  }
  // A vacuous pass is the failure mode here: if the census stops finding the
  // files that hold words, it stops holding anything.
  assert.ok(scanned.length >= 3, `the text census found only ${scanned.length} files`);
  assert.deepEqual(offenders, [], `a fixed height sits around text in:\n${offenders.join('\n')}`);
});

// ---------------------------------------------------------------------------
// 4 · Reduce Motion, and the palette
// ---------------------------------------------------------------------------

test('the only motion in the kit is the shared, Reduce-Motion-safe kind', () => {
  // `Skeleton` and `PressableSurface` both honour the setting already. Anything
  // hand-rolled here would need its own handling, and would not have it.
  for (const file of readdirSync(DIR).filter((f) => /\.tsx?$/.test(f))) {
    assert.doesNotMatch(
      body(`${DIR}/${file}`),
      /withTiming|withSpring|withRepeat|useSharedValue|LayoutAnimation/,
      `${file} animates by hand; Reduce Motion now needs handling`,
    );
  }
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
        new RegExp(`color:\\s*(selected \\? )?theme\\.${token}\\b`),
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
