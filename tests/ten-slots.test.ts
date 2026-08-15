/**
 * The Ten's slot model — ten GENERIC positions.
 *
 * What this file used to hold: the canonical template (3 tops, 2 bottoms, 1
 * dress, 2 shoes, 1 coat, 1 bag = fourteen outfits before a photograph
 * existed), and the substitution arithmetic that let a slot be declined into
 * another kind. Both are gone with the template itself — see the header of
 * `ten-slots.ts` for the tester who broke it.
 *
 * These tests are the replacement, and the rule they enforce is one sentence:
 * a position holds a garment id and has no opinion about what that garment is.
 * Readiness lives in `starter-readiness.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLANS } from '../src/features/billing/plans';
import {
  emptyTen,
  fillSlot,
  filledCount,
  hydrateFromWardrobe,
  isComplete,
  nextSlot,
  placedIds,
  replaceSlot,
  TEN_SLOTS,
  type TenSlot,
} from '../src/features/onboarding/ten-slots';
import { garment } from './helpers';

test('the grid is ten generic positions, and the free closet says how many', () => {
  const slots = emptyTen();
  assert.equal(slots.length, PLANS.free.items);
  assert.equal(TEN_SLOTS, PLANS.free.items);

  // The one assertion that carries the whole correction: no position names a
  // category, because none of them has one to name.
  for (const slot of slots) {
    assert.equal(slot.status, 'empty');
    assert.equal(slot.garmentId, null);
    assert.ok(!('kind' in slot), 'a position must not carry a category');
    assert.ok(!('originalKind' in slot), 'a position must not carry a category');
  }
  assert.deepEqual(
    slots.map((s) => s.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});

test('order is a suggestion — nextSlot walks the empty ones in id order', () => {
  let slots = emptyTen();
  assert.equal(nextSlot(slots)?.id, 1);

  // Filling slot 5 directly, out of order, does not confuse the suggestion —
  // it still offers the lowest still-empty id.
  slots = fillSlot(slots, 5, 'g-5');
  assert.equal(nextSlot(slots)?.id, 1);

  for (const id of [1, 2, 3, 4]) slots = fillSlot(slots, id, `g-${id}`);
  assert.equal(nextSlot(slots)?.id, 6);
});

test('a filled position cannot be refilled — nothing is ever lost', () => {
  let slots: TenSlot[] = emptyTen();
  slots = fillSlot(slots, 1, 'g-1');
  slots = fillSlot(slots, 1, 'g-1-replacement');
  assert.equal(slots.find((s) => s.id === 1)?.garmentId, 'g-1');
});

test('completion is about positions, and says nothing about readiness', () => {
  let slots: TenSlot[] = emptyTen();
  assert.ok(!isComplete(slots));
  for (let id = 1; id <= 10; id += 1) slots = fillSlot(slots, id, `g-${id}`);

  assert.ok(isComplete(slots));
  assert.equal(filledCount(slots), 10);
  // Ten filled positions. This module cannot tell you whether that is a
  // wardrobe or ten watches, and it must not pretend to — that is exactly the
  // claim the old `plannedTally` made and got wrong.
  assert.deepEqual(placedIds(slots), Array.from({ length: 10 }, (_, i) => `g-${i + 1}`));
});

test('hydrateFromWardrobe resumes at the count, not at the start', () => {
  const wardrobe = [
    garment('base_top', 'white'),
    garment('base_top', 'navy'),
    garment('bottom', 'charcoal'),
    garment('footwear', 'brown'),
  ];
  const slots = hydrateFromWardrobe(wardrobe);

  assert.equal(filledCount(slots), 4);
  assert.deepEqual(placedIds(slots), wardrobe.map((g) => g.id));
  assert.equal(nextSlot(slots)?.id, 5);
});

test('hydration places EVERY category — the watch is not dropped', () => {
  // The regression this test exists for. Kind-matched hydration ran each
  // garment through a template map and silently discarded anything the ten had
  // no position for: a watch, a hat, an eleventh top. Nelson's tester came back
  // to a grid that had forgotten his watch.
  const wardrobe = [
    garment('accessory', 'steel'), // the watch
    garment('headwear', 'navy'),
    garment('mid_layer', 'grey'), // the hoodie
    garment('base_top', 'white'),
    garment('base_top', 'navy'),
    garment('base_top', 'black'),
    garment('bottom', 'charcoal'),
    garment('bottom', 'indigo'),
    garment('footwear', 'brown'),
    garment('outerwear', 'olive'),
  ];
  const slots = hydrateFromWardrobe(wardrobe);

  assert.equal(filledCount(slots), 10);
  assert.deepEqual(
    placedIds(slots),
    wardrobe.map((g) => g.id),
    'every garment resumes, in wardrobe order, whatever its category',
  );
});

test('a wardrobe larger than the grid overflows it rather than choosing by kind', () => {
  const wardrobe = Array.from({ length: 14 }, () => garment('base_top', 'white'));
  const slots = hydrateFromWardrobe(wardrobe);

  assert.equal(filledCount(slots), 10);
  assert.deepEqual(placedIds(slots), wardrobe.slice(0, 10).map((g) => g.id));
});

test('replaceSlot swaps one garment and nothing about the grid', () => {
  // LP-02's whole mutation. `fillSlot`'s narrower sibling: it may not change a
  // status, so it can neither fill an empty position nor empty a full one, and
  // `filledCount` is therefore identical on both sides by construction.
  const filled = emptyTen()
    .map((s, i) => (i < 3 ? fillSlot([s], s.id, `p${s.id}`)[0] : s));

  const after = replaceSlot(filled, 2, 'swapped');

  assert.equal(after.length, filled.length);
  assert.equal(filledCount(after), filledCount(filled), 'the count moved');
  assert.deepEqual(
    after.map((s) => s.id),
    filled.map((s) => s.id),
    'the positions were reordered',
  );
  assert.deepEqual(placedIds(after), ['p1', 'swapped', 'p3']);

  // An empty position has no garment to replace, and offering a second way to
  // fill one is how the count and the upload queue drift apart.
  assert.deepEqual(replaceSlot(filled, 9, 'nope'), filled);
});
