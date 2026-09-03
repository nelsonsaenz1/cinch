import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NEUTRAL_PROFILE,
  affinity,
  closetProfile,
  itemDepartment,
  itemFormality,
  profileKey,
  rankByAffinity,
} from '../src/features/explore/closet-affinity';
import { toGarmentColors } from '../src/lib/color';

/**
 * "Like your closet" — the Explore shelf ranks by what the closet says about
 * its owner: department, formality, palette, fabric, prints, brand. Founder
 * order 2026-09-03. Everything here is a fold over garments the app already
 * holds; nothing leaves the device.
 */

type G = Parameters<typeof closetProfile>[0][number];
const piece = (over: Partial<G>): G => ({
  category: 'top',
  subcategory: null,
  formality: 3,
  pattern: null,
  material: null,
  brand: null,
  colors: [],
  ...over,
});

const womens = [
  piece({ category: 'dress', subcategory: 'midi dress', formality: 4, colors: toGarmentColors([{ name: 'navy' }]) }),
  piece({ category: 'bottom', subcategory: 'pencil skirt', formality: 4, material: 'wool' }),
  piece({ category: 'footwear', subcategory: 'heels', formality: 4 }),
  piece({ category: 'top', subcategory: 'silk blouse', formality: 4, material: 'silk', colors: toGarmentColors([{ name: 'cream' }]) }),
];
const mens = [
  piece({ category: 'accessory', subcategory: 'necktie', formality: 4 }),
  piece({ category: 'top', subcategory: 'oxford shirt', formality: 3 }),
  piece({ category: 'accessory', subcategory: 'boxer briefs', formality: 1 }),
  piece({ category: 'footwear', subcategory: 'brogues', formality: 4 }),
];
const casual = [
  piece({ subcategory: 'hoodie', formality: 2, material: 'cotton', pattern: 'graphic' }),
  piece({ subcategory: 'joggers', formality: 2, category: 'bottom' }),
  piece({ subcategory: 'sneakers', formality: 2, category: 'footwear' }),
];

test('a dress-and-heels closet reads as women, confidently', () => {
  const p = closetProfile(womens);
  assert.equal(p.department, 'women');
  assert.equal(p.departmentConfident, true);
  assert.equal(p.formality, 4);
  assert.deepEqual(p.materials, ['silk', 'wool']);
});

test('a tie-and-brogues closet reads as men', () => {
  assert.equal(closetProfile(mens).department, 'men');
});

test('a mixed or small closet reads as unisex and filters nothing', () => {
  assert.equal(closetProfile([...womens.slice(0, 2), ...mens.slice(0, 2)]).department, 'unisex');
  assert.equal(closetProfile([womens[0]!]).department, 'unisex');
  assert.equal(closetProfile(casual).departmentConfident, false);
  assert.deepEqual(closetProfile([]), NEUTRAL_PROFILE);
});

test('the profile’s own word outranks the inference', () => {
  assert.equal(closetProfile(mens, { genderPresentation: 'woman' }).department, 'women');
  assert.equal(closetProfile(womens, { genderPresentation: 'non-binary' }).department, 'unisex');
});

test('a merchant’s department is read from its gender field, then its words', () => {
  assert.equal(itemDepartment({ title: 'Wool Trousers', gender: 'Male' }), 'men');
  assert.equal(itemDepartment({ title: "Women's Trench Coat", gender: null }), 'women');
  assert.equal(itemDepartment({ title: 'Unisex Beanie', gender: null }), 'unisex');
  assert.equal(itemDepartment({ title: 'Trench Coat', gender: null }), null);
});

test('formality is read off the words a merchant wrote', () => {
  assert.equal(itemFormality({ title: 'Tailored Wool Blazer' }), 4);
  assert.equal(itemFormality({ title: 'Fleece Hoodie' }), 2);
  assert.equal(itemFormality({ title: 'Running Leggings' }), 1.5);
  assert.equal(itemFormality({ title: 'Amalfi' }), null);
});

test('a women’s closet is not shown men’s trousers, and prefers its own formality', () => {
  const p = closetProfile(womens);
  const ranked = rankByAffinity(
    [
      { key: 'hoodie', title: 'Graphic Fleece Hoodie', gender: null },
      { key: 'mens', title: 'Wool Trousers', gender: 'Men' },
      { key: 'blazer', title: 'Tailored Silk Blazer', gender: 'Women', colourLabel: 'Navy' },
      { key: 'skirt', title: 'Midi Skirt', gender: null },
    ],
    p,
  );
  assert.deepEqual(
    ranked.map((r) => r.key),
    ['blazer', 'skirt', 'hoodie'],
  );
  assert.equal(affinity({ title: 'Wool Trousers', gender: 'Men' }, p).excluded, true);
});

test('a unisex closet keeps both departments and orders by the rest', () => {
  const p = closetProfile(casual);
  const ranked = rankByAffinity(
    [
      { key: 'blazer', title: 'Tailored Blazer', gender: 'Women' },
      { key: 'hoodie', title: 'Cotton Graphic Hoodie', gender: 'Men' },
    ],
    p,
  );
  assert.deepEqual(ranked.map((r) => r.key), ['hoodie', 'blazer']);
});

test('the neutral profile is the old ranking: nothing excluded, the server’s order kept', () => {
  const items = [{ key: 'a', title: 'Coat' }, { key: 'b', title: "Men's Coat" }, { key: 'c', title: 'Hoodie' }];
  assert.deepEqual(rankByAffinity(items, NEUTRAL_PROFILE).map((i) => i.key), ['a', 'b', 'c']);
});

test('the query key is short and carries no garment', () => {
  const key = profileKey(closetProfile(womens));
  assert.match(key, /^women\|c\|4\.0\|/);
  assert.ok(key.length < 120);
  assert.doesNotMatch(key, /blouse|heels|dress/);
});
