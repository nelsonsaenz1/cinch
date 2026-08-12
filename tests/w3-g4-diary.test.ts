/**
 * Wave 3 · Group 4 — the wear diary's new derivations.
 *
 * Atlas: `docs/design/wave-3-final/Wave 3 - Design · Consent, Privacy, Diary,
 * Plan, Packing.dc.html`, frames WD-01, WD-02 and WD-03 (audit 77, 78).
 *
 * Everything here is a PURE function out of `features/diary/entry.ts`. What is worth holding is the arithmetic that is
 * easy to break by accident and expensive to notice: a cost figure computed off
 * a partly-priced look, a total that stops following its filter, a countdown
 * that rounds up, and an undo notice that describes counts it did not move.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ALL_YEARS,
  THIS_YEAR,
  correctionWindowLine,
  diaryTotalLine,
  entryWeatherLine,
  hoursLeftToCorrect,
  lookCostPerWear,
  ordinalWear,
  plannedLine,
  plannedMeta,
  provenanceLine,
  rowLine,
  rowMeta,
  undoneNotice,
  weatherFromSnapshot,
} from '../src/features/diary/entry';
import type { DiaryEntry, DiaryPiece } from '../src/features/diary/types';

const piece = (over: Partial<DiaryPiece> = {}): DiaryPiece => ({
  id: 'p',
  kind: 'merino crewneck',
  category: 'other',
  colorName: 'navy',
  brand: null,
  wearCount: 5,
  purchasePrice: null,
  imagePaths: [],
  ...over,
});

const entry = (over: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'e',
  wornAt: '2026-08-06T09:41:00',
  name: null,
  occasion: null,
  note: null,
  savedAt: null,
  originOutfitId: null,
  source: 'ai',
  pieces: [piece()],
  ...over,
});

// ---------------------------------------------------------------------------
// WD-01 — the cost half is printed or dropped, never estimated
// ---------------------------------------------------------------------------

test('the look cost is all-or-nothing across the pieces', () => {
  // The atlas's own figure, arrived at by division: $1,070 over 500 wears.
  const priced = entry({
    pieces: [
      piece({ id: 'a', purchasePrice: 348, wearCount: 96 }),
      piece({ id: 'b', purchasePrice: 298, wearCount: 130 }),
      piece({ id: 'c', purchasePrice: 210, wearCount: 84 }),
      piece({ id: 'd', purchasePrice: 124, wearCount: 110 }),
      piece({ id: 'e', purchasePrice: 90, wearCount: 80 }),
    ],
  });
  assert.equal(lookCostPerWear(priced)!.toFixed(2), '2.14');

  // One null price and the whole figure goes. Summing the priced half would
  // print a number that is smaller than the truth and looks exact.
  const mixed = entry({
    pieces: [
      piece({ id: 'a', purchasePrice: 348, wearCount: 96 }),
      piece({ id: 'b', purchasePrice: null, wearCount: 130 }),
    ],
  });
  assert.equal(lookCostPerWear(mixed), null);

  // Priced but never worn: dividing by zero is not a cost per wear.
  assert.equal(
    lookCostPerWear(entry({ pieces: [piece({ purchasePrice: 348, wearCount: 0 })] })),
    null,
  );

  // No pieces left in the closet at all.
  assert.equal(lookCostPerWear(entry({ pieces: [] })), null);
});

test('the standing count is an ordinal, and English is irregular', () => {
  assert.equal(ordinalWear(1), '1st wear');
  assert.equal(ordinalWear(2), '2nd wear');
  assert.equal(ordinalWear(3), '3rd wear');
  assert.equal(ordinalWear(7), '7th wear');
  // The teens are the trap: 11th, 12th, 13th, not 11st/12nd/13rd.
  assert.equal(ordinalWear(11), '11th wear');
  assert.equal(ordinalWear(12), '12th wear');
  assert.equal(ordinalWear(13), '13th wear');
  assert.equal(ordinalWear(21), '21st wear');
  assert.equal(ordinalWear(111), '111th wear');
});

// ---------------------------------------------------------------------------
// WD-01 — the masthead total follows the filter
// ---------------------------------------------------------------------------

test('the total follows the filter, and never mixes two scopes in one sentence', () => {
  const now = new Date('2026-08-06T19:41:00');
  const entries = [
    entry({ id: '1', wornAt: '2026-08-06T09:41:00' }),
    entry({ id: '2', wornAt: '2026-03-14T09:41:00' }),
    entry({ id: '3', wornAt: '2025-11-02T09:41:00' }),
  ];

  // All time: the "since" month is the OLDEST row's, so no account-creation
  // date is invented for it — and the year is said because it is not this one.
  assert.equal(diaryTotalLine(entries, ALL_YEARS, now), '3 wears since November 2025');

  // Filtered: the figure is the filtered one, and the wording changes with it.
  assert.equal(diaryTotalLine(entries.slice(0, 2), THIS_YEAR, now), '2 wears in 2026');
  assert.equal(diaryTotalLine(entries.slice(2), '2025', now), '1 wear in 2025');

  // This year's oldest row is in this year, so the year is left off.
  assert.equal(
    diaryTotalLine(entries.slice(0, 2), ALL_YEARS, now),
    '2 wears since March',
  );

  // Zero is quiet.
  assert.equal(diaryTotalLine([], ALL_YEARS, now), null);
});

test('a planned day is never counted as a wear', () => {
  const now = new Date('2026-08-06T19:41:00');
  const spine = [
    entry({ id: 'plan', wornAt: '2026-08-08T12:00:00', planned: true }),
    entry({ id: 'worn', wornAt: '2026-08-06T09:41:00' }),
  ];
  assert.equal(diaryTotalLine(spine, THIS_YEAR, now), '1 wear in 2026');
});

// ---------------------------------------------------------------------------
// WD-03 — a plan is a different kind of row
// ---------------------------------------------------------------------------

test('a planned row leads with the word, in its name and in its metadata', () => {
  const plan = entry({
    planned: true,
    wornAt: '2026-08-08T12:00:00',
    name: 'the overcoat with the black jeans',
  });

  assert.equal(plannedLine(plan), 'Planned: the overcoat with the black jeans');
  assert.equal(plannedMeta(plan), 'Planned for Saturday — not worn yet');

  // And the row selectors route to them, so nothing can draw a plan as a wear.
  assert.equal(rowLine(plan), 'Planned: the overcoat with the black jeans');
  assert.equal(rowMeta(plan), 'Planned for Saturday — not worn yet');
});

test('an unnamed plan still says what it is', () => {
  const plan = entry({
    planned: true,
    pieces: [piece({ id: 'a', kind: 'overshirt' }), piece({ id: 'b', kind: 'straight jeans' })],
  });
  assert.equal(plannedLine(plan), 'Planned: overshirt with the straight jeans');
});

// ---------------------------------------------------------------------------
// WD-02 — the 24-hour rule, stated and counted
// ---------------------------------------------------------------------------

test('the countdown is floored, so it never promises time the server will refuse', () => {
  const worn = '2026-08-06T09:41:00';

  // Ten hours in: fourteen left, which is the atlas's own figure.
  assert.equal(hoursLeftToCorrect(worn, new Date('2026-08-06T19:41:00')), 14);

  // 13h59m left floors to 13, never rounds up to 14.
  assert.equal(hoursLeftToCorrect(worn, new Date('2026-08-06T19:42:00')), 13);

  // Past the window there is no negative time.
  assert.equal(hoursLeftToCorrect(worn, new Date('2026-08-08T09:41:00')), 0);
});

test('under an hour the line changes shape rather than printing a nought', () => {
  const worn = '2026-08-06T09:41:00';

  assert.equal(
    correctionWindowLine(worn, new Date('2026-08-06T19:41:00')),
    'You can undo a wear for 24 hours after it is recorded. This one has 14 hours left.',
  );
  assert.match(correctionWindowLine(worn, new Date('2026-08-07T09:00:00')), /less than an hour left/);
  // One hour exactly is still an hour, and it is singular.
  assert.match(correctionWindowLine(worn, new Date('2026-08-07T08:41:00')), /has 1 hour left/);
});

// ---------------------------------------------------------------------------
// WD-02 — the three facts, printed when known and absent when not
// ---------------------------------------------------------------------------

test('the weather row is dropped whenever the snapshot did not carry one', () => {
  assert.equal(entryWeatherLine(null), null);
  assert.equal(entryWeatherLine(undefined), null);

  assert.equal(
    entryWeatherLine({
      feelsLikeC: 22,
      highC: 26,
      lowC: 14,
      precipitationChance: 0.05,
      windKph: 9,
      swing: false,
    }),
    '72° · mild',
  );
});

test('a half-written context snapshot reads as no weather at all', () => {
  // `p_context` is client-supplied jsonb whose shape has changed across builds,
  // and two call sites pass null outright. Anything that is not a complete
  // reading is refused, rather than printing a temperature with an invented
  // range behind it.
  assert.equal(weatherFromSnapshot(null), null);
  assert.equal(weatherFromSnapshot({}), null);
  assert.equal(weatherFromSnapshot({ weather: null }), null);
  assert.equal(weatherFromSnapshot({ weather: { feelsLikeC: 22 } }), null);
  assert.equal(
    weatherFromSnapshot({ weather: { feelsLikeC: 'warm', highC: 26, lowC: 14, precipitationChance: 0, windKph: 9 } }),
    null,
  );

  assert.deepEqual(
    weatherFromSnapshot({
      weather: { feelsLikeC: 22, highC: 26, lowC: 14, precipitationChance: 0.05, windKph: 9, swing: false },
      events: [],
    }),
    { feelsLikeC: 22, highC: 26, lowC: 14, precipitationChance: 0.05, windKph: 9, swing: false },
  );
});

test('provenance is read off columns that already exist', () => {
  assert.equal(provenanceLine(entry({ source: 'ai' })), 'Today’s plate');
  assert.equal(provenanceLine(entry({ source: 'user' })), 'Chosen by you');
  // `origin_outfit_id` is set only by a wear that came out of a kept plate, and
  // it wins over the source because it is the more specific fact.
  assert.equal(provenanceLine(entry({ source: 'ai', originOutfitId: 'x' })), 'A plate you had kept');
});

// ---------------------------------------------------------------------------
// WD-03 — the undo names both figures it moved
// ---------------------------------------------------------------------------

test('a one-piece undo names the piece, its new count and the new total', () => {
  assert.equal(
    undoneNotice({
      weekday: 'Tuesday',
      pieces: [{ word: 'merino crewneck', wearCount: 5 }],
      totalLine: '188 wears in 2026',
    }),
    'Tuesday’s merino crewneck is back to 4 wears, and the record now reads 188 wears in 2026. The piece is untouched.',
  );
});

test('a multi-piece undo states the one thing that is true of all of them', () => {
  // Four counts in one sentence is not a sentence. `unwear_outfit_tx`
  // decrements every piece by exactly one, so that is what gets said.
  assert.equal(
    undoneNotice({
      weekday: 'Thursday',
      pieces: [
        { word: 'shearling coat', wearCount: 96 },
        { word: 'tailored trousers', wearCount: 130 },
      ],
      totalLine: '611 wears since March',
    }),
    'Thursday’s 2 pieces are each back one wear, and the record now reads 611 wears since March. The pieces themselves are untouched.',
  );
});

test('an emptied record still gets an honest notice', () => {
  // The last wear undone leaves no total to quote, and the sentence loses that
  // clause rather than printing a nought.
  assert.equal(
    undoneNotice({
      weekday: 'Sunday',
      pieces: [{ word: 'linen blouse', wearCount: 1 }],
      totalLine: null,
    }),
    'Sunday’s linen blouse is back to 0 wears. The piece is untouched.',
  );
});
