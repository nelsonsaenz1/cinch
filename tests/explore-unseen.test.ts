/**
 * UX-10 — the app may not invent unreadness.
 *
 * A dot on a tab is a claim about the reader's own history, and the accepted
 * design's founder-safe decision is explicit: if the invariant cannot be proven
 * in tests, the dot is suppressed. So these are the proofs. Each one is a way
 * the dot could lie — an unwritten boundary read as "everything is new", a
 * device clock standing in for a server timestamp, a `+00:00` string compared
 * lexicographically against a `Z` one, a shrinking window walking the boundary
 * backwards — and each is asserted shut.
 *
 * The "own pieces never trigger unreadness" invariant is enforced upstream by
 * `circleEntries` (see explore-feed.test.ts) and re-asserted here at the join,
 * because it is the one rule that spans both modules.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { circleEntries } from '../src/features/explore/feed';
import {
  advanceBoundary,
  hasUnseen,
  isUnseen,
  lastSeenStorageKey,
  newestTimestamp,
  unseenBoundaryIndex,
  unseenCount,
} from '../src/features/explore/unseen';

/** Newest-first, as `useNewAdditions` guarantees. */
const feed = (...stamps: string[]) => stamps.map((createdAt, i) => ({ id: `i${i}`, createdAt }));
const at = (e: { createdAt: string }) => e.createdAt;

// ---------------------------------------------------------------------------
// Suppression — the default when nothing can be proven
// ---------------------------------------------------------------------------

test('an unproven boundary means no unseen rows, however new they look', () => {
  const entries = feed('2026-08-15T10:00:00Z', '2026-08-14T10:00:00Z');
  assert.equal(hasUnseen(entries, at, null), false);
  assert.equal(unseenCount(entries, at, null), 0);
  assert.equal(unseenBoundaryIndex(entries, at, null), null);
});

test('an unparseable stored boundary suppresses rather than defaults to “all new”', () => {
  const entries = feed('2026-08-15T10:00:00Z');
  assert.equal(hasUnseen(entries, at, 'not-a-timestamp'), false);
});

test('an unparseable row timestamp is never counted as unseen', () => {
  assert.equal(isUnseen('', '2026-08-01T00:00:00Z'), false);
  assert.equal(isUnseen('tomorrow', '2026-08-01T00:00:00Z'), false);
});

test('an empty circle has nothing unseen in it', () => {
  assert.equal(hasUnseen([], at, '2026-08-01T00:00:00Z'), false);
});

// ---------------------------------------------------------------------------
// The comparison itself
// ---------------------------------------------------------------------------

test('strictly newer: the boundary row is the one you were shown, not a new one', () => {
  const boundary = '2026-08-15T10:00:00Z';
  assert.equal(isUnseen(boundary, boundary), false);
  assert.equal(isUnseen('2026-08-15T10:00:00.001Z', boundary), true);
  assert.equal(isUnseen('2026-08-15T09:59:59Z', boundary), false);
});

test('offset and Z spellings of the same instant compare as instants, not as strings', () => {
  // Postgres hands back `+00:00`; a round-tripped value can be either. A
  // lexicographic compare gets this pair wrong, which is the whole reason
  // `unseen.ts` parses instead.
  assert.equal(isUnseen('2026-08-15T10:00:00+00:00', '2026-08-15T10:00:00Z'), false);
  assert.equal(isUnseen('2026-08-15T10:00:00Z', '2026-08-15T10:00:00+00:00'), false);
  assert.equal(isUnseen('2026-08-15T11:00:00+00:00', '2026-08-15T10:00:00Z'), true);
  // Same wall-clock text, different zone: 10:00-01:00 is 11:00Z, so it IS newer.
  assert.equal(isUnseen('2026-08-15T10:00:00-01:00', '2026-08-15T10:00:00Z'), true);
});

test('unseen counting stops at the boundary', () => {
  const entries = feed(
    '2026-08-15T12:00:00Z',
    '2026-08-15T11:00:00Z',
    '2026-08-14T09:00:00Z',
    '2026-08-13T09:00:00Z',
  );
  assert.equal(unseenCount(entries, at, '2026-08-15T10:00:00Z'), 2);
});

// ---------------------------------------------------------------------------
// The divider
// ---------------------------------------------------------------------------

test('the divider sits above the first already-seen row', () => {
  const entries = feed(
    '2026-08-15T12:00:00Z',
    '2026-08-15T11:00:00Z',
    '2026-08-14T09:00:00Z',
  );
  assert.equal(unseenBoundaryIndex(entries, at, '2026-08-15T10:00:00Z'), 2);
});

test('no divider when everything is new — a rule above row one divides nothing', () => {
  const entries = feed('2026-08-15T12:00:00Z', '2026-08-15T11:00:00Z');
  assert.equal(unseenBoundaryIndex(entries, at, '2026-08-01T00:00:00Z'), null);
});

test('no divider when nothing is new', () => {
  const entries = feed('2026-08-15T12:00:00Z', '2026-08-15T11:00:00Z');
  assert.equal(unseenBoundaryIndex(entries, at, '2026-08-16T00:00:00Z'), null);
});

// ---------------------------------------------------------------------------
// What gets stored
// ---------------------------------------------------------------------------

test('the stored boundary is an authoritative row timestamp, verbatim', () => {
  const entries = feed('2026-08-15T12:00:00+00:00', '2026-08-15T11:00:00Z');
  // Returned as written by the server, not normalised — the value we compare
  // against next time is the value the database produced.
  assert.equal(newestTimestamp(entries, at), '2026-08-15T12:00:00+00:00');
});

test('the newest is found by scanning, not by trusting position', () => {
  const entries = feed('2026-08-14T09:00:00Z', '2026-08-15T12:00:00Z');
  assert.equal(newestTimestamp(entries, at), '2026-08-15T12:00:00Z');
});

test('unparseable rows are never stored as a boundary', () => {
  assert.equal(newestTimestamp(feed('nonsense'), at), null);
  assert.equal(newestTimestamp([], at), null);
});

test('the boundary only ever moves forward', () => {
  const later = '2026-08-15T12:00:00Z';
  const earlier = '2026-08-10T12:00:00Z';
  // A shrinking window — a friendship lapsed, a mute landed, the 40-row cap
  // slid — must not resurrect a dot for rows already scrolled past.
  assert.equal(advanceBoundary(later, earlier), later);
  assert.equal(advanceBoundary(earlier, later), later);
  assert.equal(advanceBoundary(null, later), later);
  assert.equal(advanceBoundary(later, null), later);
  assert.equal(advanceBoundary(null, null), null);
  // Garbage in never overwrites a good boundary.
  assert.equal(advanceBoundary(later, 'nonsense'), later);
});

// ---------------------------------------------------------------------------
// The invariant that spans both modules
// ---------------------------------------------------------------------------

test('own pieces never trigger unreadness, however recent', () => {
  const raw = [
    { ownerId: 'me', isSelf: true, id: 'mine', createdAt: '2026-08-15T23:59:00Z' },
    { ownerId: 'priya', isSelf: false, id: 'hers', createdAt: '2026-08-10T09:00:00Z' },
  ];
  const visible = circleEntries(raw, new Set());
  assert.equal(hasUnseen(visible, at, '2026-08-14T00:00:00Z'), false);
});

test('a muted friend’s new piece never triggers unreadness', () => {
  const raw = [{ ownerId: 'adam', isSelf: false, id: 'a', createdAt: '2026-08-15T23:59:00Z' }];
  const visible = circleEntries(raw, new Set(['adam']));
  assert.equal(hasUnseen(visible, at, '2026-08-14T00:00:00Z'), false);
});

test('a friend’s new piece does trigger unreadness — the dot is not dead code', () => {
  const raw = [{ ownerId: 'priya', isSelf: false, id: 'p', createdAt: '2026-08-15T23:59:00Z' }];
  const visible = circleEntries(raw, new Set());
  assert.equal(hasUnseen(visible, at, '2026-08-14T00:00:00Z'), true);
});

// ---------------------------------------------------------------------------
// Storage scoping
// ---------------------------------------------------------------------------

test('read state is scoped per account and per format version', () => {
  assert.notEqual(lastSeenStorageKey('user-a'), lastSeenStorageKey('user-b'));
  assert.match(lastSeenStorageKey('user-a'), /^cinch\.explore\.last-seen\.v\d+\.user-a$/);
});
