/**
 * Look Board arithmetic, held against the finalized atlas.
 *
 * The frozen contract §3's crown sentences — "One crown, no second or fifth",
 * "A tie holds the crown where it was" — are SUPERSEDED. D-2b resolved that
 * conflict in favour of the atlas, which crowns nothing, so what is left to
 * test is who is ahead on an open board and the one-pick-per-board vote count
 * ("held on the board and not the card", which §3 still governs).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readFileSync } from 'node:fs';

/**
 * A file with its comments stripped.
 *
 * These two tests assert the ABSENCE of a thing, and the docblocks explaining
 * why it is absent are full of the word. A rule that punishes its own
 * documentation teaches people to delete the documentation, which is the
 * opposite of what removing the crown should leave behind.
 */
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

import {
  applyPickMove,
  joinWithAnd,
  leadingId,
  pickLine,
  type LookTally,
} from '../src/features/event-outfits/board-logic';

const looks = (...votes: number[]): LookTally[] =>
  votes.map((v, i) => ({ id: `l${i + 1}`, votes: v }));

test('leadingId: a board with no votes leads with nothing', () => {
  // Zero is quiet. A word on a card nobody picked would be a fabricated leader.
  assert.equal(leadingId(looks(0, 0, 0)), null);
  assert.equal(leadingId([]), null);
});

test('leadingId: a clear leader is named, and an overtake is immediate', () => {
  assert.equal(leadingId(looks(3, 2, 2)), 'l1');
  // Not a scoreboard that lags: the count in front of you is the whole input.
  assert.equal(leadingId(looks(1, 5, 2)), 'l2');
});

test('leadingId: a tie leads with nothing, whatever led before', () => {
  // Audit 96 — "a tie removes Ahead rather than inventing a tiebreak, and the
  // posting order is unchanged."
  assert.equal(leadingId(looks(3, 3, 1)), null);
  assert.equal(leadingId(looks(4, 4, 1)), null);
});

test('D-2b: nothing in this module remembers a previous answer', () => {
  // `favouriteId` took a `previousId` because the crown was sticky through a
  // tie — "a tie holds the crown where it was" (frozen contract §3). The
  // founder resolved that conflict in favour of the finalized atlas, which
  // crowns nothing, so the crown, the sticky rule and the board state that fed
  // it all went at once. This asserts the shape rather than the behaviour: a
  // one-argument pure function cannot be sticky.
  assert.equal(leadingId.length, 1);
  const source = code('src/features/event-outfits/board-logic.ts');
  assert.doesNotMatch(source, /favouriteId/);
  assert.doesNotMatch(source, /previousId/);
});

test('D-2b: no card can draw a crown', () => {
  const card = code('src/components/event-outfits/OutfitPostCard.tsx');
  assert.doesNotMatch(card, /LeaderBadge/);
  assert.doesNotMatch(card, /crown/i);
  assert.doesNotMatch(card, /'favourite'/);
  // And the prop cannot express one any more.
  assert.match(card, /badge: 'ahead' \| null;/);
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
