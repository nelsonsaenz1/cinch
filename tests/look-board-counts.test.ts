/**
 * Audit 96 — "Ahead is computed transient text, ties hold, zero counts are
 * omitted, the board locks at starts_at, and nothing is crowned."
 *
 * Three of those five are testable here and are. The other two are dependency
 * B and are deliberately NOT asserted: the lock is a client comparison against
 * a nullable `events.starts_at` with no server rule behind it, and whether
 * anything is crowned is an unresolved conflict between the atlas and the
 * shipping board that a lane may not settle. `board-logic.ts`'s `favouriteId`
 * is untouched and untested by this file for exactly that reason.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  aheadLabel,
  attendeeLine,
  isTied,
  lockedBoardLine,
  openBoardFooter,
  tieLine,
  voteCountLine,
} from '../src/features/event-outfits/board-copy';

test('zero counts are omitted entirely — never "0 votes"', () => {
  assert.equal(voteCountLine(0), null);
  assert.equal(voteCountLine(-3), null);
  assert.equal(voteCountLine(1), '1 vote');
  assert.equal(voteCountLine(3), '3 votes');
});

test('the count line carries no names — no event carries the friend graph', () => {
  // The signature is the guarantee: one number in, one string out. There is no
  // parameter a voter's name could arrive through, so a board cannot print who
  // voted for whose clothes.
  assert.equal(voteCountLine.length, 1);
  assert.equal(voteCountLine(4), '4 votes');
});

test('Ahead appears only while a look genuinely leads', () => {
  const base = { votes: 3, isLeader: true, tied: false, locked: false };
  assert.equal(aheadLabel(base), 'Ahead');

  // Not a leader.
  assert.equal(aheadLabel({ ...base, isLeader: false }), null);
  // Nobody has voted — a leader of nothing is not ahead of anything.
  assert.equal(aheadLabel({ ...base, votes: 0 }), null);
  // Locked: nothing leads, because nothing is being decided any more.
  assert.equal(aheadLabel({ ...base, locked: true }), null);
});

test('a tie REMOVES Ahead rather than inventing a tiebreak', () => {
  assert.equal(aheadLabel({ votes: 3, isLeader: true, tied: true, locked: false }), null);
});

test('a tie is two or more looks sharing a non-zero top', () => {
  assert.equal(isTied([3, 3]), true);
  assert.equal(isTied([3, 3, 1]), true);
  assert.equal(isTied([3, 2]), false);
  assert.equal(isTied([3]), false);
  // Zeros are not a tie. Two looks nobody voted for are not level at the top;
  // there is no top.
  assert.equal(isTied([0, 0]), false);
  assert.equal(isTied([]), false);
  assert.equal(isTied([0, 0, 2]), false);
});

test('the tie sentence says the order did not change', () => {
  const line = tieLine();
  assert.ok(/order has not changed/i.test(line), line);
  assert.ok(/posted/i.test(line), line);
  // No tiebreak is announced, invented or hinted at.
  assert.ok(!/wins|winner|first|leads/i.test(line));
});

test('the locked footer names the cause and keeps every vote', () => {
  const line = lockedBoardLine();
  assert.ok(/evening has started/i.test(line), line);
  assert.ok(/Votes stay as they were/i.test(line), line);
  // Nothing is crowned by this sentence, in either direction. Dependency B.
  assert.ok(!/crown|favourite|winner|took the room/i.test(line));
});

test('the open footer states the one pick and that votes decide nothing', () => {
  const dated = openBoardFooter('Friday');
  assert.ok(dated.includes('until Friday'), dated);

  // An undated occasion has no lock instant — `events.starts_at` is nullable
  // (migration 20260808130000) — so the footer must not invent a deadline.
  const undated = openBoardFooter(null);
  assert.ok(!/until/.test(undated), undated);
  assert.ok(/while the board is open/.test(undated), undated);

  for (const line of [dated, undated]) {
    assert.ok(/one pick/.test(line), line);
    assert.ok(/Nobody’s look is chosen by the votes/.test(line), line);
  }
});

test('the masthead counts attendees, and omits the count at zero', () => {
  // Correction 24: the board is described by the people on it, not by the
  // number of looks — that framing is what makes it a shared rail rather than
  // one person asking for help.
  assert.equal(attendeeLine(0), null);
  assert.equal(attendeeLine(1), '1 attendee');
  assert.equal(attendeeLine(4), '4 attendees');
});
