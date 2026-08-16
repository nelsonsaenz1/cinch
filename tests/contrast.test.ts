/**
 * UX-01, pinned. The role table in `src/theme/contrast.ts` is a set of claims;
 * this is what makes them cost something.
 *
 * WHY THE TABLE AND NOT THE SCREENS
 *
 * The acceptance matrix asks for an "automated 4.5:1 role test", and the
 * tempting version of that is a scan of every `<Text>` in the app for its
 * resolved colour and ground. That scan cannot be written honestly here: a
 * ground is decided by an ancestor's `bg-*` class three components up, often by
 * a prop, and the result would be a test that reports green on the cases it
 * could not resolve. The most expensive kind of green — the constitution file
 * says so already, about the `placeholderTextColor` the first census missed.
 *
 * So the proof is split in two, and both halves are cheap and total:
 *
 *   1. HERE — every role that claims `text: true` clears AA on every ground in
 *      the app, including the darkest one. No sampling, no resolution problem.
 *   2. `tests/constitution.test.ts` — a census that refuses to let a token the
 *      table forbids appear as type in any file not already on the debt list.
 *
 * Together those say: the legal colours are legal everywhere, and the illegal
 * ones cannot spread. That is a stronger statement than a partial screen scan,
 * and unlike a screen scan it is true.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import tailwind from '../tailwind.config.js';
import { light } from '../src/theme/palette';
import {
  AA_TEXT,
  contrastRatio,
  GROUNDS,
  INK_GROUND,
  NON_TEXT_TOKENS,
  passesOnEveryGround,
  relativeLuminance,
  ROLES,
} from '../src/theme/contrast';

// ---------------------------------------------------------------------------
// The maths
// ---------------------------------------------------------------------------

test('relative luminance and contrast match the WCAG reference values', () => {
  // The two anchors every implementation is checked against: black is 0, white
  // is 1, and the pair is 21:1. If the sRGB linearisation above is wrong, these
  // are the first things to move.
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(relativeLuminance('#FFFFFF'), 1);
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
  // Symmetric — the ratio does not care which argument is the ground.
  assert.equal(contrastRatio(light.ink, light.canvas), contrastRatio(light.canvas, light.ink));
});

test('a translucent colour is refused rather than silently measured', () => {
  // `hairline`, `rule` and `ruleStrong` are alpha over an unknown ground. A
  // number for that question would be fiction; see the docblock on
  // `contrastRatio`.
  // The message is checked by hand rather than with `assert.throws`'s matcher
  // argument: this project ships no `@types/node`, so the runner's own typings
  // narrow that parameter to `string` and a RegExp there fails `tsc`.
  for (const bad of [light.rule, light.hairline, '#FFF']) {
    let message = '';
    try {
      contrastRatio(bad, light.canvas);
    } catch (error) {
      message = (error as Error).message;
    }
    assert.match(message, /opaque/, `contrastRatio accepted "${bad}"`);
  }
});

// ---------------------------------------------------------------------------
// The role table
// ---------------------------------------------------------------------------

test('every role that claims to carry text clears 4.5:1 on every ground', () => {
  // Including `sand`, the darkest ground in the app — a token that passes on
  // canvas and fails on the disabled button's ground fails in the one place
  // anyone looks closely.
  for (const [name, role] of Object.entries(ROLES)) {
    if (!role.text) continue;
    if (role.token === 'canvas') continue; // `onInk` has its own ground, below.
    for (const [ground, hex] of Object.entries(GROUNDS)) {
      const ratio = contrastRatio(light[role.token], hex);
      assert.ok(
        ratio >= AA_TEXT,
        `role "${name}" (${role.token} ${light[role.token]}) is ${ratio.toFixed(2)}:1 on ${ground} — below ${AA_TEXT}`,
      );
    }
  }
});

test('type on the one dark ground clears AA too', () => {
  assert.ok(contrastRatio(light.canvas, INK_GROUND) >= AA_TEXT);
  assert.equal(ROLES.onInk.token, 'canvas');
});

test('every role that refuses text states why, and would in fact fail', () => {
  for (const [name, role] of Object.entries(ROLES)) {
    if (role.text) continue;
    assert.ok(role.why.length > 0, `role "${name}" refuses text without saying why`);
    // A refusal that is not actually needed is a refusal nobody will respect.
    // `ruleStrong` is the one exception: it is an alpha, so it cannot be
    // measured, and its row is a NAME rather than a measurement — see the
    // table.
    if (role.token === 'ruleStrong') continue;
    assert.ok(
      !passesOnEveryGround(role.token),
      `role "${name}" (${role.token}) passes AA everywhere — it should be text: true, not a refusal`,
    );
  }
});

test('the census tokens are exactly faint, byline and ghost — plus the two marks', () => {
  // Pinned rather than left implicit, because `NON_TEXT_TOKENS` is what drives
  // the scanner in constitution.test.ts. A role added to the table silently
  // widens that census, and this is the line that makes the widening visible in
  // a diff.
  assert.deepEqual([...NON_TEXT_TOKENS].sort(), [
    'accentWarm',
    'byline',
    'faint',
    'ghost',
    'positive',
    'ruleStrong',
    'warning',
  ]);
});

test('success is short of AA, which is why it is a mark and not a sentence', () => {
  // The finding UX-01 turned up. Recorded as a NUMBER so that a future attempt
  // to set a success sentence in `positive` has to argue with the measurement
  // rather than with a comment.
  const ratio = contrastRatio(light.positive, light.canvas);
  assert.ok(ratio < AA_TEXT, 'positive now passes AA — reconsider ROLES.success');
  assert.equal(ratio.toFixed(2), '4.34');
  assert.equal(ROLES.success.text, false);
});

// ---------------------------------------------------------------------------
// Drift
// ---------------------------------------------------------------------------

test('palette.ts and tailwind.config.js hold the same hexes', () => {
  // The JS façade and the utility classes are two renderings of one palette, and
  // a screen built half from classes and half from `useTheme()` is where a drift
  // between them shows up as two nearly-identical greys on one row. The
  // constitution file pins eight of these against tailwind; this pins the whole
  // set against it, in the direction that matters for UX-01 — a role proved
  // accessible in JS must be the colour the class actually paints.
  const colors = (tailwind as { theme: { extend: { colors: Record<string, unknown> } } }).theme
    .extend.colors;
  const hex = (name: string) => {
    const c = colors[name] as { DEFAULT?: string } | string | undefined;
    return typeof c === 'string' ? c : c?.DEFAULT;
  };
  // `ruleStrong`/`blushRule` are camelCase in JS and kebab in Tailwind; the rest
  // share a name.
  const kebab: Record<string, string> = {
    ruleStrong: 'rule-strong',
    accentWarm: 'accent-warm',
    blushRule: 'blush-rule',
  };
  for (const key of Object.keys(light) as (keyof typeof light)[]) {
    assert.equal(
      hex(kebab[key] ?? key),
      light[key],
      `${key} disagrees between src/theme/palette.ts and tailwind.config.js`,
    );
  }
});

test('tokens.ts still re-exports the palette types it always did', () => {
  // The split moved data, not API. Any file importing `ThemeColors` from
  // `@/theme/tokens` — and there are many — must keep resolving.
  const src = readFileSync('src/theme/tokens.ts', 'utf8');
  assert.match(src, /export type \{ ColorSchemeName, ThemeColors \} from '\.\/palette'/);
});
