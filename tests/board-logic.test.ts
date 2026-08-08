/**
 * Look Board arithmetic, held against the atlas and the frozen contract §3:
 * "One crown, no second or fifth... A tie holds the crown where it was" and
 * the one-pick-per-board vote count ("held on the board and not the card").
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyPickMove,
  favouriteId,
  joinWithAnd,
  pickLine,
  type LookTally,
} from '../src/features/event-outfits/board-logic';

const looks = (...votes: number[]): LookTally[] =>
  votes.map((v, i) => ({ id: `l${i + 1}`, votes: v }));

test('favouriteId: a board with no votes crowns nothing', () => {
  assert.equal(favouriteId(looks(0, 0, 0), null), null);
  assert.equal(favouriteId([], null), null);
});

test('favouriteId: a clear leader is crowned regardless of history', () => {
  assert.equal(favouriteId(looks(3, 2, 2), null), 'l1');
  // Overtake: the crown follows the new leading count immediately — not a
  // scoreboard that lags, and not sticky when there is no tie to hold.
  assert.equal(favouriteId(looks(1, 5, 2), 'l1'), 'l2');
});

test('favouriteId: an initial tie crowns nobody', () => {
  assert.equal(favouriteId(looks(3, 3, 1), null), null);
});

test('favouriteId: a tie holds the crown where it was', () => {
  // l1 was already the favourite; l2 draws level. The crown does not move to
  // l2 and does not disappear — "the board does not un-crown one on a draw".
  assert.equal(favouriteId(looks(3, 3, 1), 'l1'), 'l1');
});

test('favouriteId: the crown is dropped once its holder is no longer tied for the lead', () => {
  const withHistory = favouriteId(looks(2, 5, 1), 'l1');
  assert.equal(withHistory, 'l2');
});

test('favouriteId: a tie the previous crown is not part of stays uncrowned', () => {
  // l3 held the crown once; l1 and l2 are now tied ahead of it and neither
  // gets it by default.
  assert.equal(favouriteId(looks(4, 4, 1), 'l3'), null);
});

test('applyPickMove: casting a first pick only increments the joined card', () => {
  const before = looks(3, 2);
  const after = applyPickMove(before, { fromPostId: null, toPostId: 'l2' });
  assert.deepEqual(
    after.map((l) => l.votes),
    [3, 3],
  );
  // The untouched row keeps its exact reference — no unrelated re-render.
  assert.equal(after[0], before[0]);
});

test('applyPickMove: moving a pick decrements the left card and increments the joined one, in the same pass', () => {
  const before = looks(3, 2, 0);
  const after = applyPickMove(before, { fromPostId: 'l1', toPostId: 'l3' });
  assert.deepEqual(
    after.map((l) => l.votes),
    [2, 2, 1],
  );
});

test('applyPickMove: retracting only decrements the card left', () => {
  const before = looks(3, 2);
  const after = applyPickMove(before, { fromPostId: 'l1', toPostId: null });
  assert.deepEqual(
    after.map((l) => l.votes),
    [2, 2],
  );
});

test('applyPickMove: a no-op move (same card) changes nothing and keeps every reference', () => {
  const before = looks(3, 2);
  const after = applyPickMove(before, { fromPostId: 'l1', toPostId: 'l1' });
  assert.deepEqual(after, before);
  assert.equal(after[0], before[0]);
  assert.equal(after[1], before[1]);
});

test('joinWithAnd: no Oxford comma, "and" only before the last name', () => {
  assert.equal(joinWithAnd([]), '');
  assert.equal(joinWithAnd(['Mel']), 'Mel');
  assert.equal(joinWithAnd(['Mel', 'Tom']), 'Mel and Tom');
  assert.equal(joinWithAnd(['Mel', 'Tom', 'Priya']), 'Mel, Tom and Priya');
  assert.equal(joinWithAnd(['Dana', 'Ben', 'Tom', 'Priya']), 'Dana, Ben, Tom and Priya');
});

test('pickLine: zero is quiet — no line at all when nobody has picked', () => {
  assert.equal(pickLine(0, false, []), null);
});

test('pickLine: "you" is carried separately from the joined rest', () => {
  const line = pickLine(3, true, ['Dana', 'Ben']);
  assert.deepEqual(line, { count: 3, iVoted: true, otherNames: ['Dana', 'Ben'] });
});
