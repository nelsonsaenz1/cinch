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
import { readFileSync } from 'node:fs';
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

test('the locked footer asserts the lock that now exists — D-2a', () => {
  const line = lockedBoardLine();
  assert.ok(/occasion has started/i.test(line), line);
  assert.ok(/stays as it was/i.test(line), line);
  // "The picks are final" is a statement about the database, and until
  // `20260812120000` it was false: the insert policy was `auth.uid() =
  // voter_id` and the trigger checked membership and self-votes, nothing about
  // time.
  assert.ok(/picks are final/i.test(line), line);
  // Still nothing crowned — and now nothing anywhere can be (D-2b).
  assert.ok(!/crown|favourite|winner|took the room/i.test(line));
});

test('D-2a: the lock guards the retraction as well as the pick', () => {
  // Moving a pick is delete + insert — there is no UPDATE policy on
  // `event_outfit_votes` — so a lock that only guarded INSERT would let a voter
  // delete their pick after the start and leave a tally nobody can put back.
  const migration = readFileSync(
    'supabase/migrations/20260812120000_close_comments_and_lock_board.sql',
    'utf8',
  );
  assert.match(migration, /before delete on public\.event_outfit_votes/);
  assert.match(migration, /errcode = 'CL002'/);
  // But a block retracting a harasser's votes must still work after the start:
  // safety outranks the freeze, and the two are told apart by whose act it is.
  assert.match(migration, /\(select auth\.uid\(\)\) = old\.voter_id/);
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
