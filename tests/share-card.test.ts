/**
 * The share card's composition.
 *
 * The card is a captured PNG, so nothing about it can be asserted once it has
 * been drawn — which is exactly why its geometry was pulled out into a pure
 * module. These tests cover the two things that go wrong silently: a slot
 * transcribed from the design atlas with a digit out of place (a tile that
 * hangs off the paper, or a composition whose declared height is a lie, which
 * would make the renderer's uniform fit crop the collage), and a garment
 * ranked into the wrong tile.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ROLE_RANK,
  cardDescription,
  cardPieceOrder,
  cardStack,
  cardStackHeight,
} from '../src/features/share/card-layout';
import type { Garment } from '../src/lib/styling';

/**
 * A garment with only the fields this module reads. Built here rather than
 * imported from the app's dev fixtures: those exist to make the simulator look
 * right and will be edited for design reasons, and they pull React.
 */
const g = (id: string, slot: Garment['slot']): Garment =>
  ({ id, slot, subcategory: null, category: 'other' }) as unknown as Garment;

const COAT = g('a-coat', 'outerwear');
const KNIT = g('b-knit', 'mid_layer');
const SHIRT = g('c-shirt', 'base_top');
const TROUSERS = g('d-trousers', 'bottom');
const SHOES = g('e-shoes', 'footwear');
const TOTE = g('f-tote', 'bag');
const BELT = g('g-belt', 'accessory');

const FIVE = [SHOES, SHIRT, TROUSERS, COAT, KNIT];

test('five pieces land in the five atlas slots, largest first', () => {
  const placed = cardStack(FIVE);

  assert.deepEqual(
    placed.map((p) => p.garment.id),
    ['a-coat', 'd-trousers', 'b-knit', 'c-shirt', 'e-shoes'],
  );
  // The coat takes the atlas's 480px tile — the biggest photograph on the card.
  assert.deepEqual(placed[0].slot, { x: 0, y: 0.02609, size: 0.52174 });
  assert.deepEqual(placed[4].slot, { x: 0.6087, y: 0.79783, size: 0.32609 });

  const sizes = placed.map((p) => p.slot.size);
  for (let i = 1; i < sizes.length; i++) {
    assert.ok(sizes[i] < sizes[i - 1], `slot ${i} should be smaller than slot ${i - 1}`);
  }
});

test('a sixth and seventh piece are dropped, least significant first', () => {
  const placed = cardStack([...FIVE, TOTE, BELT]);

  assert.equal(placed.length, 5);
  assert.deepEqual(
    placed.map((p) => p.garment.id),
    ['a-coat', 'd-trousers', 'b-knit', 'c-shirt', 'e-shoes'],
  );
  assert.ok(ROLE_RANK.bag > ROLE_RANK.footwear);
  assert.ok(ROLE_RANK.accessory > ROLE_RANK.bag);
});

test('the same outfit composes identically whatever order it arrives in', () => {
  const shuffled = [KNIT, COAT, SHOES, TROUSERS, SHIRT];

  assert.deepEqual(cardStack(shuffled), cardStack(FIVE));
});

test('two garments in the same slot are ordered by id, not by input order', () => {
  const early = g('a-loafer', 'footwear');
  const late = g('z-boot', 'footwear');

  assert.deepEqual(
    cardStack([late, early]).map((p) => p.garment.id),
    ['a-loafer', 'z-boot'],
  );
});

test('one to four pieces each get their own composition', () => {
  for (const count of [1, 2, 3, 4]) {
    const placed = cardStack(FIVE.slice(0, count));
    assert.equal(placed.length, count, `${count} pieces should place ${count} tiles`);
    // Distinct slots, i.e. an actual composition rather than a stack of
    // identical rectangles.
    const boxes = new Set(placed.map((p) => JSON.stringify(p.slot)));
    assert.equal(boxes.size, count);
  }
});

test('an empty outfit places nothing rather than throwing', () => {
  assert.deepEqual(cardStack([]), []);
  assert.equal(cardStackHeight(0), 0);
});

test('every composition stays inside its box and declares an honest height', () => {
  for (const count of [1, 2, 3, 4, 5]) {
    const placed = cardStack(FIVE.concat(TOTE).slice(0, count));
    assert.equal(placed.length, count);

    for (const { slot } of placed) {
      assert.ok(slot.x >= 0 && slot.x <= 1, `${count}: x ${slot.x} out of the box`);
      assert.ok(slot.y >= 0, `${count}: y ${slot.y} above the box`);
      assert.ok(slot.size > 0, `${count}: size ${slot.size} is not a tile`);
      // A tile that overhangs the right edge is clipped by the card's margin.
      assert.ok(slot.x + slot.size <= 1.001, `${count}: tile runs past the measure`);
    }

    // The renderer scales the block by its declared height. If the declaration
    // is short, the bottom tile is cropped; if it is long, the collage floats.
    const reach = Math.max(...placed.map((p) => p.slot.y + p.slot.size));
    assert.ok(
      Math.abs(reach - cardStackHeight(count)) < 1e-3,
      `${count}: reaches ${reach} but declares ${cardStackHeight(count)}`,
    );
  }
});

test('a sixth piece does not change the height the five-tile block declares', () => {
  assert.equal(cardStackHeight(6), cardStackHeight(5));
});

test('the description is the first sentence, whole', () => {
  assert.equal(
    cardDescription(
      'Cognac and cream anchor the look while the charcoal trousers ground it. The loafers keep it from reading as evening.',
    ),
    'Cognac and cream anchor the look while the charcoal trousers ground it.',
  );
  assert.equal(cardDescription('One sentence only.'), 'One sentence only.');
  assert.equal(cardDescription('  Padded on both sides.  '), 'Padded on both sides.');
  assert.equal(cardDescription('No full stop at all'), 'No full stop at all');
  assert.equal(cardDescription('Really? Yes.'), 'Really?');
  assert.equal(cardDescription('Wear it!  Twice.'), 'Wear it!');
});

test('there is no description rather than an empty one', () => {
  assert.equal(cardDescription(''), null);
  assert.equal(cardDescription('   '), null);
  assert.equal(cardDescription(null), null);
  assert.equal(cardDescription(undefined), null);
});

test('the piece list reads down the body, and leaves its input alone', () => {
  const input = [SHOES, TOTE, COAT, TROUSERS, SHIRT, KNIT];
  const before = input.slice();

  assert.deepEqual(
    cardPieceOrder(input).map((p) => p.slot),
    ['outerwear', 'mid_layer', 'base_top', 'bottom', 'footwear', 'bag'],
  );
  assert.deepEqual(input, before, 'cardPieceOrder must return a copy');
});
