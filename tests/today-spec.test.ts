/**
 * Today — the decisions the morning makes before it draws. Redesign 11.
 *
 * Everything asserted here is a pure function in `features/today/today-spec.ts`,
 * imported and exercised directly. Nothing in this file reads a `.tsx`: the
 * page's DRAWING is `tests/today-redesign-11.test.ts`, and its analytics are
 * `tests/today-analytics.test.ts`. Three files because they fail for three
 * different reasons.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PLANS } from '../src/features/billing/plans';
import { MIN_CLOSET_FOR_OUTFITS } from '../src/features/styling/thresholds';
import {
  DEFAULT_CONTEXT,
  FEEL_OPTIONS,
  OCCASION_OPTIONS,
  PLATE_COUNT,
  TODAY_ACTIVATION_FLOOR,
  TODAY_COPY,
  WEATHER_STALE_AFTER_MS,
  asOfLabel,
  belowActivationFloor,
  engineFormality,
  engineOccasion,
  exhaustedBody,
  feelLabel,
  isThinWardrobe,
  occasionLabel,
  pageFromOffset,
  piecesLine,
  piecesRemaining,
  positionLabel,
  resolveWeather,
} from '../src/features/today/today-spec';

// ---------------------------------------------------------------------------
// The activation floor — ten, and the reason it is not eight
// ---------------------------------------------------------------------------

test('the floor is the free tier’s ten, not the engine’s eight', () => {
  assert.equal(TODAY_ACTIVATION_FLOOR, PLANS.free.items);
  assert.equal(TODAY_ACTIVATION_FLOOR, 10);
  // The engine floor is untouched. It is a different question — "can a beam
  // search find anything at all" — and it still governs the stylist, packing
  // and the help article.
  assert.equal(MIN_CLOSET_FOR_OUTFITS, 8);
  assert.notEqual(TODAY_ACTIVATION_FLOOR, MIN_CLOSET_FOR_OUTFITS);
});

test('the sentence and the gate agree at every count', () => {
  // This is the defect redesign 11 was told to fix, stated as a table. Before
  // it, eight and nine got outfits under a screen that said ten.
  for (let n = 0; n < 10; n += 1) {
    assert.equal(belowActivationFloor(n, true), true, `a closet of ${n} was let through`);
  }
  assert.equal(belowActivationFloor(10, true), false);
  assert.equal(belowActivationFloor(40, true), false);
});

test('a big closet the engine cannot build from still lands on the floor', () => {
  // Ten jumpers is not a morning. The count is not the only condition.
  assert.equal(belowActivationFloor(40, false), true);
});

test('the floor’s title is the accepted sentence, and its ten is derived', () => {
  assert.equal(TODAY_COPY.floorTitle, 'Start with ten pieces');
  // Derived, so the words cannot outlive the number: change the free tier and
  // this assertion is what breaks, rather than a screen quietly lying.
  assert.ok(TODAY_COPY.floorTitle.includes('ten'));
  assert.equal(PLANS.free.items, 10);
});

test('what is left to add is the reader’s own remainder, never negative', () => {
  assert.equal(piecesRemaining(0), 10);
  assert.equal(piecesRemaining(3), 7);
  assert.equal(piecesRemaining(10), 0);
  assert.equal(piecesRemaining(45), 0, 'a full closet was told it owed pieces');
});

// ---------------------------------------------------------------------------
// The chips reach the scorer — the whole point of replacing the field
// ---------------------------------------------------------------------------

test('every occasion but “no plans” carries a target the scorer reads', () => {
  for (const option of OCCASION_OPTIONS) {
    const engine = engineOccasion(option.id);
    if (option.id === 'no_plans') {
      // Not an occasion. A null target is neutral in `occasionRule`, which is
      // exactly right: no plans must not be scored as a plan called "none".
      assert.equal(engine, null);
    } else {
      assert.equal(typeof engine, 'string');
      assert.ok((engine as string).length > 0, `${option.id} steers nothing`);
    }
  }
});

test('every feel carries a formality the scorer reads', () => {
  for (const option of FEEL_OPTIONS) {
    const formality = engineFormality(option.id);
    assert.equal(typeof formality, 'number');
    assert.ok(
      (formality as number) > 0 && (formality as number) <= 1,
      `${option.id} is outside the 0..1 the scorer normalises on`,
    );
  }
});

test('sharp is dressier than easy, which is the only ordering a reader can feel', () => {
  assert.ok((engineFormality('sharp') as number) > (engineFormality('easy') as number));
});

test('the default context asks for nothing in particular', () => {
  assert.equal(DEFAULT_CONTEXT.occasion, 'no_plans');
  assert.equal(engineOccasion(DEFAULT_CONTEXT.occasion), null);
});

test('every option has a label, and the labels are sentences not slugs', () => {
  for (const option of OCCASION_OPTIONS) {
    assert.equal(occasionLabel(option.id), option.label);
    assert.doesNotMatch(option.label, /_/, `${option.id} shows its slug`);
  }
  for (const option of FEEL_OPTIONS) {
    assert.equal(feelLabel(option.id), option.label);
    assert.doesNotMatch(option.label, /_/, `${option.id} shows its slug`);
  }
});

// ---------------------------------------------------------------------------
// Weather — four states, all truthful, none of them invented
// ---------------------------------------------------------------------------

const NOW = new Date('2026-08-18T09:00:00Z');
const READING = { conditionLabel: 'Grey', temperatureLabel: '63°', now: NOW };

test('a fresh reading is ok, and says what it is', () => {
  const read = resolveWeather({
    ...READING,
    fetchedAt: new Date(NOW.getTime() - 5 * 60 * 1000),
    permissionOff: false,
    failed: false,
  });
  assert.equal(read.state, 'ok');
  assert.ok(read.chip);
  assert.ok((read.chip as string).includes('63°'));
});

test('an old reading is stale, keeps its words, and gains an hour', () => {
  const read = resolveWeather({
    ...READING,
    fetchedAt: new Date(NOW.getTime() - WEATHER_STALE_AFTER_MS - 1),
    permissionOff: false,
    failed: false,
  });
  assert.equal(read.state, 'stale');
  // The honest answer to a two-hour-old reading is not to drop it — a reader
  // can see out of a window — it is to DATE it.
  assert.ok(read.mark, 'a stale reading lost its mark entirely');
  assert.match(read.mark as string, /as of/i);
});

test('permission not given is “off”, and off is not “unavailable”', () => {
  const read = resolveWeather({
    ...READING,
    fetchedAt: new Date(NOW.getTime() - 60_000),
    permissionOff: true,
    failed: false,
  });
  assert.equal(read.state, 'off');
  // Two different facts: a permission this reader has not given, and a reading
  // this device could not get. Collapsing them would blame the wrong thing.
  assert.notEqual(read.state, 'unavailable');
});

test('a failed fetch is “unavailable”, and invents no temperature', () => {
  const read = resolveWeather({
    conditionLabel: null,
    temperatureLabel: null,
    fetchedAt: null,
    permissionOff: false,
    failed: true,
    now: NOW,
  });
  assert.equal(read.state, 'unavailable');
  assert.equal(read.chip, null);
  assert.equal(read.mark, null);
});

test('no reading at all never renders a dash or a zero', () => {
  const read = resolveWeather({
    conditionLabel: null,
    temperatureLabel: null,
    fetchedAt: null,
    permissionOff: false,
    failed: false,
    now: NOW,
  });
  assert.equal(read.chip, null, 'a known-unknown was estimated');
  assert.equal(read.mark, null);
});

test('the stale threshold is stated in whole minutes a person could argue with', () => {
  assert.equal(WEATHER_STALE_AFTER_MS, 90 * 60 * 1000);
});

test('the as-of hour is an hour, never a timestamp', () => {
  const label = asOfLabel(new Date('2026-08-18T07:12:00'));
  assert.match(label, /^\d{1,2}(am|pm)$/i, label);
  // No minutes, no seconds, no date — anything more precise is a movement log.
  assert.doesNotMatch(label, /:/);
});

// ---------------------------------------------------------------------------
// The carousel — three cards, a position, and no count anywhere
// ---------------------------------------------------------------------------

test('there are three plates, and the number is stated once', () => {
  assert.equal(PLATE_COUNT, 3);
});

test('a swipe lands on a page, and never between two', () => {
  assert.equal(pageFromOffset(0, 390), 1);
  assert.equal(pageFromOffset(390, 390), 2);
  assert.equal(pageFromOffset(780, 390), 3);
  // Mid-drag: the NEARER page wins rather than the arithmetic floor, which is
  // what stops a swipe most of the way to card three reporting card two. Only
  // settled offsets reach this in practice — `onMomentumScrollEnd` fires after
  // the snap — so this is the defensive half, and it should still round rather
  // than truncate.
  assert.equal(pageFromOffset(560, 390), 2, 'still nearer card two');
  assert.equal(pageFromOffset(620, 390), 3, 'already nearer card three');
});

test('a swipe past the end is clamped rather than reported as a fourth card', () => {
  assert.equal(pageFromOffset(2000, 390), 3);
  assert.equal(pageFromOffset(-200, 390), 1);
});

test('a zero page width cannot divide by zero', () => {
  assert.equal(pageFromOffset(100, 0), 1);
});

test('position is spoken as a position, not as a tally', () => {
  assert.equal(positionLabel(1), 'card 1 of 3');
  assert.equal(positionLabel(2), 'card 2 of 3');
  assert.equal(positionLabel(3), 'card 3 of 3');
});

test('a thin wardrobe is fewer than three cards, and no cards is not thin', () => {
  assert.equal(isThinWardrobe(0), false, 'a refusal was reported as a thin wardrobe');
  assert.equal(isThinWardrobe(1), true);
  assert.equal(isThinWardrobe(2), true);
  assert.equal(isThinWardrobe(3), false);
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

test('nothing on this screen prints a count, a score, a streak or a price', () => {
  const words = Object.values(TODAY_COPY).join(' ');
  assert.doesNotMatch(words, /\b\d+%|\bstreak|\bscore\b|\bpoints\b|\brank/i, words);
  assert.doesNotMatch(words, /\$|£|€/, words);
  // "ten" is the one number, spelled, and it is an instruction rather than a
  // measurement of the reader.
  assert.doesNotMatch(words, /\b\d+ (outfits|looks|pieces|wears)\b/i, words);
});

test('no sentence leads with the model', () => {
  const words = Object.values(TODAY_COPY).join(' ');
  assert.doesNotMatch(words, /\bAI\b|artificial intelligence|\bGPT|\bmodel\b/i, words);
});

test('the exhausted sentence describes a day rather than counting one', () => {
  const body = exhaustedBody('Grey', 'Dinner out');
  assert.match(body, /grey and dinner out/);
  assert.doesNotMatch(body, /\d/, body);
});

test('the exhausted sentence still reads with no weather', () => {
  const body = exhaustedBody(null, 'Office');
  assert.match(body, /office/);
  assert.doesNotMatch(body, /null|undefined/, body);
});

test('an unrated wear is legal, and the sheet says so', () => {
  assert.match(TODAY_COPY.ratingOptional, /don’t have to/i);
  assert.match(TODAY_COPY.confirmBody, /rate it now or not at all/i);
});

test('a failed wear promises no duplicate and keeps what was typed', () => {
  assert.match(TODAY_COPY.wearFailedBody, /nothing was recorded twice/i);
  assert.match(TODAY_COPY.wearFailedBody, /rating is still here/i);
  assert.ok(TODAY_COPY.wearFailedRetry.length > 0, 'a failed write offered no retry');
});

test('offline says which of two offlines it is', () => {
  assert.notEqual(TODAY_COPY.offlineCachedBody, TODAY_COPY.offlineNoCacheBody);
  assert.match(TODAY_COPY.offlineCachedBody, /already on this phone/i);
  assert.match(TODAY_COPY.offlineNoCacheBody, /has not been read on this phone/i);
});

// ---------------------------------------------------------------------------
// The pieces line
// ---------------------------------------------------------------------------

const piece = (subcategory: string | null, colour: string | null) => ({
  category: 'top',
  subcategory,
  colors: colour ? [{ name: colour }] : [],
});

test('the pieces line reads as one outfit rather than three proper nouns', () => {
  const line = piecesLine([
    piece('coat', 'wool'),
    piece('shirt', 'linen'),
    piece('boots', 'black'),
  ]);
  assert.equal(line, 'Wool coat, linen shirt, black boots');
});

test('an untagged piece falls back to the same neutral word as everywhere else', () => {
  const line = piecesLine([piece(null, null), piece('shirt', 'linen')]);
  // Whatever the closet calls an untagged piece, this calls it too — and it is
  // never blank, never "null", and never an inference about what it might be.
  assert.ok(line.length > 0);
  assert.doesNotMatch(line, /null|undefined/, line);
  assert.match(line, /linen shirt/);
});

test('an empty outfit produces an empty line rather than a crash', () => {
  assert.equal(piecesLine([]), '');
});
