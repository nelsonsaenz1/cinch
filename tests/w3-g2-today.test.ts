/**
 * Wave 3 · Group 2 — Today and the daily plate.
 *
 * Six of this group's rules are arithmetic or string rules rather than
 * drawings, and every one of them is invisible in a screenshot until it is
 * already wrong:
 *
 *   * the grid never leaves a blank cell (audit 58's acceptance check);
 *   * the temperature is stated once, or omitted — never dashed, never guessed;
 *   * cost-per-wear prints only when EVERY piece is priced (T-03);
 *   * the palette prints names, not hex;
 *   * the action row's order, weights and four states (audit 59, T-13, T-15);
 *   * the gap card's figure is computed, never written.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { missingPhrase } from '../src/components/today/closet-floor-copy';
import { contextLabel, contextLines, feelsClause } from '../src/components/today/context-label';
import {
  costPerWearLine,
  costPerWearSpoken,
  outfitCostPerWear,
  platedCostPerWear,
} from '../src/components/today/cost-per-wear';
import { GRID_GAP, gridHeight, plateGrid, ROW_RATIO } from '../src/components/today/plate-grid';
import { MAX_PALETTE_NAMED, paletteEntries } from '../src/components/today/plate-spec';
import { occasionInterruptCopy, whenEyebrow } from '../src/components/today/occasion-copy';
import {
  AX_FONT_SCALE,
  w3ReactionSpec,
  W3_ROW_HEIGHT,
  W3_STACKED_HEIGHT,
  W3_WEAR_WEIGHT,
} from '../src/components/today/reaction-spec';
import { gapSentence } from '../src/components/today/gap-copy';
import { garment, resetIds } from './helpers';

// ── The composed-look grid ────────────────────────────────────────────────

test('every piece in the look is in the grid, and no cell is empty', () => {
  // The acceptance check is "no blank cell that could be mistaken for a failed
  // image", and the arithmetic of that is: the rows sum to exactly the number
  // of pieces. Not one more.
  for (let n = 1; n <= 9; n++) {
    const rows = plateGrid(n);
    assert.equal(
      rows.reduce((a, b) => a + b, 0),
      n,
      `${n} pieces produced ${JSON.stringify(rows)}`,
    );
    assert.ok(
      rows.every((cells) => cells >= 1 && cells <= 4),
      `${n} pieces produced a row outside 1…4: ${JSON.stringify(rows)}`,
    );
  }
});

test('the four drawn compositions are the ones the atlas draws', () => {
  assert.deepEqual(plateGrid(3), [2, 1], 'T-03 draws two-up plus a full-width piece');
  assert.deepEqual(plateGrid(4), [4], 'T-02 composes four pieces on one row');
  assert.deepEqual(plateGrid(5), [3, 2], 'T-01 five pieces, and no spare cell');
  assert.deepEqual(plateGrid(6), [3, 3], 'the plate works at three to six pieces');
});

test('an empty look draws no grid at all', () => {
  assert.deepEqual(plateGrid(0), []);
  assert.equal(gridHeight([], 320), 0);
});

test('every row is the same height, so no piece is drawn larger than another', () => {
  const width = 320;
  const one = gridHeight([3], width);
  const two = gridHeight([3, 2], width);
  assert.equal(one, width * ROW_RATIO);
  assert.equal(two, 2 * width * ROW_RATIO + GRID_GAP);
});

// ── The context label · audit 57 ──────────────────────────────────────────

test('the temperature is stated once, and omitted rather than guessed', () => {
  assert.equal(feelsClause('72°', 'F', 'mild'), 'Feels 72°F, mild');
  assert.equal(feelsClause('72°', 'F'), 'Feels 72°F');
  // Offline (T-09): no reading, so no clause — and nothing stands in for it.
  assert.equal(feelsClause(null, 'F', 'mild'), null);
  assert.equal(contextLabel('Thu 7 Aug · Denver', null), 'Thu 7 Aug · Denver');
  assert.equal(
    contextLabel('Thu 7 Aug · Denver', 'Feels 72°F, mild'),
    'Thu 7 Aug · Denver · Feels 72°F, mild',
  );
});

test('no context label ever contains a dash standing in for a fact', () => {
  for (const label of [
    contextLabel('Thu 7 Aug · Denver', null),
    ...contextLines('Thu 7 Aug · Denver', null),
  ]) {
    assert.ok(!label.includes('—'), `"${label}" prints an em dash where a fact should be`);
  }
});

test('at the largest type the label breaks rather than truncating', () => {
  assert.deepEqual(contextLines('Thu 7 Aug · Denver', 'Feels 72°F, mild'), [
    'Thu 7 Aug · Denver',
    'Feels 72°F, mild',
  ]);
  assert.deepEqual(contextLines('Thu 7 Aug · Denver', null), ['Thu 7 Aug · Denver']);
});

// ── Cost per wear · T-03 ──────────────────────────────────────────────────

const priced = (price: number | null, wearCount: number) =>
  garment('base_top', 'navy', { purchasePrice: price, wearCount });

test('the plate prints cost-per-wear only when every piece carries a price', () => {
  resetIds();
  assert.equal(platedCostPerWear([priced(100, 4), priced(60, 3)]), 45);
  // One unpriced piece and the whole line goes, rather than reporting four
  // pieces' cost as the outfit's.
  assert.equal(platedCostPerWear([priced(100, 4), priced(null, 3)]), null);
  // A never-worn piece has no cost per wear either.
  assert.equal(platedCostPerWear([priced(100, 4), priced(60, 0)]), null);
  assert.equal(platedCostPerWear([]), null);
});

test('the lenient function is untouched, because another screen still prints it', () => {
  resetIds();
  // `app/repeat-outfit.tsx` is another lane's file and reads this one. The
  // strict rule is additive precisely so that screen does not change.
  assert.equal(outfitCostPerWear([priced(100, 4), priced(null, 3)]), 25);
});

test('an absent cost-per-wear is an absent line — never a dash', () => {
  assert.equal(costPerWearLine(null), null);
  assert.equal(costPerWearSpoken(null), null);
  assert.equal(costPerWearLine(2.14), '$2.14 a wear');
  assert.equal(costPerWearSpoken(2.14), '2 dollars 14 a wear');
  assert.equal(costPerWearSpoken(3), '3 dollars a wear');
});

// ── The palette · names, never hex ────────────────────────────────────────

test('the palette prints the engine own colour names, deduplicated and capped', () => {
  resetIds();
  const pieces = [
    garment('outerwear', 'cream'),
    garment('mid_layer', 'cream'),
    garment('bottom', 'charcoal'),
    garment('footwear', 'cognac'),
    garment('bag', 'navy'),
  ];
  const entries = paletteEntries(pieces);
  assert.ok(entries.length <= MAX_PALETTE_NAMED);
  assert.deepEqual(
    entries.map((e) => e.name),
    ['cream', 'charcoal', 'cognac'],
    'duplicates collapse and the cap holds',
  );
  for (const entry of entries) {
    assert.match(entry.hex, /^#[0-9a-f]{6}$/i);
    assert.ok(entry.name && !entry.name.startsWith('#'), 'a name, never a hex value');
  }
});

test('a piece below the visual-weight floor claims no colour slot', () => {
  resetIds();
  const belt = garment('accessory', 'burgundy', { visualWeight: 0.05 });
  assert.deepEqual(paletteEntries([belt]), []);
});

// ── The action row · audit 59, T-13, T-15, T-09 ───────────────────────────

test('the wear action is dominant by size as well as by fill', () => {
  const wear = w3ReactionSpec({ kind: 'wear', state: 'idle' });
  const love = w3ReactionSpec({ kind: 'love', state: 'idle' });
  assert.equal(wear.flex, W3_WEAR_WEIGHT);
  assert.equal(love.flex, 1);
  assert.ok(wear.flex > love.flex);
  assert.ok(wear.ground.includes('bg-accent'), 'the frame one oxblood is spent here');
  assert.ok(love.ground.includes('border border-rule'));
});

test('the accent moves to the interrupt, and the wear action falls back to ink', () => {
  // T-02: one dominant action, one accent — still.
  const wear = w3ReactionSpec({ kind: 'wear', state: 'idle', accent: false });
  assert.ok(wear.ground.includes('bg-ink'));
  assert.ok(!wear.ground.includes('bg-accent'));
});

test('three controls across at 48, stacked at 60, both clearing the 44 pt floor', () => {
  for (const kind of ['wear', 'love', 'pass'] as const) {
    assert.equal(w3ReactionSpec({ kind, state: 'idle' }).minHeight, W3_ROW_HEIGHT);
    assert.equal(w3ReactionSpec({ kind, state: 'idle', stacked: true }).minHeight, W3_STACKED_HEIGHT);
  }
  assert.ok(W3_ROW_HEIGHT >= 44 && W3_STACKED_HEIGHT >= 44);
  assert.ok(AX_FONT_SCALE > 1, 'the stress frames are drawn above the standard scale');
});

test('a selected control says so three ways, not one', () => {
  const spec = w3ReactionSpec({ kind: 'love', state: 'selected' });
  assert.equal(spec.tick, true, 'the tick is the channel that survives colour blindness');
  assert.ok(spec.ground.includes('bg-ink'), 'and the fill is the second');
  assert.equal(spec.accessibilityState.selected, true, 'and the announcement is the third');
});

test('a failed reaction is a third state, distinct from idle and from saved', () => {
  const failed = w3ReactionSpec({ kind: 'love', state: 'failed' });
  const idle = w3ReactionSpec({ kind: 'love', state: 'idle' });
  const saved = w3ReactionSpec({ kind: 'love', state: 'selected' });
  assert.ok(failed.ground.includes('border border-accent'), 'outlined in oxblood, not filled');
  assert.notEqual(failed.ground, idle.ground);
  assert.notEqual(failed.ground, saved.ground);
  // The decision is preserved: a failed write is still the reader choice.
  assert.equal(failed.accessibilityState.selected, true);
  assert.equal(failed.accessibilityState.disabled, false, 'a retry must stay reachable');
});

test('an unavailable control reads as inert by ground, never by faintness', () => {
  const spec = w3ReactionSpec({ kind: 'love', state: 'unavailable' });
  assert.ok(spec.ground.includes('bg-tray'));
  assert.equal(spec.label, 'muted', '#8A8578 is never text — secondary ink is');
  assert.notEqual(spec.label, 'faint');
  assert.equal(spec.accessibilityState.disabled, true);
});

// ── The occasion interrupt · T-02 ─────────────────────────────────────────

const NOW = new Date(2026, 7, 6, 9, 41, 0);

test('the interrupt names when, where and how many — and counts nobody twice', () => {
  const copy = occasionInterruptCopy(
    {
      title: 'Dinner',
      venueName: 'Bar Ilios',
      startsAt: new Date(2026, 7, 6, 19, 0, 0),
      memberCount: 4,
      occasion: 'dinner',
    },
    NOW,
  );
  assert.equal(copy.eyebrow, 'Tonight');
  assert.equal(copy.line, 'Dinner at Bar Ilios, 7pm');
  assert.equal(copy.going, 'Four going.');
  assert.equal(copy.action, 'Dress for the dinner instead');
});

test('a solo occasion prints no attendance at all', () => {
  const copy = occasionInterruptCopy(
    { title: 'Lunch', startsAt: new Date(2026, 7, 6, 12, 30, 0), memberCount: 1 },
    NOW,
  );
  assert.equal(copy.going, null, '"1 going" is not a fact worth printing');
  assert.equal(copy.eyebrow, 'Today');
  assert.equal(copy.line, 'Lunch, 12:30pm');
  assert.equal(copy.action, 'Dress for the occasion instead', 'no noun guessed from the title');
});

test('a dateless occasion prints no hour it does not have', () => {
  const copy = occasionInterruptCopy({ title: 'Ada wedding', startsAt: null, memberCount: 6 }, NOW);
  assert.equal(copy.line, 'Ada wedding');
  assert.equal(whenEyebrow(null, NOW), 'Coming up');
});

// ── T-11 · what a first outfit is missing ─────────────────────────────────

test('the missing kinds are named as garments, not as a threshold', () => {
  assert.equal(missingPhrase([]), null);
  assert.equal(missingPhrase(['shoes']), 'a pair of shoes');
  assert.equal(missingPhrase(['shoes', 'bottoms']), 'a pair of shoes and a bottom');
  const phrase = missingPhrase(['shoes', 'tops', 'bottoms'])!;
  assert.ok(!/\d/.test(phrase), 'the engine floor is never printed as a number');
});

// ── T-12 · the gap card figure is computed ────────────────────────────────

test('the gap card states the gain the arithmetic produced', () => {
  const sentence = gapSentence({ kind: 'shoes', total: 14, gain: 7 });
  assert.match(sentence, /seven more outfit cores/);
  assert.ok(!sentence.includes('7 '), 'the figure is spelled, in the +7 form the atlas sets');
  assert.equal(
    gapSentence({ kind: 'bottoms', total: 2, gain: 1 }),
    'One more bottom would give you one more outfit core from pieces you already own.',
    'one core is singular — the sentence is generated, not templated around a plural',
  );
});
