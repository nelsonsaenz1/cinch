/**
 * Audit 85 · no bare delta, and the card's arithmetic is the app's arithmetic.
 *
 * The defect these tests exist to prevent is a regression that costs one line:
 * somebody prints `+${gain.gain}` again, or worse, writes a "from" figure by
 * hand next to a computed "to". A delta with no base is unfalsifiable to the
 * reader, and a base computed twice is a base that can disagree with itself —
 * which is precisely what `outfit-count.ts`'s header says four screens quoting
 * four totals would do to the honesty the product rests on.
 *
 * So: every sentence must contain its unit and both of its endpoints, and the
 * base must equal `countOutfits(tally)` — not "be close to it", not "be
 * derived similarly".
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  baseOf,
  coreNoun,
  coresGloss,
  gainSentence,
  gapEvidence,
  gapProse,
  productReason,
} from '../src/components/gap-feed/gap-prose';
import {
  COUNTED_KINDS,
  countOutfits,
  gainFrom,
  rankGaps,
  type Tally,
} from '../src/features/closet/outfit-count';

const closet = (tops: number, bottoms: number, dresses: number, shoes: number): Tally => ({
  tops,
  bottoms,
  dresses,
  shoes,
});

/** Seven tops, two bottoms, one pair of shoes — 14 cores, 21 with one more bottom. */
const FIXTURE = closet(7, 2, 0, 1);
const THE_TEN = closet(3, 2, 1, 2);

test('the fixture closet really does produce the atlas 14 → 21, from countOutfits', () => {
  assert.equal(countOutfits(FIXTURE), 14);
  const gain = gainFrom(FIXTURE, 'bottoms');
  assert.equal(gain.total, 21);
  assert.equal(gain.gain, 7);
});

test('the atlas frame’s own illustration is NOT evaluable — which is why nothing copies it', () => {
  // "You own 4 tops … only 1 pair … 7 more outfit cores … 14 to 21."
  // The gain from one more bottom is exactly tops × shoes, so with 4 tops it
  // can only ever be a multiple of 4. This test is the record of that check;
  // if a future frame is drawn with real numbers it will simply keep passing.
  for (let shoes = 1; shoes <= 20; shoes++) {
    assert.notEqual(gainFrom(closet(4, 1, 0, shoes), 'bottoms').gain, 7);
  }
});

test('the gain sentence names its unit and BOTH endpoints', () => {
  const gain = gainFrom(FIXTURE, 'bottoms');
  const sentence = gainSentence(FIXTURE, gain, { gloss: true });

  assert.match(sentence, /7 more outfit cores/);
  assert.match(sentence, /complete top, bottom and shoe combinations/);
  assert.match(sentence, /taking you from 14 to 21\./);
  // The thing being replaced, in the shape it used to take.
  assert.doesNotMatch(sentence, /\+7/);
});

test('no sentence anywhere prints a bare delta, for any closet or any kind', () => {
  const closets: Tally[] = [
    FIXTURE,
    THE_TEN,
    closet(1, 1, 0, 1),
    closet(0, 0, 0, 0),
    closet(8, 1, 0, 1),
    closet(0, 3, 2, 0),
    closet(30, 30, 30, 30),
  ];

  for (const tally of closets) {
    for (const kind of COUNTED_KINDS) {
      const gain = gainFrom(tally, kind);
      for (const gloss of [true, false]) {
        const prose = gapProse(tally, gain, { gloss });

        // A "+N" is the exact shape of the figure audit 85 removed.
        assert.doesNotMatch(prose, /\+\d/, `bare delta in: ${prose}`);
        // Never an em-dash standing in for an omitted number.
        assert.doesNotMatch(prose, /\s—\s*\.$/, `dash as a figure in: ${prose}`);
        // The unit is always named.
        assert.match(prose, /outfit cores?/, `unit missing from: ${prose}`);
        // And the base is the app's base, every time.
        assert.equal(baseOf(tally, gain), countOutfits(tally));
        assert.match(
          prose,
          new RegExp(`\\b${countOutfits(tally)}\\b`),
          `base ${countOutfits(tally)} missing from: ${prose}`,
        );
      }
    }
  }
});

test('a gain of zero is printed as a zero with both endpoints, never omitted', () => {
  // A closet with no shoes makes nothing, and one more top still makes nothing.
  const noShoes = closet(4, 4, 0, 0);
  const gain = gainFrom(noShoes, 'tops');
  assert.equal(gain.gain, 0);

  const sentence = gainSentence(noShoes, gain);
  assert.match(sentence, /no new outfit cores/);
  assert.match(sentence, /stay at 0/);
});

test('the unit gloss admits dresses when the closet holds one, and not otherwise', () => {
  assert.equal(coresGloss(FIXTURE), 'complete top, bottom and shoe combinations');
  assert.equal(
    coresGloss(THE_TEN),
    'complete top, bottom and shoe combinations, or a dress with shoes',
  );
  // Because countOutfits really does count dress-and-shoe pairs as cores: the
  // gloss would understate the unit it has just promised to define.
  assert.equal(countOutfits(closet(0, 0, 2, 3)), 6);
});

test('coreNoun pluralises the unit and never abbreviates it', () => {
  assert.equal(coreNoun(1), 'outfit core');
  assert.equal(coreNoun(0), 'outfit cores');
  assert.equal(coreNoun(7), 'outfit cores');
});

test('evidence is computed from the tally and withheld when it would not be true', () => {
  assert.equal(
    gapEvidence(FIXTURE, gainFrom(FIXTURE, 'bottoms')),
    'You own 7 tops that work with bottoms and only 2 bottoms.',
  );
  // No tops: nothing is waiting for a bottom, so nothing is claimed.
  const noTops = closet(0, 1, 0, 1);
  assert.equal(gapEvidence(noTops, gainFrom(noTops, 'bottoms')), null);
  // Singulars agree with the count they describe.
  const one = closet(1, 1, 0, 1);
  assert.equal(
    gapEvidence(one, gainFrom(one, 'bottoms')),
    'You own 1 top that works with bottoms and only 1 bottom.',
  );
});

test('the product sheet restates the same arithmetic, never the catalogue', () => {
  const gain = gainFrom(FIXTURE, 'bottoms');
  const reason = productReason(FIXTURE, gain);
  assert.match(reason, /14 outfit cores to 21/);
  assert.doesNotMatch(reason, /\+\d/);
  // Nothing merchant-shaped can reach this string: it takes no product.
  assert.doesNotMatch(reason, /Everlane|Uniqlo|\$/);
});

test('baseOf refuses a base that disagrees with countOutfits', () => {
  const gain = { ...gainFrom(FIXTURE, 'bottoms'), total: 99 };
  let message = '';
  try {
    baseOf(FIXTURE, gain);
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  assert.match(message, /disagrees with countOutfits/);
});

test('the feed’s three cards all pass the same rule', () => {
  for (const gain of rankGaps(FIXTURE).slice(0, 3)) {
    const prose = gapProse(FIXTURE, gain, { gloss: false });
    assert.doesNotMatch(prose, /\+\d/);
    assert.match(prose, new RegExp(`\\b${countOutfits(FIXTURE)}\\b`));
  }
});
