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

import {
  GROUNDED_HEIGHT,
  ground,
  labelKey,
  labelWeightFor,
  MEDIUM_LABEL,
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
    assert.ok(v in MEDIUM_LABEL, `${v} missing from MEDIUM_LABEL`);
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

test('filled variants carry Medium and outlined ones do not', () => {
  // Filled: a ground to carry the emphasis. Outlined and text-only: none, so
  // Medium there makes them shout at the volume of the call to action.
  assert.deepEqual(MEDIUM_LABEL, {
    primary: true,
    ink: true,
    critical: true,
    secondary: false,
    ghost: false,
    inverse: false,
  });
});

test('weight is a two-value switch, never a ramp', () => {
  // Helvetica Neue carries regular and Medium and nothing between. Anything
  // else here would have React Native synthesize a weight the face does not
  // have.
  const seen = new Set(VARIANTS.map(labelWeightFor));
  assert.deepEqual([...seen].sort(), ['', 'font-semibold']);
});

test('a filled variant carries weight and an outlined one does not', () => {
  assert.equal(labelWeightFor('primary'), 'font-semibold');
  assert.equal(labelWeightFor('secondary'), '');
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
          weight: labelWeightFor(v) === 'font-semibold' ? 'medium' : 'regular',
          minHeight: minHeightFor(v),
        },
      ];
    }),
  );

  assert.deepEqual(contract, {
    primary: { fill: 'ACCENT', label: 'canvas', weight: 'medium', minHeight: 52 },
    ink: { fill: 'INK', label: 'canvas', weight: 'medium', minHeight: 52 },
    secondary: { fill: 'outline', label: 'ink', weight: 'regular', minHeight: 52 },
    ghost: { fill: 'none', label: 'muted', weight: 'regular', minHeight: 44 },
    critical: { fill: 'CRITICAL', label: 'canvas', weight: 'medium', minHeight: 52 },
    inverse: { fill: 'CANVAS', label: 'ink', weight: 'regular', minHeight: 52 },
  });
});
