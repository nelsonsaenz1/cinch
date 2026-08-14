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
import {
  repairCopy,
  starterCardCopy,
  stopSheetCopy,
  tenProgressLine,
} from '../src/features/onboarding/ten-copy';
import {
  starterReadiness,
  starterSuggestion,
} from '../src/features/onboarding/starter-readiness';
import { emptyTen, fillSlot } from '../src/features/onboarding/ten-slots';
import type { Garment } from '../src/lib/styling';

test('the slot list IS the free closet — the two numbers may never drift', () => {
  // Both `tenProgressLine` (from the slot list) and `stopSheetCopy` (from
  // PLANS) print the size of the free closet, on the same screen, minutes
  // apart. If these ever disagree the user is told two different limits.
  assert.equal(emptyTen().length, PLANS.free.items);
});

test('T-01 — the opening line names the free closet, not a typed ten', () => {
  assert.equal(
    tenProgressLine(emptyTen()),
    'Add ten pieces from your closet. ' +
      'Photograph them or choose them from your camera roll — in any order.',
  );
});

// The first screen of the app must not read as "stand over your wardrobe with
// a camera". The library has always been wired beside the shutter and the
// sentence used to hide it, which is the cheapest possible way to lose someone
// who never wanted to photograph anything. Asserted separately from the exact
// wording above so a copy edit can reword the line but cannot drop the offer.
test('T-01 promises no outcome the readiness model can refuse', () => {
  // The masthead read "Ten pieces is enough for Cinch to style you properly".
  // Ten watches IS ten pieces, and `starterReadiness` correctly refuses that
  // closet — so the loudest line on the first screen of the app asserted
  // something the model contradicts. (It was ungrammatical too: "pieces is".)
  const line = tenProgressLine(emptyTen());
  assert.doesNotMatch(line, /is enough/);
  assert.doesNotMatch(line, /style you properly/);

  // Held against the model rather than against a string: a ten-piece closet
  // that this sentence would have called styleable, and is not.
  const tenWatches = starterReadiness(repeat('accessory', 10).map((slot) => ({ slot })));
  assert.equal(tenWatches.pieces, 10);
  assert.ok(!tenWatches.ready, 'ten pieces alone is not enough — so do not say it is');

  // It asks for the ten instead, and the number still moves with the tier.
  assert.match(line, /^Add ten pieces from your closet\./);
});

test('T-01 offers the camera roll, not only the camera', () => {
  assert.match(tenProgressLine(emptyTen()), /camera roll/);
});

test('the remaining count is the slot list less what is filled', () => {
  let slots = emptyTen();
  slots = fillSlot(slots, 1, 'g-1');
  assert.match(tenProgressLine(slots), /^9 to go\./);

  slots = fillSlot(slots, 6, 'g-6');
  assert.match(tenProgressLine(slots), /^8 to go\./);
});

test('the bag sentence is gone — a bag was never required to be styled', () => {
  // The line used to read "Cinch can't style you until the bag is in", which
  // was only ever true of a template that guaranteed a bag position.
  // `countOutfits` has always refused to count a bag, so the sentence asserted
  // a gate the arithmetic does not enforce.
  const oneLeft = emptyTen().reduce(
    (slots, slot) => (slot.id === 10 ? slots : fillSlot(slots, slot.id, `g-${slot.id}`)),
    emptyTen(),
  );
  assert.equal(oneLeft.filter((s) => s.status === 'empty').length, 1);
  assert.doesNotMatch(tenProgressLine(oneLeft), /bag/);
  assert.match(tenProgressLine(oneLeft), /^1 to go\./);
});

test('a complete ten never prints "0 to go" behind the stop sheet', () => {
  const full = emptyTen().reduce(
    (slots, slot) => fillSlot(slots, slot.id, `g-${slot.id}`),
    emptyTen(),
  );
  assert.equal(
    tenProgressLine(full),
    'That’s all ten. Nothing here is final — you can swap any piece later.',
  );
});

// ---------------------------------------------------------------------------
// The adaptive card
// ---------------------------------------------------------------------------

const card = (...slots: Garment['slot'][]) => {
  const r = starterReadiness(slots.map((slot) => ({ slot })));
  return starterCardCopy(r, starterSuggestion(r));
};

const repeat = (slot: Garment['slot'], n: number): Garment['slot'][] =>
  Array.from({ length: n }, () => slot);

test('the card names the cause when the closet makes nothing', () => {
  const copy = card(...repeat('base_top', 5), ...repeat('bottom', 5));
  assert.equal(copy.title, 'Add a pair of shoes.');
  // 5 tops × 5 bottoms × 1 pair — computed, and printed as the real figure.
  assert.match(copy.body, /25 outfits/);
});

test('the card never quotes a projection that has not moved', () => {
  // The simulator defect, held as a test. Ten watches need shoes AND a top AND
  // a bottom, so a pair of shoes gains nothing — the card names the whole set
  // instead of printing "takes this closet to 0 outfits".
  const copy = card(...repeat('accessory', 10));
  assert.equal(copy.title, 'Add a pair of shoes.');
  assert.match(copy.body, /still needs a pair of shoes, a top and a bottom/);
  assert.doesNotMatch(copy.body, /\b0 outfits?\b/);
  assert.doesNotMatch(copy.body, /takes (this closet|it) to/);
});

test('the first screen of the app invites rather than directs', () => {
  const copy = card();
  assert.equal(copy.eyebrow, 'Start');
  assert.equal(copy.title, 'Start with whatever’s nearest.');
  // It must not contradict the masthead directly above it, which has just
  // said the ten can be photographed in any order.
  assert.match(copy.body, /Order is yours/);
  assert.doesNotMatch(copy.body, /\b0 outfits?\b/);
});

test('the card quotes the real count once the closet makes something', () => {
  const copy = card(
    'base_top', 'base_top', 'mid_layer',
    'bottom', 'bottom',
    'footwear', 'footwear',
    'accessory', 'outerwear',
  );
  // Nine pieces, twelve computed cores — only the count is short, so no kind
  // is named and the sentence says so.
  assert.equal(copy.title, 'One more to go.');
  assert.match(copy.body, /9 pieces already make 12 outfits/);
  assert.match(copy.body, /a coat, a bag, a watch/);
});

test('a ready closet gets a statement, not a suggestion', () => {
  const copy = card(
    'base_top', 'base_top', 'base_top', 'mid_layer',
    'bottom', 'bottom',
    'footwear', 'footwear',
    'accessory', 'outerwear',
  );
  assert.equal(copy.eyebrow, 'Ready');
  assert.equal(copy.title, 'Your 10 pieces make 16 outfits.');
});

test('the repair card names exactly what is absent', () => {
  const noShoes = repairCopy(
    starterReadiness([...repeat('base_top', 4), ...repeat('outerwear', 6)].map((slot) => ({ slot }))),
  );
  assert.match(noShoes.body, /a pair of shoes or a bottom/);
  assert.match(noShoes.title, /^That’s ten pieces/);
  // It never blames the reader, and it always offers the way back.
  assert.match(noShoes.body, /read it again|swap it/);
  assert.match(noShoes.body, /Nothing you’ve photographed goes anywhere/);

  // A closet whose shape is fine but whose arithmetic is thin says the other
  // thing — and quotes both real figures.
  const thin = repairCopy(
    starterReadiness(
      [
        { slot: 'base_top' as const },
        { slot: 'bottom' as const },
        { slot: 'footwear' as const },
        ...repeat('outerwear', 7).map((slot) => ({ slot })),
      ],
    ),
  );
  assert.match(thin.body, /These 10 pieces make 1 outfit —/);
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
