/**
 * UX-04 Variant A, and UX-10's finite ending.
 *
 * The filter under test is the entire privacy-and-truth story of the Explore
 * page as it now ships: the query still returns the caller's own pieces (that
 * contract is deliberately unchanged — no view, no RLS, no column moved), and
 * this one function is what makes the page honest about being "New in your
 * circle". If it regresses, the page silently becomes half a mirror, and no
 * screenshot of a founder's own populated account would show it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  byCreatedAtDescending,
  CAUGHT_UP_LINE,
  circleEntries,
  showsCaughtUp,
} from '../src/features/explore/feed';

const row = (ownerId: string, isSelf = false) => ({ ownerId, isSelf });

/** One garment on the timeline, reduced to the two fields the order depends on. */
const added = (id: string, createdAt: string) => ({ id, createdAt });

const newestFirst = (rows: { id: string; createdAt: string }[]) =>
  [...rows].sort(byCreatedAtDescending).map((r) => r.id);

test('Variant A: the caller’s own pieces never appear in the circle timeline', () => {
  const entries = [row('me', true), row('priya'), row('me', true), row('adam')];
  assert.deepEqual(
    circleEntries(entries, new Set()).map((e) => e.ownerId),
    ['priya', 'adam'],
  );
});

test('a self row is dropped even when its owner id is not muted and not a friend', () => {
  // The seam is `isSelf`, not an id comparison at the call site — a screen that
  // forgot to pass its own user id must not be able to leak own pieces back in.
  assert.deepEqual(circleEntries([row('anything', true)], new Set()), []);
});

test('muted friends are dropped, and muting has no exception to carry any more', () => {
  const entries = [row('priya'), row('adam'), row('sam')];
  assert.deepEqual(
    circleEntries(entries, new Set(['adam'])).map((e) => e.ownerId),
    ['priya', 'sam'],
  );
});

test('muting yourself is meaningless because you are already gone', () => {
  assert.deepEqual(circleEntries([row('me', true)], new Set(['me'])), []);
});

test('order is preserved — the query decided it, the filter does not re-sort', () => {
  const entries = [row('c'), row('me', true), row('a'), row('b')];
  assert.deepEqual(
    circleEntries(entries, new Set()).map((e) => e.ownerId),
    ['c', 'a', 'b'],
  );
});

test('an all-self timeline reads as an empty circle, not as a full page', () => {
  // The important consequence: a user with a big closet and no friends gets the
  // "find a friend" hero rather than a page of their own uploads pretending to
  // be social activity.
  assert.equal(circleEntries([row('me', true), row('me', true)], new Set()).length, 0);
});

// ---------------------------------------------------------------------------
// The order — newest first, across a seam the server does not see
// ---------------------------------------------------------------------------

test('the timeline is newest first', () => {
  const rows = [
    added('middle', '2026-08-15T10:00:00+00:00'),
    added('oldest', '2026-08-14T10:00:00+00:00'),
    added('newest', '2026-08-16T10:00:00+00:00'),
  ];
  assert.deepEqual(newestFirst(rows), ['newest', 'middle', 'oldest']);
});

test('sub-second precision still sorts chronologically as text', () => {
  // The regression this pins: `localeCompare` applies ICU collation, which
  // gives punctuation variable weight, so it does not reliably order a
  // fractional-second timestamp after the whole second it follows. Under it
  // these two land backwards and the page shows its own days out of order.
  // Postgres serialises timestamptz to a fixed-width ISO string in one
  // timezone, so codepoint order IS chronological order — which is why the
  // comparator uses `<` / `>` and parses nothing.
  const whole = added('earlier', '2026-08-16T10:00:00+00:00');
  const fraction = added('later', '2026-08-16T10:00:00.5+00:00');

  assert.deepEqual(newestFirst([whole, fraction]), ['later', 'earlier']);
  // Input order cannot rescue it: a sort that got the pair right only when it
  // arrived pre-sorted would still be wrong on the merged list.
  assert.deepEqual(newestFirst([fraction, whole]), ['later', 'earlier']);

  // Checked against an oracle that has nothing to do with string collation, so
  // the assertion above is pinned to chronology rather than to a habit.
  assert.ok(Date.parse(fraction.createdAt) > Date.parse(whole.createdAt));
  assert.ok(byCreatedAtDescending(fraction, whole) < 0);
});

test('the merged halves re-order across the seam, newest first', () => {
  // `useNewAdditions` concatenates two independently server-ordered lists — a
  // friend's pieces and the caller's own — so the client sort is the only thing
  // that makes the joined list chronological. Fractional seconds appear on both
  // sides of the seam here on purpose.
  const friends = [
    added('friend-new', '2026-08-16T10:00:00.5+00:00'),
    added('friend-old', '2026-08-14T08:00:00+00:00'),
  ];
  const mine = [
    added('mine-new', '2026-08-16T10:00:00+00:00'),
    added('mine-old', '2026-08-15T09:00:00+00:00'),
  ];
  assert.deepEqual(newestFirst([...friends, ...mine]), [
    'friend-new',
    'mine-new',
    'mine-old',
    'friend-old',
  ]);
});

test('two garments added in the same instant keep the order they arrived in', () => {
  // The comparator reports a tie rather than inventing one, and `sort` is
  // stable — so identical responses render identically instead of reshuffling
  // between refetches.
  const same = '2026-08-16T10:00:00+00:00';
  assert.equal(byCreatedAtDescending(added('a', same), added('b', same)), 0);
  assert.deepEqual(newestFirst([added('b', same), added('a', same)]), ['b', 'a']);
});

test('the caught-up line prints only under a loaded, non-empty timeline', () => {
  assert.equal(showsCaughtUp({ isError: false, isLoading: false, visibleCount: 3 }), true);
  // No claim over a failure: "caught up" would assert the circle is quiet when
  // in fact we could not read it.
  assert.equal(showsCaughtUp({ isError: true, isLoading: false, visibleCount: 3 }), false);
  assert.equal(showsCaughtUp({ isError: false, isLoading: true, visibleCount: 0 }), false);
  // The empty circle has its own hero; an ending under nothing is furniture.
  assert.equal(showsCaughtUp({ isError: false, isLoading: false, visibleCount: 0 }), false);
});

test('the ending is a statement of completion, with no count and no urgency', () => {
  assert.match(CAUGHT_UP_LINE, /caught up/i);
  assert.doesNotMatch(CAUGHT_UP_LINE, /\d/);
  assert.doesNotMatch(CAUGHT_UP_LINE, /more|load|new posts|don’t miss/i);
});
