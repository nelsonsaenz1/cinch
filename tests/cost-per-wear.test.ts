/**
 * Cost-per-wear arithmetic.
 *
 * The edge cases are the whole test: a never-worn item divides by zero, and an
 * item with no price has no cost to divide. Both must drop out of the sum
 * rather than poison it with NaN or Infinity — this number is printed on the
 * share card, where a "£Infinity" is not recoverable.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { outfitCostPerWear } from '../src/components/today/cost-per-wear';
import { garment, resetIds } from './helpers';

const priced = (price: number | null, wearCount: number) =>
  garment('base_top', 'navy', { purchasePrice: price, wearCount });

test('null when there is nothing to compute from', () => {
  resetIds();
  assert.equal(outfitCostPerWear([]), null);
  assert.equal(outfitCostPerWear([priced(null, 10)]), null);
  assert.equal(outfitCostPerWear([priced(100, 0)]), null);
  assert.equal(outfitCostPerWear([priced(null, 0)]), null);
});

test('a never-worn piece is excluded rather than dividing by zero', () => {
  resetIds();
  const value = outfitCostPerWear([priced(100, 4), priced(500, 0)]);
  assert.equal(value, 25);
  assert.ok(Number.isFinite(value!));
});

test('an unpriced piece is excluded rather than counted as free', () => {
  resetIds();
  assert.equal(outfitCostPerWear([priced(100, 4), priced(null, 50)]), 25);
});

test('the outfit cost is the sum of each piece own cost per wear', () => {
  resetIds();
  const value = outfitCostPerWear([priced(100, 4), priced(60, 3), priced(10, 5)]);
  assert.ok(Math.abs(value! - (25 + 20 + 2)) < 1e-9, `got ${value}`);
});

test('a free item contributes nothing but does not void the total', () => {
  resetIds();
  assert.equal(outfitCostPerWear([priced(0, 3), priced(100, 4)]), 25);
});

test('order does not change the total', () => {
  resetIds();
  const a = priced(100, 4);
  const b = priced(60, 3);
  const c = priced(null, 9);
  assert.equal(outfitCostPerWear([a, b, c]), outfitCostPerWear([c, b, a]));
});

test('a heavily worn expensive coat beats a barely worn cheap one', () => {
  resetIds();
  const coat = outfitCostPerWear([priced(900, 300)])!;
  const tee = outfitCostPerWear([priced(30, 2)])!;
  assert.ok(coat < tee, `coat ${coat} should undercut tee ${tee}`);
});
