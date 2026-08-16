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

import { CAUGHT_UP_LINE, circleEntries, showsCaughtUp } from '../src/features/explore/feed';

const row = (ownerId: string, isSelf = false) => ({ ownerId, isSelf });

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
