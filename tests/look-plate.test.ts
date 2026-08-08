/**
 * The composed look's grid, held against the Share a Look atlas's rules.
 *
 * Three surfaces render this object — the board, the posting flow and the
 * event page's "Your look" card — so a disagreement here shows up as the same
 * outfit composed three different ways.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lookCells, lookColumns } from '../src/features/event-outfits/look-layout';
import { garment } from './helpers';

const pieces = (n: number) => Array.from({ length: n }, () => garment('base_top', 'white'));

test('two-up to four pieces, three-up beyond', () => {
  // "Two-up grid to four, three-up beyond."
  for (const n of [1, 2, 3, 4]) assert.equal(lookColumns(n), 2, `${n} pieces`);
  for (const n of [5, 6, 7, 12]) assert.equal(lookColumns(n), 3, `${n} pieces`);
});

test('six pieces or fewer all draw', () => {
  for (const n of [2, 4, 6]) {
    const cells = lookCells(pieces(n));
    assert.equal(cells.length, n);
    assert.ok(
      cells.every((c) => c.kind === 'garment'),
      'no overflow marker below the cap',
    );
  }
});

test('seven collapses to six cells, the last one counting the rest', () => {
  // "Seven collapses to six plus a +2 plate rather than shrinking every
  // garment" — five real plates and a +2, so nothing on screen gets smaller.
  const cells = lookCells(pieces(7));
  assert.equal(cells.length, 6);
  assert.equal(cells.filter((c) => c.kind === 'garment').length, 5);

  const last = cells[5]!;
  assert.equal(last.kind, 'more');
  assert.equal(last.kind === 'more' ? last.count : null, 2);
});

test('the overflow count never lies, at any length', () => {
  for (const n of [7, 8, 15]) {
    const cells = lookCells(pieces(n));
    const shown = cells.filter((c) => c.kind === 'garment').length;
    const hidden = cells.reduce((sum, c) => sum + (c.kind === 'more' ? c.count : 0), 0);
    assert.equal(shown + hidden, n, `${n} pieces: ${shown} shown + ${hidden} counted`);
    assert.ok(cells.length <= 6, 'never more than six cells');
  }
});

test('stack order is preserved — piece one is the face', () => {
  // The atlas makes this load-bearing: piece one fills the thumbnail in Lately,
  // on the event page and on any share card. Sorting by visual weight here
  // would silently change which garment represents the look.
  const ordered = pieces(4);
  const cells = lookCells(ordered);
  assert.deepEqual(
    cells.map((c) => (c.kind === 'garment' ? c.garment.id : '+')),
    ordered.map((g) => g.id),
  );
});
