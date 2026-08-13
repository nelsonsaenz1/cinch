/**
 * Button's visual contract, pinned across the whole variant matrix.
 *
 * Audit item 49. WHY THIS SHAPE RATHER THAN A RENDERED-TREE SNAPSHOT
 *
 * `scripts/run-tests.mjs` is esbuild plus `node --test`, and its own docblock
 * explains the choice: "the things worth testing in this app are pure
 * functions — none of which need a React renderer, a native module mock, or a
 * transform pipeline." Rendering `<Button>` in Node would need react-test-
 * renderer (deprecated under React 19), a mock for every React Native
 * primitive, NativeWind's jsx transform and the Reanimated and expo-haptics
 * modules. That is a large, brittle harness.
 *
 * And it would not have caught the bugs that actually shipped. Every one
 * recorded in `button-spec.ts`'s comments is a fact about a TABLE:
 *
 *   - every primary button rendered ink-on-oxblood, because two `text-*`
 *     utilities raced and the label colour lost;
 *   - `ghost` inherited the 52pt grounded minimum and opened a gap under
 *     11px caption rows;
 *   - the contact shadow spread to a second button and flattened the
 *     distinction it exists to draw.
 *
 * Which colour, which weight, which height, which ground — per variant. A tree
 * snapshot would render all three faithfully and pass. So the table is the
 * thing to pin, and these are the assertions a diff has to justify.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Comments discuss the deleted weight table by name; only code may be searched. */
const code = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const specSource = () => readFileSync('src/components/ui/button-spec.ts', 'utf8');

import {
  GROUNDED_HEIGHT,
  ground,
  labelKey,
  minHeightFor,
  RADIUS,
  VARIANTS,
  type Variant,
} from '../src/components/ui/button-spec';

/**
 * A stand-in palette. Distinct sentinel strings rather than the real hexes:
 * this file is asserting WHICH token each variant reaches for, not what that
 * token's value is — the palette is locked elsewhere and pinning it twice
 * would make a legitimate palette change fail here for no reason.
 */
const theme = {
  accent: 'ACCENT',
  ink: 'INK',
  canvas: 'CANVAS',
  critical: 'CRITICAL',
  rule: 'RULE',
  muted: 'MUTED',
  sand: 'SAND',
} as unknown as Parameters<typeof ground>[1];

// ---------------------------------------------------------------------------
// The matrix is complete
// ---------------------------------------------------------------------------

test('every variant appears in every table', () => {
  // A variant added to the union but forgotten in one table would fall through
  // to a bare ground, an ink label or a wrong height — silently, and only on
  // the screens that use it.
  assert.equal(VARIANTS.length, 6);
  for (const v of VARIANTS) {
    assert.ok(v in labelKey, `${v} missing from labelKey`);
    assert.ok(ground(v, theme), `${v} has no ground`);
  }
});

// ---------------------------------------------------------------------------
// Label colour — the ink-on-oxblood bug
// ---------------------------------------------------------------------------

test('every filled variant sets a label colour that is not its own fill', () => {
  // The exact shape of the bug that shipped: a label the same colour as the
  // ground it sits on.
  for (const v of VARIANTS) {
    const fill = (ground(v, theme) as { backgroundColor?: string }).backgroundColor;
    if (!fill) continue;
    assert.notEqual(theme[labelKey[v]], fill, `${v} draws its label in its own fill`);
  }
});

test('the label colour per variant', () => {
  assert.deepEqual(labelKey, {
    primary: 'canvas',
    ink: 'canvas',
    secondary: 'ink',
    ghost: 'muted',
    critical: 'canvas',
    inverse: 'ink',
  });
});

// ---------------------------------------------------------------------------
// Height — the ghost gap
// ---------------------------------------------------------------------------

test('ghost sits at the tap floor and every other variant at the grounded height', () => {
  assert.equal(minHeightFor('ghost'), 44, 'ghost must stay at the 44pt tap floor');
  for (const v of VARIANTS.filter((x) => x !== 'ghost')) {
    assert.equal(minHeightFor(v), GROUNDED_HEIGHT, v);
  }
});

test('the grounded height clears the accessibility floor', () => {
  // 52 is the drawn height; 44 is the floor it must never fall below.
  assert.ok(GROUNDED_HEIGHT >= 44);
});

// ---------------------------------------------------------------------------
// Weight — §1.2 of the Refacing, as drawn on reference board A
// ---------------------------------------------------------------------------

test('no variant carries weight, and there is no table left that could', () => {
  // TY-01 supersedes the Refacing's §1.2 cut. The old `MEDIUM_LABEL` table and
  // `labelWeightFor()` were deleted rather than set to all-false, so this
  // asserts on the MODULE: a re-added weight switch fails here, and the
  // per-variant contract below proves nothing needs one.
  const spec = specSource();
  assert.doesNotMatch(spec, /MEDIUM_LABEL\s*[:=]/, 'the Medium table is back');
  assert.doesNotMatch(spec, /export function labelWeightFor/, 'labelWeightFor is back');
  assert.doesNotMatch(code(spec), /font-(?:medium|semibold|bold)/, 'a weight class is back');
});

test('the button component sets no weight on its label', () => {
  // The three labels — variant, sand-disabled, and the fade pair — all render
  // as a bare `<Text variant="body">`. A `className` carrying a font utility
  // here is the one place a weight could reappear without touching the spec.
  const src = code(readFileSync('src/components/ui/button.tsx', 'utf8'));
  assert.doesNotMatch(src, /font-(?:medium|semibold|bold)/);
  assert.doesNotMatch(src, /fontWeight/);
  assert.doesNotMatch(src, /labelWeightFor/);
});

// ---------------------------------------------------------------------------
// Ground — the rationed shadow and the rationed accent
// ---------------------------------------------------------------------------

test('the contact shadow is spent on primary and on nothing else', () => {
  // Spending it on a second button on the same screen flattens the very
  // distinction it draws, which is what happened before.
  const shadowed = VARIANTS.filter((v) => 'shadowOpacity' in ground(v, theme));
  assert.deepEqual(shadowed, ['primary']);
});

test('the accent is spent on primary and on nothing else', () => {
  // A screen keeps exactly one oxblood action. `ink` is the workhorse fill and
  // `critical` is its own deeper brick precisely so neither borrows it.
  const accented = VARIANTS.filter(
    (v) => (ground(v, theme) as { backgroundColor?: string }).backgroundColor === theme.accent,
  );
  assert.deepEqual(accented, ['primary']);
});

test('critical is its own colour, not a shade of the accent', () => {
  const fill = (ground('critical', theme) as { backgroundColor?: string }).backgroundColor;
  assert.equal(fill, theme.critical);
  assert.notEqual(fill, theme.accent);
});

test('ghost draws no ground at all', () => {
  // It is bare words — the reason it also keeps the 44pt height.
  assert.deepEqual(ground('ghost', theme), { borderRadius: RADIUS });
});

test('secondary is an outline, not a fill', () => {
  const g = ground('secondary', theme) as { borderWidth?: number; backgroundColor?: string };
  assert.equal(g.borderWidth, 1);
  assert.equal(g.backgroundColor, undefined);
});

test('inverse is a canvas pill with an ink label, for the one dark ground', () => {
  // Every other variant fails on ink and fails silently.
  assert.equal((ground('inverse', theme) as { backgroundColor?: string }).backgroundColor, 'CANVAS');
  assert.equal(labelKey.inverse, 'ink');
});

test('every variant carries the same radius', () => {
  // Labelled controls are `md`, full stop — a capsule is the look the design
  // explicitly rejects, and a variant drifting off the scale would be one.
  for (const v of VARIANTS) {
    assert.equal((ground(v, theme) as { borderRadius?: number }).borderRadius, RADIUS, v);
  }
  assert.equal(RADIUS, 12);
});

// ---------------------------------------------------------------------------
// The whole contract, in one readable block
// ---------------------------------------------------------------------------

test('the contract, per variant', () => {
  const contract = Object.fromEntries(
    VARIANTS.map((v: Variant) => {
      const g = ground(v, theme) as { backgroundColor?: string; borderWidth?: number };
      return [
        v,
        {
          fill: g.backgroundColor ?? (g.borderWidth ? 'outline' : 'none'),
          label: labelKey[v],
          minHeight: minHeightFor(v),
        },
      ];
    }),
  );

  assert.deepEqual(contract, {
    // Fill, label colour and height. No weight column — the emphasis a button
    // carries is entirely its ground and its label colour now (TY-01).
    primary: { fill: 'ACCENT', label: 'canvas', minHeight: 52 },
    ink: { fill: 'INK', label: 'canvas', minHeight: 52 },
    secondary: { fill: 'outline', label: 'ink', minHeight: 52 },
    ghost: { fill: 'none', label: 'muted', minHeight: 44 },
    critical: { fill: 'CRITICAL', label: 'canvas', minHeight: 52 },
    inverse: { fill: 'CANVAS', label: 'ink', minHeight: 52 },
  });
});
