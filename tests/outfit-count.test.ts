/**
 * The counting function, held against every number printed in the five
 * free-tier atlases.
 *
 * These are not invented cases. Each row is a figure a shipped screen quotes at
 * the user, so a failure here means a screen is about to lie. The atlases live
 * in design-refs/html/; the contract is docs/design/free-tier-contract.md.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  countOutfits,
  gainFrom,
  kindOfSlot,
  missingForFirstOutfit,
  rankGaps,
  tallyOf,
  type Tally,
} from '../src/features/closet/outfit-count';
import { garment } from './helpers';

const closet = (tops: number, bottoms: number, dresses: number, shoes: number): Tally => ({
  tops,
  bottoms,
  dresses,
  shoes,
});

/** The canonical free closet: 3 tops, 2 bottoms, 1 dress, 2 shoes, 1 coat, 1 bag. */
const THE_TEN = closet(3, 2, 1, 2);

test('every count printed in the five atlases', () => {
  const cases: Array<[Tally, number, string]> = [
    [THE_TEN, 14, 'The Ten · The Reveal R-02 — "Ten pieces. Fourteen outfits."'],
    [closet(4, 2, 0, 2), 16, 'The Ten T-04 · The Reveal R-04 — a fourth top instead of the dress'],
    [closet(3, 3, 0, 2), 18, 'The Ten T-04 — a third bottom instead of the dress'],
    [closet(3, 2, 0, 2), 12, 'The Ten T-04 — "keep the slot open", finish with nine'],
    [closet(3, 2, 1, 3), 21, 'The Gap Feed · The Wall — a second pair of shoes'],
    [closet(3, 3, 1, 2), 20, 'The Gap Feed — a third bottom'],
    [closet(4, 2, 1, 2), 18, 'The Gap Feed — a fourth top'],
    [closet(3, 2, 2, 2), 16, 'The Gap Feed — a second dress'],
    [closet(10, 0, 0, 0), 0, 'The Reveal R-05 — ten tops and nothing else'],
  ];

  for (const [t, expected, source] of cases) {
    assert.equal(countOutfits(t), expected, source);
  }
});

test('coats and bags never change the count', () => {
  // Not expressible as a Tally at all, which is the design: the eleventh piece
  // being a second coat honestly adds nothing, and The Wall says so rather than
  // quoting a better number borrowed from a different garment.
  const withCoatAndBag = tallyOf([
    ...Array.from({ length: 3 }, () => garment('base_top', 'white')),
    ...Array.from({ length: 2 }, () => garment('bottom', 'charcoal')),
    garment('dress', 'olive'),
    ...Array.from({ length: 2 }, () => garment('footwear', 'brown')),
    garment('outerwear', 'cognac'),
    garment('bag', 'cognac'),
  ]);
  assert.deepEqual(withCoatAndBag, THE_TEN);
  assert.equal(countOutfits(withCoatAndBag), 14);
});

test('a knit counts as a top', () => {
  // 'cream mohair jumper' is one of the atlas ten's three tops and routes to
  // mid_layer. Counting it as anything else takes the canonical closet to 10,
  // and the headline number in the product becomes unreachable.
  assert.equal(kindOfSlot('mid_layer'), 'tops');

  const knitwear = tallyOf([
    garment('base_top', 'white'),
    garment('mid_layer', 'cream'),
    garment('base_top', 'black'),
    garment('bottom', 'charcoal'),
    garment('bottom', 'beige'),
    garment('dress', 'olive'),
    garment('footwear', 'brown'),
    garment('footwear', 'black'),
  ]);
  assert.equal(knitwear.tops, 3);
  assert.equal(countOutfits(knitwear), 14);
});

test('the gap ranking the feed prints, in order', () => {
  const ranked = rankGaps(THE_TEN);

  // G-01 ranks shoes, then a bottom, then a top — by computed gain, never
  // reshuffled for conversion.
  assert.deepEqual(
    ranked.map((g) => [g.kind, g.total, g.gain]),
    [
      ['shoes', 21, 7],
      ['bottoms', 20, 6],
      ['tops', 18, 4],
      ['dresses', 16, 2],
    ],
  );
});

test('an unbalanced closet: one gap dominates', () => {
  // The Gap Feed G-05. The atlas prose quotes 3 outfits rising to 6; the
  // arithmetic for eight tops over one bottom and one pair of shoes is 8 rising
  // to 16. The prose is right in shape — a second bottom doubles everything —
  // and wrong in arithmetic, so the state is built and the numbers computed.
  const unbalanced = closet(8, 1, 0, 1);
  assert.equal(countOutfits(unbalanced), 8);

  // The atlas nominates the bottom. Arithmetically a second bottom and a second
  // pair of shoes BOTH double this closet — 8 to 16 either way — so the choice
  // in the rendering is illustration, not computation, and the feed must not
  // pretend one dominates. Both lead, tied.
  const ranked = rankGaps(unbalanced);
  assert.deepEqual(
    ranked.slice(0, 2).map((g) => [g.kind, g.gain]).sort(),
    [
      ['bottoms', 8],
      ['shoes', 8],
    ].sort(),
  );

  // "a ninth top adds nothing at all until there's something new to wear it
  // with" — the atlas's own words, and the arithmetic agrees.
  assert.equal(gainFrom(unbalanced, 'tops').gain, 1);
});

test('nothing to build with names exactly what is missing', () => {
  assert.deepEqual(missingForFirstOutfit(closet(10, 0, 0, 0)), ['shoes', 'bottoms']);
  assert.deepEqual(missingForFirstOutfit(closet(0, 0, 1, 0)), ['shoes']);
  assert.deepEqual(missingForFirstOutfit(THE_TEN), []);
});

test('a gain is never negative', () => {
  for (const t of [closet(0, 0, 0, 0), closet(1, 0, 0, 0), THE_TEN]) {
    for (const g of rankGaps(t)) assert.ok(g.gain >= 0, `${g.kind} gained ${g.gain}`);
  }
});
