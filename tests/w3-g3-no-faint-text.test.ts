/**
 * The three Group 3 files on the frozen faint-text census, and the fixtures
 * beside them — cleared, and kept clear.
 *
 * `tests/constitution.test.ts` holds `FAINT_TEXT_DEBT`, a frozen list of every
 * file setting #8A8578 as type. Three of its entries were this lane's, because
 * the shared checkpoint deliberately did not decide their colour: "their colour
 * is decided by the frame that draws them, by the lane that owns them."
 *
 * The frames decided. `muted` (#6B665C) is the secondary text colour in every
 * one of them, and the constitution's refusal has no exception to argue with:
 * "NEVER #8A8578 as text". At 3.52:1 on canvas it fails AA, and every one of
 * these uses was real content — a placeholder carrying a field's job, a price
 * invitation, a hedge on a guessed value, a footnote of record.
 *
 * That census test is integrator-owned and will fail as STALE until those three
 * lines are deleted from it, which is correct and is that lane's to do. This
 * file is the other half: it fails if any of them regresses, and it does not
 * depend on the census being pruned first.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Every file this lane cleared, shipping surfaces and fixtures alike. */
const CLEARED = [
  'src/components/review/review-card.tsx',
  'src/components/ingest/garment-search-sheet.tsx',
  'src/components/item/item-edit-sheet.tsx',
  'src/dev-fixtures/dev-capture.tsx',
  'src/dev-fixtures/dev-closet.tsx',
  'src/dev-fixtures/dev-describe.tsx',
];

/** Comments stripped: a file EXPLAINING the rule must not read as breaking it. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('no cleared Group 3 file sets faint as text again', () => {
  const offenders = CLEARED.filter((f) => {
    const src = code(f);
    return /text-faint\b/.test(src) || /color:\s*theme\.faint\b/.test(src);
  });
  assert.deepEqual(offenders, [], `faint is back as text in:\n${offenders.join('\n')}`);
});

test('faint is not smuggled in as a placeholder or a tint either', () => {
  // The census regex looks for `text-faint` and `color: theme.faint`, which is
  // what it could safely freeze. It does not catch `placeholderTextColor={...}`
  // — and a placeholder is the ONLY text in an empty field, which DS-01 makes
  // carry one of the field's two jobs. Same refusal, different prop name.
  const offenders = CLEARED.filter((f) => /placeholderTextColor=\{theme\.faint\}/.test(code(f)));
  assert.deepEqual(offenders, [], `faint set as placeholder text in:\n${offenders.join('\n')}`);
});
