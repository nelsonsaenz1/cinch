/**
 * K-04's research lines, K-05's headline and bag header, and K-06's second
 * failure — the arithmetic each sentence is built from.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bagHeaderLine,
  closetWeatherFit,
  firstUnfilledPart,
  forecastSummaryLine,
  garmentLabel,
  memoHeadline,
  shortfallSentence,
} from '../src/features/plan/packing-memo';
import type { PackedLook, PackedPiece } from '../src/features/plan/packing';
import type { Garment, WeatherContext } from '../src/lib/styling';

const garment = (id: string, overrides: Partial<Garment> = {}): Garment =>
  ({
    id,
    slot: 'base_top',
    category: 'top',
    subcategory: 'blouse',
    colors: [],
    warmth: 3,
    purchasePrice: null,
    wearCount: 0,
    ...overrides,
  }) as unknown as Garment;

const piece = (id: string, looks: number, worn: boolean, overrides: Partial<Garment> = {}): PackedPiece => ({
  garment: garment(id, overrides),
  looks,
  worn,
});

const weather = (overrides: Partial<WeatherContext> = {}): WeatherContext => ({
  feelsLikeC: 20,
  highC: 24,
  lowC: 16,
  precipitationChance: 0,
  windKph: 8,
  swing: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// garmentLabel
// ---------------------------------------------------------------------------

test('garmentLabel capitalises the subcategory', () => {
  assert.equal(garmentLabel(garment('a', { subcategory: 'linen blouse' })), 'Linen blouse');
});

test('garmentLabel falls back to the category when there is no subcategory', () => {
  assert.equal(garmentLabel(garment('a', { subcategory: null, category: 'top' })), 'Top');
});

// ---------------------------------------------------------------------------
// bagHeaderLine — §2.5: printed or dropped, never averaged from partial data
// ---------------------------------------------------------------------------

test('the bag header is the piece count alone when any piece has no price', () => {
  const items = [
    piece('a', 3, false, { purchasePrice: 68, wearCount: 5 }),
    piece('b', 4, false, { purchasePrice: null, wearCount: 2 }),
  ];
  assert.equal(bagHeaderLine(items), '2 pieces');
});

test('the bag header carries a real per-wear figure once every piece is priced', () => {
  const items = [
    piece('a', 3, false, { purchasePrice: 100, wearCount: 10 }), // $10/wear
    piece('b', 4, false, { purchasePrice: 50, wearCount: 5 }), // $10/wear
  ];
  // (100 + 50) / (10 + 5) = 10.00 — total spend over total wears of THESE
  // pieces, never a per-piece average.
  assert.equal(bagHeaderLine(items), '2 pieces · $10.00 per wear');
});

test('a priced piece nobody has worn yet drops the fragment rather than dividing by zero', () => {
  const items = [piece('a', 1, false, { purchasePrice: 40, wearCount: 0 })];
  assert.equal(bagHeaderLine(items), '1 piece');
});

test('an empty bag is just the count', () => {
  assert.equal(bagHeaderLine([]), '0 pieces');
});

// ---------------------------------------------------------------------------
// memoHeadline
// ---------------------------------------------------------------------------

test('K-05: "Eleven pieces, eight looks, one bag."', () => {
  assert.equal(memoHeadline(11, 8), 'Eleven pieces, eight looks, one bag.');
});

test('memoHeadline keeps singular pieces and looks honest', () => {
  assert.equal(memoHeadline(1, 1), 'One piece, one look, one bag.');
});

// ---------------------------------------------------------------------------
// K-06 · Failure 2 — the honest shortfall, never rounded
// ---------------------------------------------------------------------------

test('K-06: "Six looks, not eight — you don\'t own anything that works for evenings."', () => {
  assert.equal(
    shortfallSentence(8, 2, 'evening'),
    "Six looks, not eight — you don’t own anything that works for evenings.",
  );
});

test('shortfallSentence with no identifiable gap still states the real numbers', () => {
  assert.equal(
    shortfallSentence(4, 4, null),
    "Zero looks, not four — your closet doesn’t have enough pieces for every look this trip needs.",
  );
});

test('firstUnfilledPart names the first look the closet could not fill', () => {
  const looks: PackedLook[] = [
    { dayIndex: 0, date: '2026-09-12', part: 'daytime', weather: null, outfit: {} as PackedLook['outfit'] },
    { dayIndex: 0, date: '2026-09-12', part: 'evening', weather: null, outfit: null },
  ];
  assert.equal(firstUnfilledPart(looks), 'evening');
});

test('firstUnfilledPart is null when nothing failed', () => {
  const looks: PackedLook[] = [
    { dayIndex: 0, date: '2026-09-12', part: 'daytime', weather: null, outfit: {} as PackedLook['outfit'] },
  ];
  assert.equal(firstUnfilledPart(looks), null);
});

// ---------------------------------------------------------------------------
// K-04 — the research lines
// ---------------------------------------------------------------------------

test('forecastSummaryLine states the real range and counts wet days honestly', () => {
  const forecasts = [
    weather({ lowC: 19, highC: 24, precipitationChance: 0.1 }),
    weather({ lowC: 20, highC: 27, precipitationChance: 0.6 }),
  ];
  // Fahrenheit, like every other temperature in the app — the atlas's °C is a
  // mock in the designer's units, and two scales in one app is the bug.
  assert.equal(forecastSummaryLine(forecasts), '66–81°, one wet day.');
  assert.equal(forecastSummaryLine(forecasts, 'C'), '19–27°, one wet day.');
});

test('forecastSummaryLine says "no wet days" rather than "zero"', () => {
  const forecasts = [weather({ lowC: 10, highC: 15, precipitationChance: 0 })];
  assert.equal(forecastSummaryLine(forecasts, 'C'), '10–15°, no wet days.');
});

test('closetWeatherFit counts only the pieces whose warmth suits the real forecast', () => {
  const wardrobe = [
    garment('cold', { warmth: 5 }),
    garment('mid', { warmth: 3 }),
    garment('hot', { warmth: 1 }),
  ];
  // A warm-band forecast (20–30°C) wants low-warmth pieces; the heaviest piece
  // in the wardrobe should be the one left out.
  const forecasts = [weather({ lowC: 20, highC: 30 })];
  const fit = closetWeatherFit(wardrobe, forecasts);
  assert.equal(fit.total, 3);
  assert.ok(fit.suitable < fit.total, 'the coldest-rated piece should not count as right for a warm trip');
});
