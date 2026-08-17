/**
 * ASKING SOMEBODY BACK, AND THE SILENCE THAT HID IT.
 *
 * The bug this file exists to prevent recurring: the picker sent every ticked
 * person down `useInviteMembers`, which INSERTs. `circle_members` has a primary
 * key on (circle_id, user_id) and no DELETE grant, so anybody who had ever been
 * in the group still had a row, and the insert raised `23505` — which
 * `classifyCircleError` reads as `stale`, which `circleFailureIsSilent` says to
 * swallow. The owner tapped Invite, the spinner turned, the roster redrew
 * unchanged, and nothing was ever said. Permanent exclusion after one mis-tapped
 * Remove, presented as a no-op.
 *
 * The schema was built to make that exact situation recoverable — the re-invite
 * path re-checks mutual friendship and the seat cap at the moment of asking —
 * and the client was throwing it away.
 *
 * These assertions are over `routeCircleInvites`, which is the whole decision,
 * extracted from the screen precisely so it can be exercised here.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { classifyCircleError, circleFailureIsSilent } from '../src/features/circles/errors.ts';
import { routeCircleInvites } from '../src/features/circles/invite-routing.ts';
import type { CircleSeatRow } from '../src/features/circles/eligibility.ts';
import type { CircleMemberState } from '../src/features/circles/types.ts';

const MIGRATION = readFileSync(
  'supabase/migrations/20260818000000_private_circles.sql',
  'utf8',
);

const row = (userId: string, state: CircleMemberState): CircleSeatRow => ({ userId, state });

/** An owner and nobody else — the group as it exists thirty seconds in. */
const FRESH: CircleSeatRow[] = [row('owner', 'joined')];

// ---------------------------------------------------------------------------
// 1 · The three states that need the other verb
// ---------------------------------------------------------------------------

test('removed, left and declined all route to the re-invite path', () => {
  // These are exactly the three states `circleInviteRows` still offers as
  // picker rows, and all three already have a membership row. Every one of them
  // would be a 23505 on the insert path.
  for (const state of ['removed', 'left', 'declined'] as const) {
    const routing = routeCircleInvites({
      selectedIds: ['friend'],
      members: [...FRESH, row('friend', state)],
    });
    assert.deepEqual(routing, { invite: [], reinvite: ['friend'] }, state);
  }
});

test('somebody with no row at all takes the insert path', () => {
  assert.deepEqual(routeCircleInvites({ selectedIds: ['stranger'], members: FRESH }), {
    invite: ['stranger'],
    reinvite: [],
  });
});

test('one selection can need both writes, and each goes to its own', () => {
  const routing = routeCircleInvites({
    selectedIds: ['stranger', 'was-removed', 'newcomer', 'walked-out'],
    members: [...FRESH, row('was-removed', 'removed'), row('walked-out', 'left')],
  });
  assert.deepEqual(routing.invite, ['stranger', 'newcomer']);
  assert.deepEqual(routing.reinvite, ['was-removed', 'walked-out']);
});

// ---------------------------------------------------------------------------
// 2 · Nobody who holds a seat is written at all
// ---------------------------------------------------------------------------

test('a seat-holder is dropped rather than sent down either path', () => {
  // `circleInviteRows` never offers these, so arriving here means the roster
  // moved under the selection. The insert would raise; the UPDATE would be
  // worse — re-inviting a `joined` member would throw them out of the group
  // they are already in.
  const routing = routeCircleInvites({
    selectedIds: ['already-in', 'already-asked', 'stranger'],
    members: [...FRESH, row('already-in', 'joined'), row('already-asked', 'invited')],
  });
  assert.deepEqual(routing, { invite: ['stranger'], reinvite: [] });
});

test('the owner is never written, whichever way they got into the selection', () => {
  assert.deepEqual(routeCircleInvites({ selectedIds: ['owner'], members: FRESH }), {
    invite: [],
    reinvite: [],
  });
});

// ---------------------------------------------------------------------------
// 3 · Order, and the double tick
// ---------------------------------------------------------------------------

test('each list keeps the order the rows were ticked in', () => {
  // A partial failure has to be the same partial failure every time, or the
  // invitations that landed before the refusal depend on map iteration order.
  const routing = routeCircleInvites({
    selectedIds: ['c', 'a', 'b'],
    members: FRESH,
  });
  assert.deepEqual(routing.invite, ['c', 'a', 'b']);
});

test('a duplicated id is written once', () => {
  // The second write is the one that raises — and on the insert path it raises
  // 23505, which is the silent classification this whole file is about.
  assert.deepEqual(
    routeCircleInvites({ selectedIds: ['x', 'x', 'x'], members: FRESH }).invite,
    ['x'],
  );
  assert.deepEqual(
    routeCircleInvites({
      selectedIds: ['y', 'y'],
      members: [...FRESH, row('y', 'declined')],
    }).reinvite,
    ['y'],
  );
});

// ---------------------------------------------------------------------------
// 4 · Why `stale` is allowed to stay silent
// ---------------------------------------------------------------------------

test('23505 is still classified as stale, and that is only honest because of the routing', () => {
  // The classification is NOT the bug and is deliberately unchanged. 23505
  // means "the row is already there", which — once the client picks the right
  // verb — can only be another device having written it between this screen's
  // read and its write. That is a race, and a silent refetch is the remedy.
  //
  // What made it a defect was a client that produced 23505 as the ORDINARY
  // outcome of an ordinary act. The routing above is what moved it back to
  // being a race, so these two assertions are a pair: if the routing is ever
  // reverted, this silence becomes a lie again.
  const duplicate = { code: '23505', message: 'duplicate key value', hint: '', details: '' };
  assert.deepEqual(classifyCircleError(duplicate), { kind: 'stale' });
  assert.equal(circleFailureIsSilent(classifyCircleError(duplicate)), true);
});

test('the schema really does refuse a second row and really does allow the update', () => {
  // The primary key is why the insert path cannot serve a re-invitation...
  assert.match(MIGRATION, /primary key \(circle_id, user_id\)/);
  // ...and the transition trigger is what permits the three exits back to
  // `invited`, which is the write `reinvite` is routed to.
  for (const state of ['removed', 'left', 'declined']) {
    assert.ok(
      MIGRATION.includes(state),
      `the migration no longer mentions ${state}, which this routing depends on`,
    );
  }
});
