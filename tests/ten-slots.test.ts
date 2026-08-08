/**
 * The Ten's slot model — held against the exact figures T-04's substitution
 * sheet quotes (free-tier-contract.md §2, design-refs/html/The Ten State
 * Atlas). A failure here means the sheet is about to show the wrong count for
 * a redirect nobody has taken yet.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countOutfits } from '../src/features/closet/outfit-count';
import {
  canonicalTen,
  declineSlot,
  fillSlot,
  hydrateFromWardrobe,
  isComplete,
  nextSlot,
  plannedTally,
  redirectOptions,
  settledCount,
  type TenSlot,
} from '../src/features/onboarding/ten-slots';
import { garment } from './helpers';

test('the canonical ten names 3 tops, 2 bottoms, 1 dress, 2 shoes, 1 coat, 1 bag', () => {
  const slots = canonicalTen();
  assert.equal(slots.length, 10);
  assert.equal(countOutfits(plannedTally(slots)), 14);
  assert.deepEqual(
    slots.map((s) => s.kind),
    ['tops', 'tops', 'tops', 'bottoms', 'bottoms', 'dresses', 'shoes', 'shoes', 'outerwear', 'bag'],
  );
});

test('order is a suggestion — nextSlot walks the empty ones in id order', () => {
  let slots = canonicalTen();
  assert.equal(nextSlot(slots)?.id, 1);

  // Filling slot 5 directly, out of order, does not confuse the suggestion —
  // it still offers the lowest still-empty id.
  slots = fillSlot(slots, 5, 'g-5');
  assert.equal(nextSlot(slots)?.id, 1);

  slots = fillSlot(slots, 1, 'g-1');
  slots = fillSlot(slots, 2, 'g-2');
  slots = fillSlot(slots, 3, 'g-3');
  slots = fillSlot(slots, 4, 'g-4');
  assert.equal(nextSlot(slots)?.id, 6);
});

test('T-04: the dress declined — every redirect option carries its own computed count', () => {
  const slots = canonicalTen();
  const options = redirectOptions(slots, 6);

  const asMap = new Map(
    options.map((o) => [o.kind === 'redirect' ? o.to : 'open', o.total]),
  );
  assert.equal(asMap.get('tops'), 16, 'a fourth top instead — sixteen outfits');
  assert.equal(asMap.get('bottoms'), 18, 'a third bottom instead — eighteen outfits');
  assert.equal(asMap.get('open'), 12, 'keep the slot open — finish with nine, twelve outfits');
  // The sheet narrows to two genuine alternatives — not a third pair of shoes.
  assert.equal(options.length, 3);

  // The sheet does not reorder to hide that the third bottom out-counts the
  // fourth top — both numbers are simply what they are, and the recommended
  // option is the top regardless.
  assert.ok((asMap.get('bottoms') ?? 0) > (asMap.get('tops') ?? 0));
  const recommended = options.find((o) => o.kind === 'redirect' && o.recommended);
  assert.equal(recommended && recommended.kind === 'redirect' && recommended.to, 'tops');
});

test('a redirect changes the slot; nothing already filled is ever dropped', () => {
  let slots: TenSlot[] = canonicalTen();
  slots = fillSlot(slots, 1, 'g-1');
  slots = fillSlot(slots, 2, 'g-2');
  slots = fillSlot(slots, 3, 'g-3');
  slots = fillSlot(slots, 4, 'g-4');
  slots = fillSlot(slots, 5, 'g-5');

  // Decline the dress into a fourth top.
  slots = declineSlot(slots, 6, { to: 'tops' });
  assert.equal(slots.find((s) => s.id === 6)?.kind, 'tops');
  assert.equal(slots.find((s) => s.id === 6)?.status, 'empty'); // still needs a photo

  // Every earlier photograph is untouched.
  for (const id of [1, 2, 3, 4, 5]) {
    const s = slots.find((x) => x.id === id)!;
    assert.equal(s.status, 'filled');
    assert.equal(s.garmentId, `g-${id}`);
  }

  slots = fillSlot(slots, 6, 'g-6');
  slots = fillSlot(slots, 7, 'g-7');
  slots = fillSlot(slots, 8, 'g-8');
  slots = fillSlot(slots, 9, 'g-9');
  slots = fillSlot(slots, 10, 'g-10');
  assert.equal(countOutfits(plannedTally(slots)), 16);
  assert.ok(isComplete(slots));
  assert.equal(settledCount(slots), 10);
});

test('"keep the slot open" settles the slot without ever filling it', () => {
  let slots: TenSlot[] = canonicalTen();
  for (const id of [1, 2, 3, 4, 5]) slots = fillSlot(slots, id, `g-${id}`);
  slots = declineSlot(slots, 6, { open: true });
  for (const id of [7, 8, 9, 10]) slots = fillSlot(slots, id, `g-${id}`);

  const dress = slots.find((s) => s.id === 6)!;
  assert.equal(dress.status, 'open');
  assert.equal(dress.garmentId, null);
  assert.ok(isComplete(slots));
  assert.equal(countOutfits(plannedTally(slots)), 12);
});

test('hydrateFromWardrobe resumes at the count, not at the start', () => {
  const wardrobe = [
    garment('base_top', 'white'),
    garment('base_top', 'navy'),
    garment('bottom', 'charcoal'),
    garment('footwear', 'brown'),
  ];
  const slots = hydrateFromWardrobe(wardrobe);

  assert.equal(settledCount(slots), 4);
  assert.equal(slots.find((s) => s.id === 1)?.status, 'filled');
  assert.equal(slots.find((s) => s.id === 2)?.status, 'filled');
  // Only two tops exist — the third top slot is still open for a photograph.
  assert.equal(slots.find((s) => s.id === 3)?.status, 'empty');
  assert.equal(slots.find((s) => s.id === 4)?.status, 'filled'); // first bottom
  assert.equal(slots.find((s) => s.id === 5)?.status, 'empty'); // second bottom
  assert.equal(slots.find((s) => s.id === 7)?.status, 'filled'); // first shoe
  assert.equal(nextSlot(slots)?.id, 3);
});

test('hydrateFromWardrobe never places an eleventh of a kind', () => {
  const wardrobe = Array.from({ length: 5 }, () => garment('base_top', 'white'));
  const slots = hydrateFromWardrobe(wardrobe);
  const topSlots = slots.filter((s) => s.kind === 'tops');
  assert.ok(topSlots.every((s) => s.status === 'filled'));
  assert.equal(settledCount(slots), 3); // only three top positions exist
});

test('a filled slot cannot be declined or refilled — nothing is lost', () => {
  let slots: TenSlot[] = canonicalTen();
  slots = fillSlot(slots, 1, 'g-1');
  const beforeDecline = slots;
  slots = declineSlot(slots, 1, { open: true });
  assert.deepEqual(slots, beforeDecline, 'declining a filled slot is a no-op');

  slots = fillSlot(slots, 1, 'g-1-replacement');
  assert.equal(slots.find((s) => s.id === 1)?.garmentId, 'g-1', 'filling a filled slot is a no-op');
});
