/**
 * Wave 3 · Group 5 — the quadrant plate's fourth cell, and the board delete.
 *
 * Atlas: `docs/design/wave-3-final/Wave 3 - Design · Gap Feed and Social.dc.html`,
 * frames SV-01 and SV-02 (audit 98).
 *
 * Audit 98's rule is a boundary rule — three pieces, four, five or more — and a
 * boundary is exactly what drifts when it is spelled out in three places. So
 * the rule is asserted against `QUADRANT_CELLS` and the pure lines, and the
 * delete sentence is asserted against the MIGRATION that makes it true.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  boardDetailLine,
  boardStartedLine,
  DELETE_BOARD_CONFIRM,
  DELETE_BOARD_KEEP,
  deleteBoardBody,
  deleteBoardHeading,
  plateMetaLine,
  QUADRANT_CELLS,
  savedLine,
  savedSummaryLine,
  wearLine,
} from '../src/features/boards/board-lines';

const NOW = new Date('2026-08-12T09:41:00');
const MIGRATION = 'supabase/migrations/20260810100000_wear_diary_and_boards.sql';

const plate = (pieces: number, wornCount = 0, savedAt = '2026-06-04T10:00:00') => ({
  savedAt,
  wornCount,
  itemIds: Array.from({ length: pieces }, (_, i) => `i-${i}`),
});

// ---------------------------------------------------------------------------
// Audit 98 · the fourth cell
// ---------------------------------------------------------------------------

test('the quadrant is four cells, and every screen agrees on that number', () => {
  assert.equal(QUADRANT_CELLS, 4);

  // The tile is built from the constant, not from a literal 4 — so a plate of
  // exactly four says nothing extra, and five is where the rule turns.
  assert.ok(!plateMetaLine(plate(4), NOW).includes('pieces'));
  assert.ok(plateMetaLine(plate(5), NOW).startsWith('5 pieces · '));
});

test('a five-or-more-piece plate states its total instead of a fifth cell', () => {
  // "shows four and states the total in its metadata rather than cramming a
  // fifth" — the tile is a likeness, not an inventory, and there is no +1.
  assert.equal(
    plateMetaLine(plate(5, 1, '2026-08-01T10:00:00'), NOW),
    '5 pieces · Saved in August · worn once',
  );
  assert.equal(
    plateMetaLine(plate(7, 0, '2026-08-01T10:00:00'), NOW),
    '7 pieces · Saved in August · not worn yet',
  );
  for (const line of [plateMetaLine(plate(5), NOW), plateMetaLine(plate(9), NOW)]) {
    assert.ok(!line.includes('+'), line);
  }
});

test('a three-piece plate has one designed cell, and it carries type', () => {
  // The tile resolves the fourth cell as a SAND CELL CARRYING THE PIECE COUNT.
  // The count string is the same one the metadata would use, so what the cell
  // says and what the line says can never disagree.
  const label = (pieces: number) => `${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`;
  assert.equal(label(3), '3 pieces');
  assert.equal(label(1), '1 piece');

  // And the component draws exactly that: the source is read rather than
  // re-implemented, because the whole point of audit 98 is that a DESIGNED
  // empty cell must carry type where a FAILED image carries none.
  const tile = readFileSync('src/components/boards/quadrant-plate.tsx', 'utf8');
  assert.match(tile, /countLabel \? \(/);
  assert.match(tile, /pieceCount === 1 \? 'piece' : 'pieces'/);
  // The silhouette branch exists for the other case audit 98 allows: a piece
  // that has no photograph is drawn as a garment, not as a hole.
  assert.match(tile, /GarmentSilhouette/);
  // The count goes in the FIRST empty cell only — one statement per tile.
  assert.match(tile, /countLabel=\{i === pieceCount \?/);
});

// ---------------------------------------------------------------------------
// Audit 98 · saved state and wear count
// ---------------------------------------------------------------------------

test('never-worn is words, never a zero and never a dash', () => {
  assert.equal(wearLine(0), 'not worn yet');
  assert.equal(wearLine(-3), 'not worn yet');
  assert.ok(!/[0-9—-]/.test(wearLine(0)), wearLine(0));
});

test('the saved month comes first and the wear count second, in one line', () => {
  assert.equal(savedLine('2026-06-04T10:00:00', NOW), 'Saved in June');
  // The year appears only when it is not this one.
  assert.equal(savedLine('2025-06-04T10:00:00', NOW), 'Saved in June 2025');
  // An unparseable timestamp drops the clause rather than printing nonsense.
  assert.equal(savedLine('not a date', NOW), null);

  const line = plateMetaLine(plate(3, 2), NOW);
  assert.equal(line, 'Saved in June · worn twice');
  assert.ok(line.indexOf('Saved in') < line.indexOf('worn'));
});

test('the masthead counts what is there and drops what is not', () => {
  assert.equal(savedSummaryLine(14, 4), '14 plates · 4 boards');
  assert.equal(savedSummaryLine(1, 1), '1 plate · 1 board');
  assert.equal(savedSummaryLine(3, 0), '3 plates');
  assert.equal(savedSummaryLine(0, 0), null);
});

// ---------------------------------------------------------------------------
// SV-02 · the board, and deleting it
// ---------------------------------------------------------------------------

test('an undated board says when it started; a dated one shows its trip', () => {
  assert.equal(boardStartedLine('2026-03-04T10:00:00', NOW), 'started in March');
  assert.equal(boardStartedLine(null, NOW), null);

  assert.equal(
    boardDetailLine({
      plateCount: 5,
      startsOn: null,
      endsOn: null,
      createdAt: '2026-03-04T10:00:00',
      now: NOW,
    }),
    '5 plates · started in March',
  );
  assert.equal(
    boardDetailLine({
      plateCount: 4,
      startsOn: '2026-09-14',
      endsOn: '2026-09-19',
      createdAt: '2026-03-04T10:00:00',
      now: NOW,
    }),
    '4 plates · 14–19 September',
  );
});

test('the delete confirmation leads with what is kept', () => {
  // The heading IS the consequence, not a reassurance buried under a warning.
  assert.equal(deleteBoardHeading(5), 'The five plates are kept');
  assert.equal(deleteBoardHeading(1), 'The one plate is kept');
  assert.equal(deleteBoardHeading(0), 'Nothing is kept on this board');

  const body = deleteBoardBody('Work');
  assert.match(body, /removes the board only/);
  assert.match(body, /return to All saved/);
  assert.match(body, /names, pieces and wear counts intact/);
  assert.match(body, /No garment is affected/);

  // NOTHING SAYS PERMANENT, because for a board it is not — only the grouping
  // is lost. Nor does it threaten a loss that does not happen.
  for (const copy of [deleteBoardHeading(5), body]) {
    assert.ok(!/permanent|forever|cannot be undone|lost/i.test(copy), copy);
  }

  // Keep first in reading order; Delete is the one oxblood action.
  assert.equal(DELETE_BOARD_KEEP, 'Keep the board');
  assert.equal(DELETE_BOARD_CONFIRM, 'Delete the board');
});

test('the plates really do survive — the schema is what says so', () => {
  // The drawn sentence would be false if deleting a board cascaded. It does
  // not: `outfits.board_id` is declared ON DELETE SET NULL, so the plates are
  // detached and kept by the database rather than by a client that remembers.
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.match(sql, /board_id uuid references boards \(id\) on delete set null/);
  assert.ok(!/board_id[^;]*on delete cascade/i.test(sql));

  // And the mutation is one statement on `boards`, touching nothing else.
  const mutations = readFileSync('src/features/boards/mutations.ts', 'utf8');
  const del = mutations.slice(mutations.indexOf('export function useDeleteBoard'));
  assert.match(del, /\.from\('boards'\)\s*\n?\s*\.delete\(\)/);
  assert.ok(!del.includes(".from('outfits')"), 'the delete must not reach the plates');
});
