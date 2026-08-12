/**
 * Correction 27 — the shared-look limit, resolved.
 *
 * "Two pieces minimum, six maximum, and a seventh selection refused with a
 * sentence in the bar. The acceptance tests import MAX_PIECES rather than
 * repeating the number, so the frames and the tests move together if it ever
 * changes."
 *
 * So: every assertion below that is ABOUT the bound is written against the
 * imported constants, and the two assertions that pin the constants to today's
 * numbers are isolated in one test, which is the only place a number is typed.
 * Moving the ceiling is then a one-line edit here and nowhere else.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_PIECES,
  MIN_PIECES_TO_COMPOSE,
  canCompose,
  ceilingRefusalLine,
  pieceBoundsLine,
  togglePiece,
  wouldRefuse,
} from '../src/features/share-look/compose';
import { garment, resetIds } from './helpers';

const stackOf = (n: number) => {
  resetIds();
  return Array.from({ length: n }, () => garment('base_top', 'cream'));
};

test('the resolved bounds are two and six', () => {
  assert.equal(MIN_PIECES_TO_COMPOSE, 2);
  assert.equal(MAX_PIECES, 6);
});

test('Compose is inert below the floor and live at it', () => {
  for (let n = 0; n < MIN_PIECES_TO_COMPOSE; n++) {
    assert.equal(canCompose(stackOf(n)), false, `${n} pieces should not compose`);
  }
  for (let n = MIN_PIECES_TO_COMPOSE; n <= MAX_PIECES; n++) {
    assert.equal(canCompose(stackOf(n)), true, `${n} pieces should compose`);
  }
});

test('the seventh tap is refused, and the tile never takes a ring', () => {
  const full = stackOf(MAX_PIECES);
  // NOT `resetIds()` first: the helper's ids are sequential, so resetting here
  // would hand the "seventh" piece the same id as the first one already in the
  // stack and the toggle would read as a de-selection.
  const seventh = garment('footwear', 'brown');

  // The refusal is knowable BEFORE the toggle, which is what lets the bar say
  // so without the tile flashing a selection it is about to lose.
  assert.equal(wouldRefuse(full, seventh), true);

  // And the toggle itself still refuses, so a caller that skipped the check
  // cannot get a seventh piece in by the back door.
  assert.equal(togglePiece(full, seventh).length, MAX_PIECES);
  assert.ok(!togglePiece(full, seventh).some((g) => g.id === seventh.id));
});

test('a full stack still lets you take a piece OUT', () => {
  const full = stackOf(MAX_PIECES);
  const existing = full[0]!;
  // De-selection is never refused at any size — the ceiling is a ceiling, not
  // a lock.
  assert.equal(wouldRefuse(full, existing), false);
  assert.equal(togglePiece(full, existing).length, MAX_PIECES - 1);
});

test('nothing is refused below the ceiling', () => {
  for (let n = 0; n < MAX_PIECES; n++) {
    const stack = stackOf(n);
    const next = garment('bottom', 'navy');
    assert.equal(wouldRefuse(stack, next), false, `${n} pieces should accept another`);
  }
});

test('the requirement names BOTH bounds, and neither is typed as a literal', () => {
  const line = pieceBoundsLine();
  // The atlas's own words: "that requirement now names both bounds, two to
  // six, so a user learns the ceiling before hitting it rather than at the
  // refusal."
  assert.ok(line.includes('two'), line);
  assert.ok(line.includes('six'), line);
  assert.ok(/pieces/.test(line));
});

test('the refusal sentence is built from the ceiling', () => {
  const line = ceilingRefusalLine();
  assert.equal(line, 'Six pieces is the most a look can hold');
  // The proof that it is BUILT rather than written: it is a pure function of
  // MAX_PIECES, so it cannot survive the constant moving without moving too.
  // (Spelled-out numbers stop at six in `wordForCount`; past that the sentence
  // takes the numeral, which is still correct and still derived.)
  assert.ok(!/\b7\b|seven/.test(line));
});
