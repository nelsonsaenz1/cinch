/**
 * The Share a Look compose flow's pure logic, held against the atlas's rules:
 * the title never says "Untitled" while there are pieces to name, and the
 * stack renumbers correctly (by position, not a stored index) on every
 * reorder and removal.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_PIECES,
  MIN_PIECES_TO_COMPOSE,
  audienceLine,
  canCompose,
  captionFromPieces,
  matchesCategoryFilter,
  moveStackPiece,
  postedToLatelyLine,
  removePiece,
  stackStatusLine,
  titleFromPieces,
  togglePiece,
} from '../src/features/share-look/compose';
import { garment, resetIds } from './helpers';

// ---------------------------------------------------------------------------
// titleFromPieces — never "Untitled"
// ---------------------------------------------------------------------------

test('never produces "Untitled" at any piece count above zero', () => {
  resetIds();
  const cases = [
    [garment('base_top', 'cream')],
    [garment('base_top', 'cream'), garment('bottom', 'cognac')],
    [garment('base_top', 'cream'), garment('bottom', 'cognac'), garment('footwear', 'brown')],
    // No colour data on any piece at all.
    [garment('base_top', ''), garment('bottom', '')],
  ];
  for (const pieces of cases) {
    const title = titleFromPieces(pieces);
    assert.notEqual(title, 'Untitled', JSON.stringify(pieces.map((g) => g.colors)));
    assert.ok(title.length > 0);
  }
});

test('one piece names itself by colour and noun', () => {
  resetIds();
  const sweater = garment('base_top', 'cream', { subcategory: 'sweater' });
  assert.equal(titleFromPieces([sweater]), 'Cream Sweater');
});

test('two or more pieces read as two dominant colours, heaviest first', () => {
  resetIds();
  // outerwear (0.34) outweighs base_top (0.22): cognac leads.
  const coat = garment('outerwear', 'cognac');
  const shirt = garment('base_top', 'cream');
  assert.equal(titleFromPieces([shirt, coat]), 'Cognac & Cream');
});

test('a repeated colour across pieces counts once', () => {
  resetIds();
  const a = garment('outerwear', 'black');
  const b = garment('base_top', 'black');
  const c = garment('footwear', 'tan');
  // Heaviest-first: outerwear, base_top, footwear — "black" appears twice but
  // the title still only carries two distinct colours.
  const title = titleFromPieces([c, b, a]);
  assert.equal(title, 'Black & Tan');
});

test('stack order is untouched by naming — piece one still leads the plate', () => {
  resetIds();
  const stack = [garment('footwear', 'brown'), garment('outerwear', 'cognac')];
  const before = stack.map((g) => g.id);
  titleFromPieces(stack);
  assert.deepEqual(
    stack.map((g) => g.id),
    before,
  );
});

// ---------------------------------------------------------------------------
// captionFromPieces
// ---------------------------------------------------------------------------

test('caption reads the stack in order, never re-sorted', () => {
  resetIds();
  const stack = [
    garment('base_top', 'cream', { subcategory: 'mohair sweater' }),
    garment('bottom', 'oat', { subcategory: 'corduroy skirt' }),
    garment('footwear', 'cognac', { subcategory: 'loafers' }),
  ];
  assert.equal(
    captionFromPieces(stack),
    'The mohair sweater with the corduroy skirt, loafers.',
  );
});

// ---------------------------------------------------------------------------
// The stack — toggling, removing, reordering
// ---------------------------------------------------------------------------

test('Compose stays inert below two pieces', () => {
  resetIds();
  assert.equal(canCompose([]), false);
  assert.equal(canCompose([garment('base_top', 'cream')]), false);
  assert.equal(
    canCompose([garment('base_top', 'cream'), garment('bottom', 'oat')]),
    true,
  );
  assert.equal(MIN_PIECES_TO_COMPOSE, 2);
});

test('toggling a piece twice is a no-op on the stack', () => {
  resetIds();
  const a = garment('base_top', 'cream');
  let stack = togglePiece([], a);
  assert.deepEqual(stack.map((g) => g.id), [a.id]);
  stack = togglePiece(stack, a);
  assert.deepEqual(stack, []);
});

test('the picker refuses past the ceiling rather than growing the stack', () => {
  resetIds();
  let stack: ReturnType<typeof togglePiece> = [];
  for (let i = 0; i < MAX_PIECES; i++) {
    stack = togglePiece(stack, garment('accessory', 'grey'));
  }
  assert.equal(stack.length, MAX_PIECES);
  const overflow = togglePiece(stack, garment('accessory', 'grey'));
  assert.equal(overflow.length, MAX_PIECES);
});

test('the stack renumbers on removal — remaining pieces close the gap in order', () => {
  resetIds();
  const [a, b, c, d] = [
    garment('base_top', 'cream'),
    garment('bottom', 'oat'),
    garment('footwear', 'cognac'),
    garment('bag', 'tan'),
  ];
  const stack = [a, b, c, d];

  // Removing the second piece (badge "2") must leave a, c, d in that order —
  // c and d each take the badge number one lower than before (index+1), and
  // no id is lost or duplicated along the way.
  const after = removePiece(stack, b.id);
  assert.deepEqual(after.map((g) => g.id), [a.id, c.id, d.id]);
  // The badge each piece would print is exactly its new index + 1.
  assert.deepEqual(
    after.map((g, i) => i + 1),
    [1, 2, 3],
  );
});

test('removing the leading piece promotes the next one to the face', () => {
  resetIds();
  const [a, b, c] = [
    garment('base_top', 'cream'),
    garment('bottom', 'oat'),
    garment('footwear', 'cognac'),
  ];
  const after = removePiece([a, b, c], a.id);
  assert.equal(after[0]!.id, b.id, "piece one is the look's face");
});

test('removing a piece not in the stack is a no-op', () => {
  resetIds();
  const stack = [garment('base_top', 'cream'), garment('bottom', 'oat')];
  const after = removePiece(stack, 'not-in-the-stack');
  assert.deepEqual(after.map((g) => g.id), stack.map((g) => g.id));
});

test('drag-to-reorder moves exactly one piece, closing the gap it left', () => {
  resetIds();
  const [a, b, c, d] = [
    garment('base_top', 'cream'),
    garment('bottom', 'oat'),
    garment('footwear', 'cognac'),
    garment('bag', 'tan'),
  ];
  const stack = [a, b, c, d];

  // Drag piece 1 (index 0) down to index 2 — the S-02 atlas's lifted-row case.
  const moved = moveStackPiece(stack, 0, 2);
  assert.deepEqual(moved.map((g) => g.id), [b.id, c.id, a.id, d.id]);
});

test('an out-of-range drag is a no-op copy, never a throw', () => {
  resetIds();
  const stack = [garment('base_top', 'cream'), garment('bottom', 'oat')];
  const moved = moveStackPiece(stack, 0, 9);
  assert.deepEqual(moved.map((g) => g.id), stack.map((g) => g.id));
  assert.notEqual(moved, stack, 'still a fresh array, not the same reference');
});

test('category chips filter by the garment category the atlas names', () => {
  resetIds();
  const top = garment('base_top', 'cream', { category: 'top' });
  const bottom = garment('bottom', 'oat', { category: 'bottom' });
  const shoe = garment('footwear', 'cognac', { category: 'footwear' });

  assert.ok(matchesCategoryFilter(top, 'All'));
  assert.ok(matchesCategoryFilter(top, 'Tops'));
  assert.ok(!matchesCategoryFilter(top, 'Bottoms'));
  assert.ok(matchesCategoryFilter(bottom, 'Bottoms'));
  assert.ok(matchesCategoryFilter(shoe, 'Shoes'));
  assert.ok(!matchesCategoryFilter(shoe, 'Tops'));
});

test('the status line never claims a count it is not printing', () => {
  resetIds();
  assert.match(stackStatusLine([]), /nothing picked/i);
  assert.match(stackStatusLine([garment('base_top', 'cream')]), /one piece/i);
  const full = Array.from({ length: MAX_PIECES }, () => garment('accessory', 'grey'));
  assert.match(stackStatusLine(full), /ceiling/i);
});

// ---------------------------------------------------------------------------
// Audience and Lately lines
// ---------------------------------------------------------------------------

test('audience is stated in people, singular and plural', () => {
  assert.equal(audienceLine(1), '1 person can see this');
  assert.equal(audienceLine(5), '5 people can see this');
  assert.equal(audienceLine(0), '0 people can see this');
});

test('the Lately line names how many wears, matching the piece count', () => {
  assert.equal(postedToLatelyLine(1), 'Posted, and one wear counted in Lately.');
  assert.equal(postedToLatelyLine(4), 'Posted, and four wears counted in Lately.');
});
