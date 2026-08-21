/**
 * The Reveal's derivation sentences, held against the exact wording in
 * design-refs/html/The Reveal State Atlas — R-02, R-04 and R-05.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Tally } from '../src/features/closet/outfit-count';
import {
  compositionChips,
  defaultDerivation,
  headline,
  missingRows,
  smallestFix,
  substitutionDerivation,
  zeroBody,
  zeroHeadline,
} from '../src/features/onboarding/reveal-copy';

const closet = (tops: number, bottoms: number, dresses: number, shoes: number): Tally => ({
  tops,
  bottoms,
  dresses,
  shoes,
});

test('R-02: the canonical ten', () => {
  const t = closet(3, 2, 1, 2);
  assert.equal(headline(10, t), 'Ten pieces. Fourteen outfits.');
  assert.equal(
    defaultDerivation(t),
    'Twelve from your tops, bottoms and shoes. Two more from the dress. Counted from what you photographed, not an estimate.',
  );
  assert.deepEqual(compositionChips(t, true, true), [
    '3 tops', '2 bottoms', '1 dress', '2 shoes', '1 coat', '1 bag',
  ]);
});

test('R-04: the dress redirected to a fourth top', () => {
  const t = closet(4, 2, 0, 2);
  assert.equal(headline(10, t), 'Ten pieces. Sixteen outfits.');
  assert.equal(
    substitutionDerivation(t, 'tops'),
    'You swapped the dress for a fourth top, so the math changed: four tops across two bottoms and two pairs of shoes.',
  );
  assert.deepEqual(compositionChips(t, true, true), ['4 tops', '2 bottoms', '2 shoes', '1 coat', '1 bag']);
});

test('R-05: ten tops and nothing else', () => {
  const t = closet(10, 0, 0, 0);
  assert.equal(zeroHeadline(10), 'Ten pieces. No outfits yet.');
  assert.deepEqual(missingRows(t), [
    { label: 'Tops', value: '10', needed: false },
    { label: 'Bottoms', value: '0 — needed', needed: true },
    { label: 'Shoes', value: '0 — needed', needed: true },
  ]);
  assert.equal(smallestFix(t), 'Swap two tops for a bottom and shoes');
  assert.equal(
    zeroBody(t),
    'Nothing you photographed goes anywhere. Cinch won’t put a look together without something to wear with it — a bottom and shoes is all it needs.',
  );
});

test('R-05 generalises past the ten-tops example — a lone missing kind names only itself', () => {
  // Everything but shoes: the body and the fix both name shoes alone, never
  // the ten-tops closet's two-item list.
  const t = closet(3, 2, 1, 0);
  assert.deepEqual(missingRows(t), [
    { label: 'Tops', value: '3', needed: false },
    { label: 'Dresses', value: '1', needed: false },
    { label: 'Bottoms', value: '2', needed: false },
    { label: 'Shoes', value: '0 — needed', needed: true },
  ]);
  assert.equal(smallestFix(t), 'Add shoes to build your first outfit');
  assert.equal(
    zeroBody(t),
    'Nothing you photographed goes anywhere. Cinch won’t put a look together without something to wear with it — shoes is all it needs.',
  );
});

test('a closet that already makes something has no fix to offer', () => {
  assert.equal(smallestFix(closet(3, 2, 1, 2)), null);
});

test('zero pieces is still handled honestly', () => {
  assert.equal(zeroHeadline(0), 'Zero pieces. No outfits yet.');
});
