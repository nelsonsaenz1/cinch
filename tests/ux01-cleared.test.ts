/**
 * The five files UX-01 took off the low-contrast census — cleared, and kept
 * clear.
 *
 * Same two-halves arrangement Lane G3 used in `w3-g3-no-faint-text.test.ts`, and
 * for the same reason: the census in `constitution.test.ts` is a frozen list, so
 * it proves that nothing NEW breaks the rule. It cannot prove that a file which
 * was fixed stays fixed, because the moment its line is deleted the census stops
 * looking at it specifically. This is the other half.
 *
 * WHY THESE FIVE AND NOT THE OTHER EIGHT
 *
 * Every remaining `faint` entry belongs to a surface that another lane is
 * rebuilding in this same program — Explore and the friend rows (lane B), item
 * detail and the occasion fields (lane A), the profile sheets (lane C). Editing
 * a placeholder inside a frame that is about to be redrawn produces a conflict
 * and no accessibility gain, since the redraw decides that colour anyway. These
 * five are the ones nobody else is holding: three placeholder sheets in intake,
 * report and stylist, and two `__DEV__` fixture routes.
 *
 * All five changes are `faint` → `muted`, which is 3.52:1 → 5.46:1 on canvas and
 * one step darker in the same warm ramp. No new colour, no layout change, and
 * the same substitution the eyebrow and colophon variants already made in the
 * 2026-08-06 pass.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { contrastRatio, AA_TEXT } from '../src/theme/contrast';
import { light } from '../src/theme/palette';

/** Comments stripped: a file EXPLAINING the rule must not read as breaking it. */
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const CLEARED = [
  // Placeholders. A placeholder is the ONLY text in an empty field, so it is
  // text, and it failed AA there exactly as it does anywhere else.
  'src/components/intake/CorrectionSheet.tsx',
  'src/components/report/ReportFlowSheets.tsx',
  'src/components/stylist/sheet-parts.tsx',
  // `__DEV__` fixture routes — never shipped, fixed because they were free.
  'src/dev-fixtures/dev-plan.tsx',
  'src/dev-fixtures/dev-wall.tsx',
];

test('no cleared file sets faint as text again', () => {
  const offenders = CLEARED.filter((f) => {
    const src = code(f);
    return (
      /text-faint\b/.test(src) ||
      /color:\s*theme\.faint\b/.test(src) ||
      /placeholderTextColor=\{theme\.faint\}/.test(src)
    );
  });
  assert.deepEqual(offenders, [], `faint is back as text in:\n${offenders.join('\n')}`);
});

test('nor byline or ghost, which are further from AA, not closer', () => {
  // The obvious way to "fix" a failing colour is to reach one step further down
  // the ramp by accident. Both of these are worse than the token that was
  // removed — 2.61:1 and 1.72:1 against 3.52:1.
  const offenders = CLEARED.filter((f) => {
    const src = code(f);
    return /text-(byline|ghost)\b/.test(src) || /color:\s*theme\.(byline|ghost)\b/.test(src);
  });
  assert.deepEqual(offenders, [], `a sub-faint token appeared in:\n${offenders.join('\n')}`);
});

test('the replacement actually clears AA on every ground', () => {
  // The substitution is only worth making if it is sufficient. `muted` is the
  // one quiet token that passes everywhere, including `sand` — the darkest
  // ground and the tightest case.
  for (const [name, ground] of Object.entries({
    canvas: light.canvas,
    surface: light.surface,
    tray: light.tray,
    sand: light.sand,
  })) {
    const ratio = contrastRatio(light.muted, ground);
    assert.ok(ratio >= AA_TEXT, `muted is ${ratio.toFixed(2)}:1 on ${name}`);
  }
  // And the token it replaced does not, on any of them.
  assert.ok(contrastRatio(light.faint, light.canvas) < AA_TEXT);
});

test('every cleared placeholder is set in muted', () => {
  // Named rather than merely "not faint": a placeholder rewritten to `ink`
  // would pass the refusals above and read as a filled field.
  for (const path of [
    'src/components/intake/CorrectionSheet.tsx',
    'src/components/report/ReportFlowSheets.tsx',
    'src/components/stylist/sheet-parts.tsx',
  ]) {
    assert.match(code(path), /placeholderTextColor=\{theme\.muted\}/, `${path} lost its placeholder`);
  }
});
