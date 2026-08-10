/**
 * The Ten's derived copy.
 *
 * These are the sentences catalogued in docs/design/positioning-contract.md §7
 * — every one of them used to have the number ten typed into it, and one of
 * them had the word "eleventh". The point of this file is that changing
 * `PLANS.free.items` moves the words, so the copy cannot quietly go on
 * describing a tier the database no longer enforces.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLANS } from '../src/features/billing/plans';
import { stopSheetCopy, tenProgressLine } from '../src/features/onboarding/ten-copy';
import { canonicalTen, declineSlot, fillSlot } from '../src/features/onboarding/ten-slots';

test('the slot list IS the free closet — the two numbers may never drift', () => {
  // Both `tenProgressLine` (from the slot list) and `stopSheetCopy` (from
  // PLANS) print the size of the free closet, on the same screen, minutes
  // apart. If these ever disagree the user is told two different limits.
  assert.equal(canonicalTen().length, PLANS.free.items);
});

test('T-01 — the opening line names the free closet, not a typed ten', () => {
  assert.equal(
    tenProgressLine(canonicalTen()),
    'Ten pieces is enough for Cinch to style you properly. ' +
      'Photograph them, or pick them from your camera roll — in any order.',
  );
});

// The first screen of the app must not read as "stand over your wardrobe with
// a camera". The library has always been wired beside the shutter and the
// sentence used to hide it, which is the cheapest possible way to lose someone
// who never wanted to photograph anything. Asserted separately from the exact
// wording above so a copy edit can reword the line but cannot drop the offer.
test('T-01 offers the camera roll, not only the camera', () => {
  assert.match(tenProgressLine(canonicalTen()), /camera roll/);
});

test('the remaining count is the slot list less what is settled', () => {
  let slots = canonicalTen();
  slots = fillSlot(slots, 1, 'g-1');
  assert.match(tenProgressLine(slots), /^9 to go\./);

  // A declined slot kept open is SETTLED, not remaining — it will never be
  // asked for again, so counting it as outstanding would overstate the work.
  slots = declineSlot(slots, 6, { open: true });
  assert.match(tenProgressLine(slots), /^8 to go\./);
});

test('the bag sentence appears only when the bag is genuinely what is left', () => {
  const bagLast = canonicalTen().reduce(
    (slots, slot) => (slot.kind === 'bag' ? slots : fillSlot(slots, slot.id, `g-${slot.id}`)),
    canonicalTen(),
  );
  assert.match(tenProgressLine(bagLast), /Cinch can't style you until the bag is in/);

  // Order is a suggestion (free-tier-contract.md §2): photograph the bag early
  // and leave a top for the end, and the last piece is not the bag. The line
  // used to claim it was.
  const topLast = canonicalTen().reduce(
    (slots, slot) => (slot.id === 3 ? slots : fillSlot(slots, slot.id, `g-${slot.id}`)),
    canonicalTen(),
  );
  assert.equal(topLast.filter((s) => s.status === 'empty').length, 1);
  assert.doesNotMatch(tenProgressLine(topLast), /bag/);
  assert.match(tenProgressLine(topLast), /^1 to go\./);
});

test('a complete ten never prints "0 to go" behind the stop sheet', () => {
  const full = canonicalTen().reduce(
    (slots, slot) => fillSlot(slots, slot.id, `g-${slot.id}`),
    canonicalTen(),
  );
  assert.equal(tenProgressLine(full), 'That’s all ten. Nothing here is final — you can swap any piece later.');
});

test('T-06 — the stop sheet, including the eleventh, is derived', () => {
  const copy = stopSheetCopy(PLANS.free.items, 14);
  assert.equal(copy.eyebrow, 'Ten of ten');
  assert.equal(copy.title, 'That’s the ten. There’s room for an eleventh on a larger closet.');
  assert.equal(
    copy.body,
    'Your ten make 14 outfits. Nothing you’ve photographed goes anywhere — you can swap a piece out whenever you like.',
  );
});

test('the eleventh moves with the tier, and takes its article with it', () => {
  // A twelve-piece free closet has room for a thirteenth, not an eleventh —
  // and "a thirteenth", not "an".
  assert.equal(
    stopSheetCopy(12, 20).title,
    'That’s the twelve. There’s room for a thirteenth on a larger closet.',
  );
  assert.equal(stopSheetCopy(12, 20).eyebrow, 'Twelve of twelve');
});

test('the outfit count is never a constant — one outfit is singular', () => {
  // positioning-contract.md §3: the piece count may be a constant in prose,
  // the outfit count may never be. It is an argument here for exactly that
  // reason, and the grammar around it has to survive every value.
  assert.match(stopSheetCopy(PLANS.free.items, 1).body, /make 1 outfit\./);
  assert.match(stopSheetCopy(PLANS.free.items, 0).body, /make 0 outfits\./);
});
