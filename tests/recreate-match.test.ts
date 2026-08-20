/**
 * The recreate matcher — the on-device half of "Recreate this look".
 *
 * What is under proof is the feature's one promise: the closest version of
 * the inspiration FROM CLOTHES THE PERSON OWNS, with an honest gap wherever
 * nothing close exists. So these tests pin both sides of the threshold, the
 * one-garment-one-piece rule, and the accessory kind gate — the places where
 * a plausible-looking match would be a lie.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MATCH_THRESHOLD,
  colorScore,
  kindScore,
  matchInspiration,
  scoreCandidate,
} from '../src/features/recreate/match';
import type { InspirationPiece } from '../src/features/recreate/types';
import { garment, resetIds } from './helpers';

function piece(overrides: Partial<InspirationPiece> = {}): InspirationPiece {
  return {
    category: 'top',
    subcategory: 't-shirt',
    colorNames: ['white'],
    pattern: null,
    patternScale: 'none',
    formalityScore: 2,
    description: 'A plain white t-shirt.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The signals
// ---------------------------------------------------------------------------

test('the synonym fold makes "tee" find a t-shirt and "trainers" find sneakers', () => {
  resetIds();
  const tshirt = garment('base_top', 'white', { subcategory: 't-shirt' });
  const sneakers = garment('footwear', 'white', { subcategory: 'sneakers' });

  assert.equal(kindScore(piece({ subcategory: 'tee' }), tshirt), 1);
  assert.equal(
    kindScore(piece({ category: 'footwear', subcategory: 'trainers' }), sneakers),
    1,
  );
});

test('colour words never vote in the kind signal — that evidence is counted once', () => {
  resetIds();
  const navy = garment('base_top', 'navy', { subcategory: 'navy t-shirt' });
  // "white tee" against "navy t-shirt": the nouns agree perfectly, and the
  // colour disagreement is the colour signal's job alone.
  assert.equal(kindScore(piece({ subcategory: 'white tee' }), navy), 1);
});

test('an unresolvable colour name reads as unknown, never as wrong', () => {
  resetIds();
  const g = garment('base_top', 'white');
  assert.equal(colorScore(piece({ colorNames: ['glimmering zephyr'] }), g), 0.5);
});

// ---------------------------------------------------------------------------
// The threshold — both sides of the line
// ---------------------------------------------------------------------------

test('the right kind in the WRONG colour is a gap, not a match', () => {
  resetIds();
  const blackDress = garment('dress', 'black', { subcategory: 'slip dress', formality: 4 });
  const redDress = piece({
    category: 'dress',
    subcategory: 'slip dress',
    colorNames: ['red'],
    formalityScore: 4,
  });

  assert.ok(scoreCandidate(redDress, blackDress) < MATCH_THRESHOLD);
  const result = matchInspiration([redDress], [blackDress]);
  assert.equal(result.matches[0]!.item, null);
  assert.equal(result.gapCount, 1);
});

test('the right colour with the head noun in common clears the line', () => {
  resetIds();
  const skirt = garment('bottom', 'black', { subcategory: 'skirt', formality: 3 });
  const asked = piece({
    category: 'bottom',
    subcategory: 'pleated midi skirt',
    colorNames: ['black'],
    formalityScore: 3,
  });
  assert.ok(scoreCandidate(asked, skirt) >= MATCH_THRESHOLD);
  assert.equal(matchInspiration([asked], [skirt]).matches[0]!.item?.id, skirt.id);
});

test('an empty slot is an honest gap — nothing is forced across slots', () => {
  resetIds();
  // A closet with no bottoms at all: trousers must not come back as a dress.
  const closet = [garment('dress', 'black'), garment('base_top', 'white')];
  const result = matchInspiration(
    [piece({ category: 'bottom', subcategory: 'trousers', colorNames: ['black'] })],
    closet,
  );
  assert.equal(result.matches[0]!.item, null);
});

// ---------------------------------------------------------------------------
// Structure rules
// ---------------------------------------------------------------------------

test('one garment fills at most one piece, and dominance picks first', () => {
  resetIds();
  const theOneShirt = garment('base_top', 'white', { subcategory: 't-shirt' });
  const twoWhiteTops = [
    piece({ subcategory: 't-shirt', colorNames: ['white'] }),
    piece({ subcategory: 't-shirt', colorNames: ['white'] }),
  ];
  const result = matchInspiration(twoWhiteTops, [theOneShirt]);
  assert.equal(result.matches[0]!.item?.id, theOneShirt.id);
  assert.equal(result.matches[1]!.item, null);
  assert.equal(result.matchedItems.length, 1);
});

test('a belt is never a stand-in for sunglasses — the kind gates the slot', () => {
  resetIds();
  const belt = garment('accessory', 'black', { category: 'accessory', subcategory: 'leather belt' });
  const asked = piece({
    category: 'accessory',
    subcategory: 'sunglasses',
    colorNames: ['black'],
  });
  assert.equal(matchInspiration([asked], [belt]).matches[0]!.item, null);
});

test('a knit answers for a top — the engine\'s own tolerance carries over', () => {
  resetIds();
  const knit = garment('mid_layer', 'cream', { subcategory: 'sweater' });
  const asked = piece({ category: 'top', subcategory: 'cream sweater', colorNames: ['cream'] });
  assert.equal(matchInspiration([asked], [knit]).matches[0]!.item?.id, knit.id);
});

test('the matched items come back in piece order, ready to be an outfit', () => {
  resetIds();
  const shirt = garment('base_top', 'white', { subcategory: 't-shirt' });
  const jeans = garment('bottom', 'denim', { subcategory: 'jeans' });
  const result = matchInspiration(
    [
      piece({ subcategory: 't-shirt', colorNames: ['white'] }),
      piece({ category: 'bottom', subcategory: 'jeans', colorNames: ['blue'] }),
    ],
    [jeans, shirt],
  );
  assert.deepEqual(
    result.matchedItems.map((g) => g.id),
    [shirt.id, jeans.id],
  );
  assert.equal(result.gapCount, 0);
});
