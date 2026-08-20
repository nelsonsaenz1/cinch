/**
 * Accessories as first-class citizens of the generator.
 *
 * Same charter as `styling-generate.test.ts`: structural invariants, never
 * exact scores. The rules under proof are the ones `addAccessories` states —
 * one bag, one hat, one accessory PER KIND, a hard cap on the total — plus
 * the kind vocabulary itself, which is the line all of those rules are drawn
 * along.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ACCESSORY_KIND_ORDER,
  MAX_ACCESSORIES_PER_OUTFIT,
  accessoryKind,
  generateOutfits,
  type Garment,
} from '../src/lib/styling';
import { context, garment, resetIds } from './helpers';

// ---------------------------------------------------------------------------
// The kind vocabulary
// ---------------------------------------------------------------------------

test('subcategory text resolves to the accessory kind a person would name', () => {
  const kind = (subcategory: string) =>
    accessoryKind({ category: 'accessory', subcategory });

  assert.equal(kind('leather belt'), 'belt');
  assert.equal(kind('aviator sunglasses'), 'sunglasses');
  assert.equal(kind('field watch'), 'watch');
  assert.equal(kind('silk scarf'), 'scarf');
  assert.equal(kind('wool scarves'), 'scarf');
  assert.equal(kind('leather gloves'), 'gloves');
  assert.equal(kind('knit tie'), 'tie');
  assert.equal(kind('gold necklace'), 'jewelry');
  assert.equal(kind('signet ring'), 'jewelry');
});

test('the jewelry CATEGORY answers without reading the subcategory', () => {
  // The tagger already decided; a null subcategory must not demote the piece.
  assert.equal(accessoryKind({ category: 'jewelry', subcategory: null }), 'jewelry');
});

test('an unrecognised subcategory degrades to other, never throws', () => {
  assert.equal(accessoryKind({ category: 'accessory', subcategory: null }), 'other');
  assert.equal(accessoryKind({ category: 'accessory', subcategory: 'keychain' }), 'other');
});

test('every kind in the attach order is a real kind, exactly once', () => {
  assert.equal(new Set(ACCESSORY_KIND_ORDER).size, ACCESSORY_KIND_ORDER.length);
  assert.ok(ACCESSORY_KIND_ORDER.includes('jewelry'));
  assert.ok(ACCESSORY_KIND_ORDER.includes('other'));
});

// ---------------------------------------------------------------------------
// The attach rules, held across a real generation pass
// ---------------------------------------------------------------------------

/** A wardrobe whose accessory shelf is deliberately crowded. */
function accessorisedCloset(): Garment[] {
  resetIds();
  return [
    garment('base_top', 'white', { warmth: 2 }),
    garment('base_top', 'navy', { warmth: 2 }),
    garment('bottom', 'charcoal', { warmth: 3 }),
    garment('bottom', 'denim', { warmth: 3 }),
    garment('footwear', 'black', { warmth: 2 }),
    garment('bag', 'tan', { category: 'bag' }),
    garment('bag', 'black', { category: 'bag' }),
    garment('headwear', 'navy', { category: 'headwear', subcategory: 'cap' }),
    garment('headwear', 'cream', { category: 'headwear', subcategory: 'beanie' }),
    garment('accessory', 'brown', { category: 'accessory', subcategory: 'leather belt' }),
    garment('accessory', 'black', { category: 'accessory', subcategory: 'suede belt' }),
    garment('accessory', 'gold', { category: 'jewelry', subcategory: 'necklace' }),
    garment('accessory', 'silver', { category: 'jewelry', subcategory: 'bracelet' }),
    garment('accessory', 'black', { category: 'accessory', subcategory: 'sunglasses' }),
    garment('accessory', 'steel', { category: 'accessory', subcategory: 'watch' }),
    garment('accessory', 'burgundy', { category: 'accessory', subcategory: 'silk scarf' }),
  ];
}

test('no outfit carries two accessories of one kind, two bags, or two hats', () => {
  const outfits = generateOutfits(accessorisedCloset(), context(), { count: 6 });
  assert.ok(outfits.length > 0);

  for (const o of outfits) {
    const bags = o.items.filter((g) => g.slot === 'bag');
    const hats = o.items.filter((g) => g.slot === 'headwear');
    const accessories = o.items.filter((g) => g.slot === 'accessory');

    assert.ok(bags.length <= 1, 'two bags');
    assert.ok(hats.length <= 1, 'two hats');
    assert.ok(accessories.length <= MAX_ACCESSORIES_PER_OUTFIT, 'over the accessory cap');

    const kinds = accessories.map((g) => accessoryKind(g));
    assert.equal(new Set(kinds).size, kinds.length, `duplicate kind in ${kinds.join(', ')}`);
  }
});

test('a pinned accessory is worn even when the score gate would refuse it', () => {
  const closet = accessorisedCloset();
  const watch = closet.find((g) => g.subcategory === 'watch')!;

  const outfits = generateOutfits(closet, context(), {
    count: 3,
    pinnedItemIds: new Set([watch.id]),
  });

  assert.ok(outfits.length > 0);
  for (const o of outfits) {
    assert.ok(o.items.some((g) => g.id === watch.id), 'pinned watch missing');
  }
});

test('includeAccessories: false still keeps the shelf out entirely', () => {
  const outfits = generateOutfits(accessorisedCloset(), context(), {
    count: 4,
    includeAccessories: false,
  });
  for (const o of outfits) {
    assert.ok(
      o.items.every((g) => g.slot !== 'accessory' && g.slot !== 'bag' && g.slot !== 'headwear'),
      'accessory attached with the option off',
    );
  }
});
