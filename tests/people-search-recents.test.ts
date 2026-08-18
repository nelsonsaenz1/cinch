/**
 * Recent searches — the local list People Search grew, and its one promise.
 *
 * The brief allowed "the smallest safe on-device/local recent-search
 * behavior" and forbade a server table for it. Two things are worth pinning:
 * the ordering, which is the only property the list has, and the storage
 * shape, which is where a well-meaning optimisation would quietly turn a
 * privacy-preserving list into a cache of people's names.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  recentKey,
  RECENT_LIMIT,
  withRecent,
} from '../src/features/social-graph/recent-people-spec';

test('a person searched again moves to the top rather than appearing twice', () => {
  assert.deepEqual(withRecent([], 'a'), ['a']);
  assert.deepEqual(withRecent(['a', 'b'], 'c'), ['c', 'a', 'b']);
  assert.deepEqual(withRecent(['a', 'b', 'c'], 'c'), ['c', 'a', 'b'], 'moved, not duplicated');
  assert.deepEqual(withRecent(['a'], 'a'), ['a']);
});

test('the list is bounded, and it is the oldest entry that goes', () => {
  // The newest search is the one the user is most likely to want back.
  const full = Array.from({ length: RECENT_LIMIT }, (_, i) => `id-${i}`);
  const next = withRecent(full, 'fresh');

  assert.equal(next.length, RECENT_LIMIT);
  assert.equal(next[0], 'fresh');
  assert.ok(!next.includes(`id-${RECENT_LIMIT - 1}`), 'the oldest fell off the end');
  assert.ok(next.includes('id-0'), 'the newest of the old survived');
});

test('the key carries the signed-in user, so one phone cannot leak to the next', () => {
  // The reason `explore/unseen.ts` keys on the user id and the reason
  // `invite/pending-invite.ts` refuses to persist at all.
  assert.equal(recentKey('u1'), 'cinch.people-search.recent.v1.u1');
  assert.notEqual(recentKey('u1'), recentKey('u2'));
  assert.match(recentKey('u1'), /^cinch\./, 'the app-wide storage prefix');
  assert.match(recentKey('u1'), /\.v1\./, 'versioned, so a shape change can be ignored safely');
});

test('only opaque ids are stored — names are re-read through the privacy view', () => {
  // THE load-bearing property. A cached display name, handle or avatar would
  // outlive the thing that decides whether you may see it: somebody blocks
  // you, or goes private, and their face keeps appearing because a JSON blob
  // on the phone remembers it. Hydrating through `social_profiles` instead
  // means a person the server will no longer name simply leaves the list.
  const source = readFileSync('src/features/social-graph/recent-people.ts', 'utf8');

  // What goes INTO storage is the id array and nothing else.
  assert.match(source, /AsyncStorage\.setItem\(recentKey\(userId\), JSON\.stringify\(ids\)\)/);
  assert.doesNotMatch(
    source,
    /setItem\([^)]*JSON\.stringify\((?!ids\))/,
    'something other than the id list is being persisted',
  );

  // And the read that turns ids into people goes through the view that
  // already carries the block and visibility rules.
  assert.match(source, /from\('social_profiles'\)/);
  assert.doesNotMatch(source, /from\('profiles'\)/, 'the base table bypasses the privacy view');
});

test('recents are not written for the signed-in user herself', () => {
  const source = readFileSync('src/features/social-graph/recent-people.ts', 'utf8');
  assert.match(source, /if \(!me \|\| userId === me\) return;/);
});
