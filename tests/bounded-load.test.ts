/**
 * ONE BOUNDED LOADING CONTRACT — the state machine.
 *
 * Five rules, and every one of them is a rule some screen in this app broke
 * before the contract existed:
 *
 *   * **A skeleton ends.** Event detail, board, diary detail, saved-look
 *     detail, friend closet and trip detail all drew a full-page placeholder
 *     for as long as `isLoading` stayed true, which for a request that never
 *     returns is forever. `expired` is the bound, and the state it produces is
 *     a real state with a retry rather than a longer wait.
 *   * **A failure outranks a wait.** react-query is `isError` AND
 *     `isRefetching` during a retry; drawing the skeleton then would hide the
 *     failure the reader is in the middle of recovering from.
 *   * **An empty claim is made only after the read settles.** `EmptyState`'s
 *     own rule, enforced by branch order: nothing reaches `empty` while
 *     `loading` or `error` is true, so "No one is blocked" can never be shown
 *     to somebody whose blocks merely failed to load.
 *   * **A timeout is not a failure**, and does not borrow a failure's words.
 *     The request is still out there. The copy says "still", never "couldn't".
 *   * **A timeout that resolves resolves.** Nothing is cancelled, so a state
 *     that expired must fall straight through to `content` the moment the data
 *     lands.
 */

import assert from 'node:assert/strict';
import {
  BOUNDED_ERROR_COPY, test } from 'node:test';

import {
  BOUNDED_TIMEOUT_COPY,
  BOUNDED_TIMEOUT_MS,
  boundedErrorCopy,
  boundedState,
  hasExpired,
  isFailed,
  isWaiting,
} from '@/lib/bounded-load';

// ---------------------------------------------------------------------------
// The five states
// ---------------------------------------------------------------------------

test('a fresh read is a skeleton, and a settled one is content', () => {
  assert.equal(boundedState({ loading: true, error: false }), 'skeleton');
  assert.equal(boundedState({ loading: false, error: false }), 'content');
});

test('a skeleton that outruns its bound becomes a timeout, not a longer wait', () => {
  assert.equal(boundedState({ loading: true, error: false, expired: false }), 'skeleton');
  assert.equal(boundedState({ loading: true, error: false, expired: true }), 'timeout');
});

test('a failure outranks a wait, expired or not', () => {
  // The retry case: react-query keeps `isError` while `isRefetching` runs.
  assert.equal(boundedState({ loading: true, error: true }), 'error');
  assert.equal(boundedState({ loading: true, error: true, expired: true }), 'error');
  assert.equal(boundedState({ loading: false, error: true }), 'error');
});

test('empty is only ever claimed about a settled, un-failed read', () => {
  assert.equal(boundedState({ loading: false, error: false, empty: true }), 'empty');
  // Still reading. An absence has not been established.
  assert.equal(boundedState({ loading: true, error: false, empty: true }), 'skeleton');
  assert.equal(boundedState({ loading: true, error: false, empty: true, expired: true }), 'timeout');
  // The read failed. `empty` here is a fact about `undefined`, not about data.
  assert.equal(boundedState({ loading: false, error: true, empty: true }), 'error');
});

test('a timeout that lands resolves rather than staying stuck', () => {
  // Nothing is cancelled, so the only thing that has to happen is that
  // `loading` goes false — `expired` may still be set on that same render.
  assert.equal(boundedState({ loading: false, error: false, expired: true }), 'content');
  assert.equal(boundedState({ loading: false, error: false, empty: true, expired: true }), 'empty');
});

// ---------------------------------------------------------------------------
// The predicates the call sites branch on
// ---------------------------------------------------------------------------

test('both failing states owe a retry and a way back', () => {
  assert.equal(isFailed('error'), true);
  assert.equal(isFailed('timeout'), true);
  for (const ok of ['skeleton', 'content', 'empty'] as const) {
    assert.equal(isFailed(ok), false, `${ok} is not a failure`);
  }
});

test('only the skeleton is a wait — a timeout has stopped waiting in public', () => {
  assert.equal(isWaiting('skeleton'), true);
  assert.equal(isWaiting('timeout'), false);
  assert.equal(isWaiting('content'), false);
});

test('the bound is inclusive at its own edge', () => {
  assert.equal(hasExpired(0), false);
  assert.equal(hasExpired(BOUNDED_TIMEOUT_MS - 1), false);
  assert.equal(hasExpired(BOUNDED_TIMEOUT_MS), true);
  assert.equal(hasExpired(1_500, 1_000), true);
});

test('the bound is long enough for a slow read and short enough to notice', () => {
  // A cold closet read behind a batch of signed URLs genuinely takes three or
  // four seconds; a bound under that would replace working screens with an
  // apology. Ten would be a page nobody can explain.
  assert.ok(BOUNDED_TIMEOUT_MS >= 4_000 && BOUNDED_TIMEOUT_MS <= 8_000);
});

// ---------------------------------------------------------------------------
// The copy
// ---------------------------------------------------------------------------

test('the timeout never borrows a failure’s words', () => {
  const all =
    `${BOUNDED_TIMEOUT_COPY.kicker} ${BOUNDED_TIMEOUT_COPY.title} ${BOUNDED_TIMEOUT_COPY.body}`.toLowerCase();
  // It is not a failure and must not claim to be one: the request is still out.
  assert.ok(!all.includes('failed'), 'the timeout says "failed"');
  assert.ok(!all.includes('error'), 'the timeout says "error"');
  assert.ok(!all.includes('couldn'), 'the timeout says "couldn’t"');
  // It says the true thing instead, and says nothing has moved.
  assert.match(all, /still/);
  assert.match(all, /nothing has moved/);
  // House rules: no exclamation marks, and the app never says "user".
  assert.ok(!all.includes('!'));
  assert.ok(!/\buser\b/.test(all));
  // And it names no number — that would be a fact about the constant, not
  // about anybody's connection.
  assert.ok(!/\d/.test(all), 'the timeout copy states a duration');
});

test('the screen’s own error wording survives an error and is replaced by a timeout', () => {
  const own = { title: 'Couldn’t read this board', body: 'Nothing has moved.' };

  assert.deepEqual(boundedErrorCopy('error', own), own);
  assert.deepEqual(boundedErrorCopy('timeout', own), BOUNDED_TIMEOUT_COPY);
  // A timeout with no screen wording still gets the full sentence.
  assert.deepEqual(boundedErrorCopy('timeout'), BOUNDED_TIMEOUT_COPY);
  // No wording for an error means the GENERIC error — never null, because a
  // null fell through RouteState's branches to a header over nothing
  // (verification, UX-28).
  assert.deepEqual(boundedErrorCopy('error'), BOUNDED_ERROR_COPY);
});

test('the non-failing states cannot be rendered as errors by forgetting a branch', () => {
  for (const ok of ['skeleton', 'content', 'empty'] as const) {
    assert.equal(boundedErrorCopy(ok, { title: 'x', body: 'y' }), null, `${ok} produced copy`);
  }
});
