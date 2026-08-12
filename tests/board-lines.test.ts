/**
 * Atlas 35's arithmetic and its sentences, held against the frozen contract:
 * "the meta line is the board and the honest wear count, including never
 * worn", "a name, and optionally two dates", "dates make it a trip".
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  allChipLabel,
  boardDraftProblem,
  boardPlateCountLabel,
  boardSummary,
  distinctPieces,
  formatBoardRange,
  isDatedBoard,
  pieceCount,
  plateCountsByBoard,
  plateMetaLine,
  plateTitle,
  platesOnBoard,
  wearLine,
} from '../src/features/boards/board-lines';

/** The device's own month name, so the assertions do not hardcode a locale. */
const month = (y: number, m: number) =>
  new Date(y, m - 1, 15, 12).toLocaleDateString(undefined, { month: 'long' });

// ---------------------------------------------------------------------------
// The wear count
// ---------------------------------------------------------------------------

test('a plate that has not been worn says so in words', () => {
  // Audit 98: never-worn is WORDS. Not a zero, not a dash, not "worn 0×" —
  // a zero here is a plan that has not happened, not a score.
  assert.equal(wearLine(0), 'not worn yet');
  assert.notEqual(wearLine(0), 'worn 0×');
  assert.ok(!wearLine(0).includes('0'));
  assert.ok(!wearLine(0).includes('—'));
});

test('a worn plate prints the count it actually has', () => {
  assert.equal(wearLine(1), 'worn once');
  assert.equal(wearLine(2), 'worn twice');
  assert.equal(wearLine(4), 'worn 4 times');
});

test('the meta line leads with the saved month, then the wear count', () => {
  const now = new Date('2026-08-12T09:41:00');
  assert.equal(
    plateMetaLine(
      { savedAt: '2026-06-03T10:00:00Z', wornCount: 2, itemIds: ['a', 'b', 'c'] },
      now,
    ),
    'Saved in June · worn twice',
  );
});

test('a plate of five or more states its total instead of cramming a fifth cell', () => {
  const now = new Date('2026-08-12T09:41:00');
  assert.equal(
    plateMetaLine(
      { savedAt: '2026-08-01T10:00:00Z', wornCount: 1, itemIds: ['a', 'b', 'c', 'd', 'e'] },
      now,
    ),
    '5 pieces · Saved in August · worn once',
  );
  // Four or fewer says nothing: the tile has already shown them all.
  assert.equal(
    plateMetaLine(
      { savedAt: '2026-08-01T10:00:00Z', wornCount: 0, itemIds: ['a', 'b', 'c', 'd'] },
      now,
    ),
    'Saved in August · not worn yet',
  );
});

// ---------------------------------------------------------------------------
// The name
// ---------------------------------------------------------------------------

test('a plate is called what it was named, or what it was planned for', () => {
  assert.equal(plateTitle({ name: 'Monday standard', occasion: 'work' }), 'Monday standard');
  assert.equal(plateTitle({ name: null, occasion: 'Dinner, Alfama' }), 'Dinner, Alfama');
  assert.equal(plateTitle({ name: '   ', occasion: 'Flying' }), 'Flying');
});

test('an unnamed, occasionless plate is never given a name', () => {
  // The garment-list grammar belongs to the diary. Null means the card prints
  // no title, not that it invents one.
  assert.equal(plateTitle({ name: null, occasion: null }), null);
  assert.equal(plateTitle({ name: '', occasion: '  ' }), null);
});

// ---------------------------------------------------------------------------
// Dates make it a trip
// ---------------------------------------------------------------------------

test('a board is dated only when both ends are set', () => {
  assert.equal(isDatedBoard({ startsOn: '2026-09-14', endsOn: '2026-09-19' }), true);
  assert.equal(isDatedBoard({ startsOn: null, endsOn: null }), false);
  // A half-range is not a trip. The database refuses to store one; nothing
  // upstream may treat one as packable.
  assert.equal(isDatedBoard({ startsOn: '2026-09-14', endsOn: null }), false);
  assert.equal(isDatedBoard({ startsOn: null, endsOn: '2026-09-19' }), false);
});

test('a range inside one month says the month once', () => {
  assert.equal(formatBoardRange('2026-09-14', '2026-09-19'), `14–19 ${month(2026, 9)}`);
});

test('a range across months names both, and across years carries the years', () => {
  assert.equal(
    formatBoardRange('2026-09-28', '2026-10-03'),
    `28 ${month(2026, 9)} – 3 ${month(2026, 10)}`,
  );
  assert.equal(
    formatBoardRange('2026-12-28', '2027-01-03'),
    `28 ${month(2026, 12)} 2026 – 3 ${month(2027, 1)} 2027`,
  );
});

test('a single-day board is one date, not a range of one', () => {
  assert.equal(formatBoardRange('2026-09-14', '2026-09-14'), `14 ${month(2026, 9)}`);
});

// ---------------------------------------------------------------------------
// The collection
// ---------------------------------------------------------------------------

const plate = (id: string, boardId: string | null, itemIds: string[]) => ({
  id,
  boardId,
  itemIds,
});

const SET = [
  plate('p1', 'work', ['trousers', 'blouse', 'loafers', 'tote']),
  plate('p2', 'evening', ['coat', 'trousers', 'loafers']),
  plate('p3', 'weekends', ['skirt', 'sweater', 'loafers']),
  plate('p4', 'lisbon', ['blouse', 'skirt', 'tote']),
  plate('p5', null, ['sweater', 'trousers']),
];

test('the leading chip carries the size of the whole set', () => {
  assert.equal(allChipLabel(14), 'All 14');
  assert.equal(allChipLabel(0), 'All 0');
});

test('board counts ignore the plates that sit in All', () => {
  assert.deepEqual(plateCountsByBoard(SET), { work: 1, evening: 1, weekends: 1, lisbon: 1 });
});

test('All is every kept plate, a board is only its own', () => {
  assert.equal(platesOnBoard(SET, null).length, 5);
  assert.deepEqual(
    platesOnBoard(SET, 'work').map((p) => p.id),
    ['p1'],
  );
  assert.deepEqual(platesOnBoard(SET, 'nowhere'), []);
});

test('pieces in all are counted once each, however many looks share them', () => {
  // Five looks totalling fifteen slots, but only seven distinct pieces —
  // which is the number that goes in the bag, and the number handed to Packing.
  assert.equal(pieceCount(SET), 7);
  assert.deepEqual(distinctPieces(SET.slice(0, 2)), [
    'trousers',
    'blouse',
    'loafers',
    'tote',
    'coat',
  ]);
});

test('the board summary drops the fragments it has nothing behind', () => {
  assert.equal(
    boardSummary({ plateCount: 4, pieceCount: 11, startsOn: '2026-09-14', endsOn: '2026-09-19' }),
    `4 plates · 14–19 ${month(2026, 9)} · 11 pieces in all`,
  );
  assert.equal(
    boardSummary({ plateCount: 3, pieceCount: 7, startsOn: null, endsOn: null }),
    '3 plates · 7 pieces in all',
  );
});

test('an empty board says so rather than printing a zero', () => {
  assert.equal(
    boardSummary({ plateCount: 0, pieceCount: 0, startsOn: null, endsOn: null }),
    'No plates yet',
  );
  assert.equal(
    boardSummary({ plateCount: 0, pieceCount: 0, startsOn: '2026-09-14', endsOn: '2026-09-19' }),
    `No plates yet · 14–19 ${month(2026, 9)}`,
  );
});

test('one of anything is singular', () => {
  assert.equal(
    boardSummary({ plateCount: 1, pieceCount: 1, startsOn: null, endsOn: null }),
    '1 plate · 1 piece in all',
  );
  assert.equal(boardPlateCountLabel(1), '1 plate');
  assert.equal(boardPlateCountLabel(6), '6 plates');
});

// ---------------------------------------------------------------------------
// Writing a board
// ---------------------------------------------------------------------------

const draft = (over: Partial<{ name: string; startsOn: string | null; endsOn: string | null }>) => ({
  name: 'Lisbon',
  startsOn: null,
  endsOn: null,
  ...over,
});

test('a board needs a name and nothing else', () => {
  assert.equal(boardDraftProblem(draft({})), null);
  assert.equal(boardDraftProblem(draft({ name: '   ' })), 'empty-name');
  assert.equal(boardDraftProblem(draft({ name: 'x'.repeat(61) })), 'long-name');
  assert.equal(boardDraftProblem(draft({ name: 'x'.repeat(60) })), null);
});

test('dates are optional together — a half range is refused before the round trip', () => {
  assert.equal(boardDraftProblem(draft({ startsOn: '2026-09-14' })), 'half-range');
  assert.equal(boardDraftProblem(draft({ endsOn: '2026-09-19' })), 'half-range');
  assert.equal(boardDraftProblem(draft({ startsOn: '2026-09-14', endsOn: '2026-09-19' })), null);
});

test('a range that ends before it starts is refused', () => {
  assert.equal(
    boardDraftProblem(draft({ startsOn: '2026-09-19', endsOn: '2026-09-14' })),
    'backwards-range',
  );
  // Same day at both ends is a one-day trip, not a backwards one.
  assert.equal(boardDraftProblem(draft({ startsOn: '2026-09-14', endsOn: '2026-09-14' })), null);
});
