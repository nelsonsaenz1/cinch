/**
 * The seat arithmetic, which is the one place this feature can be wrong by
 * exactly one and look right.
 *
 * TWELVE PEOPLE, AND THE OWNER IS ONE OF THEM. `handle_new_circle` writes the
 * owner in as `owner/joined` in the same transaction that creates the group,
 * so a fresh group has ELEVEN invitations available. The preparation
 * document's §5 cases 14-15 counted invitations as if the owner sat outside
 * the cap; the atlas says "a group holds twelve people", and the pgTAP file's
 * assertions 46-47 are where that correction was made. This file is where the
 * client's copy of it is held to the same number — read out of the migration
 * rather than typed twice, so the two cannot drift.
 *
 * AND THE CAP COUNTS INVITATIONS. Counting only `joined` would let an owner
 * hold any number of outstanding invitations against twelve seats, and the
 * refusal would land on the twelfth person to tap Accept — a race whose loser
 * could not have avoided it. `enforce_circle_size` counts `invited` together
 * with `joined`; so does `eligibility.ts`; so does everything below.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  circleInviteRows,
  circleSeatsRemaining,
  circleSeatsTaken,
  holdsCircleSeat,
  CIRCLE_SEAT_STATES,
  type CircleSeatRow,
} from '../src/features/circles/eligibility.ts';
import { CIRCLE_MAX_MEMBERS, type CircleMemberState } from '../src/features/circles/types.ts';

const MIGRATION = readFileSync(
  'supabase/migrations/20260818000000_private_circles.sql',
  'utf8',
);
const PGTAP = readFileSync('supabase/tests/19_private_circles.sql', 'utf8');

const ALL_STATES: CircleMemberState[] = ['invited', 'joined', 'declined', 'removed', 'left'];

/** A group as it is one instant after creation: the owner, joined, alone. */
const FRESH: CircleSeatRow[] = [{ userId: 'owner', state: 'joined' }];

/** n candidates, none of whom is in the group. */
const strangers = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);

// ---------------------------------------------------------------------------
// 1 · The number, and where it comes from
// ---------------------------------------------------------------------------

test('twelve is the same twelve the trigger enforces', () => {
  assert.equal(CIRCLE_MAX_MEMBERS, 12);
  // Typed once here and once in plpgsql is two numbers; this is the assertion
  // that makes them one.
  assert.match(MIGRATION, /if v_count >= 12 then/);
});

test('a seat is invited OR joined, and the SQL says the same', () => {
  assert.deepEqual([...CIRCLE_SEAT_STATES], ['invited', 'joined']);
  assert.match(MIGRATION, /state in \('invited', 'joined'\)/);

  for (const state of ALL_STATES) {
    assert.equal(
      holdsCircleSeat(state),
      state === 'invited' || state === 'joined',
      `${state} holds the wrong number of seats`,
    );
  }
});

test('an exit frees the seat it held, which is what makes a mistake undoable', () => {
  // `removed`, `declined` and `left` hold nothing. A group is recoverable
  // after a mis-tapped Remove without deleting any history, and pgTAP 50 is
  // the same fact from the other side.
  //
  // (This pin said 43 when this lane was written. Worker A's last commit
  // renumbered the pgTAP assertions — the FACTS are all still there, and each
  // pin below was re-checked against the assertion text rather than slid by
  // seven. The numbers are a cross-reference and are meant to break loudly
  // when the file they point into moves; that is what they just did.)
  const spent: CircleSeatRow[] = [
    { userId: 'owner', state: 'joined' },
    { userId: 'a', state: 'removed' },
    { userId: 'b', state: 'left' },
    { userId: 'c', state: 'declined' },
  ];
  assert.equal(circleSeatsTaken(spent), 1);
  assert.equal(circleSeatsRemaining(spent), 11);
  assert.match(PGTAP, /50 · a removed row consumes no seat/);
});

// ---------------------------------------------------------------------------
// 2 · Eleven, not twelve
// ---------------------------------------------------------------------------

test('a fresh group has eleven invitations available, not twelve', () => {
  assert.equal(circleSeatsTaken(FRESH), 1);
  assert.equal(circleSeatsRemaining(FRESH), 11);

  const candidates = strangers(12);
  const rows = circleInviteRows({
    candidateIds: candidates,
    mutualFriendIds: candidates,
    members: FRESH,
  });

  // Every row is offerable while nothing is ticked — the cap is met when the
  // twelfth is TICKED, not when it is drawn.
  assert.equal(rows.length, 12);
  assert.equal(rows.filter((row) => row.selectable).length, 12);

  // Tick eleven and the twelfth is full. This is the off-by-one, executed.
  const withEleven = circleInviteRows({
    candidateIds: candidates,
    mutualFriendIds: candidates,
    members: FRESH,
    selectedIds: candidates.slice(0, 11),
  });
  assert.equal(withEleven.filter((row) => row.selected).length, 11);
  assert.deepEqual(withEleven[11], {
    userId: 'u11',
    ineligibility: 'group_full',
    selectable: false,
    selected: false,
  });

  // And the tenth still fits, so the boundary is at eleven and not at ten.
  const withTen = circleInviteRows({
    candidateIds: candidates,
    mutualFriendIds: candidates,
    members: FRESH,
    selectedIds: candidates.slice(0, 10),
  });
  assert.equal(withTen[10].ineligibility, null);
  assert.equal(withTen[11].ineligibility, null);
});

test('the pgTAP file counts the same way — the eleventh fits, the twelfth does not', () => {
  assert.match(PGTAP, /46 · the eleventh invitation takes the twelfth seat/);
  assert.match(PGTAP, /47 · the twelfth is refused/);
});

// ---------------------------------------------------------------------------
// 3 · The cap counts invitations, not attendance
// ---------------------------------------------------------------------------

test('ten outstanding invitations and nobody accepted still leaves one seat', () => {
  const members: CircleSeatRow[] = [
    { userId: 'owner', state: 'joined' },
    ...strangers(10).map((userId): CircleSeatRow => ({ userId, state: 'invited' })),
  ];
  assert.equal(circleSeatsTaken(members), 11);
  assert.equal(circleSeatsRemaining(members), 1);

  const rows = circleInviteRows({
    candidateIds: ['x', 'y'],
    mutualFriendIds: ['x', 'y'],
    members,
  });
  assert.equal(rows[0].ineligibility, null);
  // One seat, so ticking the first fills the group and the second cannot be
  // ticked — the refusal lands on the owner who can see the cause, which is
  // the entire reason the cap counts invitations.
  const afterOne = circleInviteRows({
    candidateIds: ['x', 'y'],
    mutualFriendIds: ['x', 'y'],
    members,
    selectedIds: ['x'],
  });
  assert.equal(afterOne[0].ineligibility, null, 'a ticked row must stay un-tickable');
  assert.equal(afterOne[1].ineligibility, 'group_full');
});

test('a group full of invitations nobody has accepted is still full', () => {
  const members: CircleSeatRow[] = [
    { userId: 'owner', state: 'joined' },
    ...strangers(11).map((userId): CircleSeatRow => ({ userId, state: 'invited' })),
  ];
  assert.equal(circleSeatsRemaining(members), 0);
  assert.match(PGTAP, /48 · and it is full with a single person joined/);

  const [row] = circleInviteRows({
    candidateIds: ['z'],
    mutualFriendIds: ['z'],
    members,
  });
  assert.equal(row.ineligibility, 'group_full');
});

test('remaining seats never go negative', () => {
  // Reachable only if the server and the client disagree; "no seats" is the
  // right answer either way, and "minus one" is an arithmetic bug waiting to
  // be subtracted from something.
  const overfull: CircleSeatRow[] = strangers(15).map((userId) => ({ userId, state: 'joined' }));
  assert.equal(circleSeatsRemaining(overfull), 0);
  assert.equal(circleSeatsRemaining(FRESH, 99), 0);
});

// ---------------------------------------------------------------------------
// 4 · Who is a picker row at all
// ---------------------------------------------------------------------------

test('somebody who already holds a seat IS a row, and it says which seat', () => {
  // Offering to invite a person who is already `invited` or `joined` is an
  // offer the primary key refuses — so the row is inert. It is still DRAWN,
  // because PC-03 draws it: Ellis Moore reads "Already a member" and Jonah Beck
  // reads "Invite pending". Dropping them answered nothing — a friend who is
  // simply absent from the list is indistinguishable from one the app has never
  // heard of, and the reader's actual question is why they cannot ask Ellis.
  const members: CircleSeatRow[] = [
    { userId: 'owner', state: 'joined' },
    { userId: 'a', state: 'invited' },
    { userId: 'b', state: 'joined' },
  ];
  const rows = circleInviteRows({
    candidateIds: ['a', 'b', 'c'],
    mutualFriendIds: ['a', 'b', 'c'],
    members,
  });
  assert.deepEqual(
    rows.map((row) => [row.userId, row.ineligibility, row.selectable]),
    [
      ['a', 'invite_pending', false],
      ['b', 'already_member', false],
      ['c', null, true],
    ],
  );
});

test('a seat-holder never becomes selected, however stale the selection is', () => {
  // The picker cannot tick them, but a selection made a moment before another
  // device wrote the row can still name them. A drawn checkmark on a row the
  // send is going to ignore (`routeCircleInvites` drops seat-holders) is the
  // interface promising a write that will not happen.
  const members: CircleSeatRow[] = [
    { userId: 'owner', state: 'joined' },
    { userId: 'a', state: 'invited' },
  ];
  const [row] = circleInviteRows({
    candidateIds: ['a'],
    mutualFriendIds: ['a'],
    members,
    selectedIds: ['a'],
  });
  assert.equal(row.selected, false);
  assert.equal(row.ineligibility, 'invite_pending');
});

test('a stale tick on a seat-holder is not charged against the cap twice', () => {
  // Their seat is already counted in the roster. Counting the tick as well
  // would refuse a seat that genuinely exists.
  const members: CircleSeatRow[] = [
    { userId: 'owner', state: 'joined' },
    ...strangers(10).map((userId): CircleSeatRow => ({ userId, state: 'invited' })),
  ];
  const rows = circleInviteRows({
    candidateIds: ['u0', 'fresh'],
    mutualFriendIds: ['u0', 'fresh'],
    members,
    selectedIds: ['u0'],
  });
  // One seat left, and the stale tick on `u0` has not eaten it.
  assert.equal(rows[0].ineligibility, 'invite_pending');
  assert.equal(rows[1].ineligibility, null);
});

test('being in the group outranks every other reason', () => {
  // "No longer a mutual friend" said of somebody the reader can see on the
  // roster two taps away is an accusation about a person who is standing in the
  // room. And in a full group, "Group is full" about a member of it is absurd.
  const members: CircleSeatRow[] = [
    { userId: 'owner', state: 'joined' },
    ...strangers(11).map((userId): CircleSeatRow => ({ userId, state: 'joined' })),
  ];
  const [row] = circleInviteRows({
    candidateIds: ['u0'],
    mutualFriendIds: [],
    members,
  });
  assert.equal(row.ineligibility, 'already_member');
});

test('somebody who left, declined or was removed IS a row', () => {
  // Asking them back is the path that makes one mis-tapped Remove undoable.
  const members: CircleSeatRow[] = [
    { userId: 'owner', state: 'joined' },
    { userId: 'a', state: 'removed' },
    { userId: 'b', state: 'left' },
    { userId: 'c', state: 'declined' },
  ];
  const rows = circleInviteRows({
    candidateIds: ['a', 'b', 'c'],
    mutualFriendIds: ['a', 'b', 'c'],
    members,
  });
  assert.deepEqual(
    rows.map((row) => [row.userId, row.ineligibility]),
    [
      ['a', null],
      ['b', null],
      ['c', null],
    ],
  );
});

test('candidate order is kept and duplicates collapse', () => {
  const rows = circleInviteRows({
    candidateIds: ['c', 'a', 'c', 'b'],
    mutualFriendIds: ['a', 'b', 'c'],
    members: FRESH,
  });
  assert.deepEqual(
    rows.map((row) => row.userId),
    ['c', 'a', 'b'],
  );
});

// ---------------------------------------------------------------------------
// 5 · Not a mutual friend, and what that does and does not mean
// ---------------------------------------------------------------------------

test('a candidate who is not a mutual friend cannot be chosen', () => {
  const [row] = circleInviteRows({
    candidateIds: ['stranger'],
    mutualFriendIds: [],
    members: FRESH,
  });
  assert.deepEqual(row, {
    userId: 'stranger',
    ineligibility: 'not_mutual',
    selectable: false,
    selected: false,
  });
});

test('not_mutual wins over group_full when both are true', () => {
  // A full group empties and the row becomes available; a friendship that
  // ended does not come back when a seat does. Saying "Group is full" to
  // somebody who could not be invited into an empty group either is a promise
  // the next tap breaks.
  const members: CircleSeatRow[] = [
    { userId: 'owner', state: 'joined' },
    ...strangers(11).map((userId): CircleSeatRow => ({ userId, state: 'joined' })),
  ];
  const [row] = circleInviteRows({
    candidateIds: ['ex-friend'],
    mutualFriendIds: [],
    members,
  });
  assert.equal(row.ineligibility, 'not_mutual');
});

test('a ticked row that is no longer mutual says so, full group or not', () => {
  const [row] = circleInviteRows({
    candidateIds: ['ex-friend'],
    mutualFriendIds: [],
    members: FRESH,
    selectedIds: ['ex-friend'],
  });
  assert.equal(row.ineligibility, 'not_mutual');
  assert.equal(row.selected, true);
});

test('there is no third reason, and PC-10 draws exactly these two', () => {
  // A `blocked` reason would disclose that a block exists to the person it was
  // made against. A block severs both follow edges, so a blocked pair simply
  // stop being mutual friends and land in the same value as anybody else who
  // is no longer mutual.
  const members: CircleSeatRow[] = [
    { userId: 'owner', state: 'joined' },
    ...strangers(11).map((userId): CircleSeatRow => ({ userId, state: 'invited' })),
  ];
  const reasons = new Set(
    circleInviteRows({
      candidateIds: ['a', 'b', 'c'],
      mutualFriendIds: ['a'],
      members,
    }).map((row) => row.ineligibility),
  );
  assert.deepEqual([...reasons].sort(), ['group_full', 'not_mutual']);
});

test('selectable is exactly "no reason not to"', () => {
  const rows = circleInviteRows({
    candidateIds: ['a', 'b'],
    mutualFriendIds: ['a'],
    members: FRESH,
  });
  for (const row of rows) {
    assert.equal(row.selectable, row.ineligibility === null, row.userId);
  }
});

// ---------------------------------------------------------------------------
// 6 · The module stays pure
// ---------------------------------------------------------------------------

test('the arithmetic drags no runtime in with it', () => {
  // This is why it lives apart from the hooks: a node test executes the real
  // function rather than a description of it, exactly as `visibility-flags.ts`
  // is split from `use-closet-visibility.ts`.
  const source = readFileSync('src/features/circles/eligibility.ts', 'utf8');
  assert.doesNotMatch(source, /from '(react|react-native|@tanstack|@supabase)/);
  assert.doesNotMatch(source, /@\/lib\/(supabase|posthog)/);
});
