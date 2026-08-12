/**
 * C-01 / C-08 / audit 63 — the one metadata line under a garment's name.
 *
 * The card used to print two figures at opposite edges of the tile, and the
 * atlas's deviation ledger names that as the fault. What replaced it is a
 * sentence built by `pieceMetaLine`, and three of the refusals live inside that
 * one function:
 *
 *   · "printed when known or omitted — never estimated, never a dash"
 *   · "Never worn is printed as words, never as 0"
 *   · zero is quiet
 *
 * None of those are visible in a screenshot of the happy path, which is exactly
 * why they are asserted here rather than left to a capture.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pieceCardAnnouncement, pieceMetaLine } from '../src/features/closet/piece-meta';
import type { Item } from '../src/schemas/item';

/** Only the four fields the line reads. Cast once, here, rather than per test. */
function piece(over: Partial<Item>): Item {
  return { wearCount: 0, purchasePrice: null, ...over } as Item;
}

test('wear count and cost per wear are ONE sentence', () => {
  assert.equal(
    pieceMetaLine(piece({ wearCount: 14, purchasePrice: 90.02 })),
    'Worn 14 times · $6.43 a wear',
  );
  assert.equal(
    pieceMetaLine(piece({ wearCount: 31, purchasePrice: 98.89 })),
    'Worn 31 times · $3.19 a wear',
  );
});

test('the price half DROPS when the price is unknown — never zero, never a dash', () => {
  // C-01's own proof case: the linen blouse, worn six times, price unknown.
  const line = pieceMetaLine(piece({ wearCount: 6, purchasePrice: null }));
  assert.equal(line, 'Worn 6 times');
  assert.ok(!line.includes('—'), 'a dash is refused outright');
  assert.ok(!line.includes('$'), 'no currency clause without a price');
  assert.ok(!/\b0\b/.test(line), 'and never a zero standing in for the unknown');
});

test('a never-worn piece says so in WORDS, and prints no figure at all', () => {
  const line = pieceMetaLine(piece({ wearCount: 0, purchasePrice: 240 }));
  assert.equal(line, 'Never worn');
  // "a zero here would read as a score" — C-08. A price with no wears also has
  // no per-wear figure to print, so the clause cannot follow.
  assert.ok(!line.includes('0'));
  assert.ok(!line.includes('$'));
});

test('one wear is singular — the line is a sentence, not a template', () => {
  assert.equal(pieceMetaLine(piece({ wearCount: 1, purchasePrice: 12 })), 'Worn 1 time · $12.00 a wear');
});

test('a per-wear figure always carries its cents', () => {
  // A division landing on a whole dollar is a coincidence, not a price somebody
  // typed; "$3 a wear" would imply a precision the arithmetic does not have.
  assert.equal(pieceMetaLine(piece({ wearCount: 2, purchasePrice: 6 })), 'Worn 2 times · $3.00 a wear');
});

test('the VoiceOver sentence is one utterance, and names the silhouette as a fact', () => {
  assert.equal(
    pieceCardAnnouncement(piece({ wearCount: 14, purchasePrice: 90.02 }), 'Mohair sweater', {
      hasPhoto: true,
    }),
    'Mohair sweater, Worn 14 times · $6.43 a wear, photograph',
  );
  assert.equal(
    pieceCardAnnouncement(piece({ wearCount: 0 }), 'Camel overcoat', { hasPhoto: false }),
    // "which is a fact rather than a warning" — §9. No "missing", no "error".
    'Camel overcoat, Never worn, silhouette, no photograph yet',
  );
});
