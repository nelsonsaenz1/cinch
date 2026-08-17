/**
 * The six states of the Daily Social unit, and every transition between them.
 *
 * Five of the six are emptiness or failure, and the contract says plainly that
 * those are where the unit is judged. The two that are easiest to get wrong are
 * the two that look identical from the data: `nobody_sharing` and `quiet_day`
 * both arrive with zero looks, and they are different screens with different
 * actions. One tells you to go first; the other tells you today was quiet. Ship
 * them swapped and a person with no sharing friends is told to wait for content
 * that can never arrive.
 *
 * The resolver is pure — no React, no react-native, no supabase — so these
 * exercise the real function rather than describing it. Same split, and the
 * same reason, as `visibility-flags.ts` away from `use-closet-visibility.ts`.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  DAILY_STATES,
  resolveDailyState,
  showsCaughtUpLine,
  showsLooks,
  stateAfterRecovery,
  type DailyState,
  type DailyStateInput,
} from '../src/features/daily-social/states.ts';

const body = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** A reader with friends, someone sharing, and looks to read. */
const THE_DAY: DailyStateInput = {
  friendCount: 4,
  sharingFriendCount: 2,
  lookCount: 3,
  failed: false,
};

// ---------------------------------------------------------------------------
// 1 · The six, each reachable
// ---------------------------------------------------------------------------

test('the map names exactly six states', () => {
  assert.deepEqual(
    [...DAILY_STATES],
    ['no_circle', 'nobody_sharing', 'quiet_day', 'the_day', 'caught_up', 'offline'],
  );
});

test('each of the six is reachable from some input', () => {
  const reached = new Set<DailyState>([
    resolveDailyState({ friendCount: 0, sharingFriendCount: 0, lookCount: 0, failed: false }),
    resolveDailyState({ friendCount: 3, sharingFriendCount: 0, lookCount: 0, failed: false }),
    resolveDailyState({ friendCount: 3, sharingFriendCount: 1, lookCount: 0, failed: false }),
    resolveDailyState(THE_DAY),
    resolveDailyState({ ...THE_DAY, reachedEnd: true }),
    resolveDailyState({ ...THE_DAY, failed: true }),
  ]);
  assert.deepEqual([...reached].sort(), [...DAILY_STATES].sort());
});

// ---------------------------------------------------------------------------
// 2 · The distinction the look list cannot make
// ---------------------------------------------------------------------------

test('zero looks is nobody-sharing when nobody shares, and a quiet day when somebody does', () => {
  // The single input that separates them, and the whole reason Worker A's RPC
  // returns an integer at all.
  const base = { friendCount: 5, lookCount: 0, failed: false };
  assert.equal(resolveDailyState({ ...base, sharingFriendCount: 0 }), 'nobody_sharing');
  assert.equal(resolveDailyState({ ...base, sharingFriendCount: 1 }), 'quiet_day');
});

test('no circle outranks nobody sharing, even on an incoherent count', () => {
  // "How many of your friends share" is not a question you can ask with no
  // friends. Friendship is the outer gate in `friend_worn_outfits` too — the
  // view is `is_friend(o.user_id)` AND a boundary, not either.
  assert.equal(
    resolveDailyState({ friendCount: 0, sharingFriendCount: 3, lookCount: 9, failed: false }),
    'no_circle',
  );
});

// ---------------------------------------------------------------------------
// 3 · Every transition §4 draws
// ---------------------------------------------------------------------------

test('S-1a → S-1b on the first mutual', () => {
  const before = { friendCount: 0, sharingFriendCount: 0, lookCount: 0, failed: false };
  assert.equal(resolveDailyState(before), 'no_circle');
  assert.equal(resolveDailyState({ ...before, friendCount: 1 }), 'nobody_sharing');
});

test('S-1b → S-2 when any mutual opts in', () => {
  const before = { friendCount: 2, sharingFriendCount: 0, lookCount: 0, failed: false };
  assert.equal(resolveDailyState(before), 'nobody_sharing');
  assert.equal(resolveDailyState({ ...before, sharingFriendCount: 1 }), 'quiet_day');
});

test('S-2 ⇄ S-3 by content, in both directions', () => {
  const quiet = { friendCount: 2, sharingFriendCount: 2, lookCount: 0, failed: false };
  assert.equal(resolveDailyState(quiet), 'quiet_day');
  assert.equal(resolveDailyState({ ...quiet, lookCount: 1 }), 'the_day');
  // And back — a look ages out of the seven-day window and the page is quiet
  // again. Nothing about having had content changes the empty state you return
  // to, which is what stops "quiet" ever being drawn as an error.
  assert.equal(resolveDailyState({ ...quiet, lookCount: 0 }), 'quiet_day');
});

test('S-3 → S-4 by reaching the end, and S-4 keeps the looks', () => {
  assert.equal(resolveDailyState(THE_DAY), 'the_day');
  assert.equal(resolveDailyState({ ...THE_DAY, reachedEnd: true }), 'caught_up');

  // Terminal, not a replacement. Reaching the bottom must not unmount what you
  // scrolled through.
  assert.equal(showsLooks('the_day'), true);
  assert.equal(showsLooks('caught_up'), true);
  assert.equal(showsCaughtUpLine('the_day'), false);
  assert.equal(showsCaughtUpLine('caught_up'), true);
});

test('reaching the end is meaningless without looks to reach the end of', () => {
  // A quiet day that somehow reports `reachedEnd` is still a quiet day; it
  // prints its own dated closure, not S-4's bare line over nothing.
  const quiet = { friendCount: 2, sharingFriendCount: 2, lookCount: 0, failed: false };
  assert.equal(resolveDailyState({ ...quiet, reachedEnd: true }), 'quiet_day');
  assert.equal(
    resolveDailyState({ friendCount: 0, sharingFriendCount: 0, lookCount: 0, failed: false, reachedEnd: true }),
    'no_circle',
  );
});

test('any state → S-5 on failure, from every one of the other five', () => {
  const inputs: DailyStateInput[] = [
    { friendCount: 0, sharingFriendCount: 0, lookCount: 0, failed: false },
    { friendCount: 3, sharingFriendCount: 0, lookCount: 0, failed: false },
    { friendCount: 3, sharingFriendCount: 1, lookCount: 0, failed: false },
    THE_DAY,
    { ...THE_DAY, reachedEnd: true },
  ];
  for (const input of inputs) {
    assert.equal(resolveDailyState({ ...input, failed: true }), 'offline');
  }
});

test('and back from S-5 to exactly the state it left', () => {
  // The half of "back without losing scroll position" a pure function can
  // keep: the failure carries no state of its own, so recovery is exact and
  // nothing about having been offline changes what is drawn afterwards.
  const inputs: DailyStateInput[] = [
    { friendCount: 0, sharingFriendCount: 0, lookCount: 0, failed: false },
    { friendCount: 3, sharingFriendCount: 0, lookCount: 0, failed: false },
    { friendCount: 3, sharingFriendCount: 1, lookCount: 0, failed: false },
    THE_DAY,
    { ...THE_DAY, reachedEnd: true },
  ];
  for (const input of inputs) {
    const before = resolveDailyState(input);
    assert.equal(resolveDailyState({ ...input, failed: true }), 'offline');
    assert.equal(stateAfterRecovery({ ...input, failed: true }), before);
  }
});

// ---------------------------------------------------------------------------
// 4 · Inputs that have not answered yet
// ---------------------------------------------------------------------------

test('a count that has not arrived never claims an empty circle by accident', () => {
  // `undefined`, NaN and a negative all floor to zero rather than throwing —
  // but the ORDER is what matters: a failed read is offline before any count is
  // consulted, so a query that errored can never be dressed as "no friends".
  const missing = undefined as unknown as number;
  assert.equal(
    resolveDailyState({ friendCount: missing, sharingFriendCount: missing, lookCount: missing, failed: true }),
    'offline',
  );
  assert.equal(
    resolveDailyState({ friendCount: Number.NaN, sharingFriendCount: 1, lookCount: 1, failed: false }),
    'no_circle',
  );
  assert.equal(
    resolveDailyState({ friendCount: -3, sharingFriendCount: 0, lookCount: 0, failed: false }),
    'no_circle',
  );
});

// ---------------------------------------------------------------------------
// 5 · The module is pure, and stays that way
// ---------------------------------------------------------------------------

test('the resolver imports nothing that would stop it being callable from a test', () => {
  // The moment this file reaches for react-native, `tsc` is happy and the node
  // runner cannot parse RN's Flow source — the six states become untestable and
  // the assertions above quietly stop running. `visibility-flags.ts` exists
  // separately from its hook for exactly this reason.
  const src = body('src/features/daily-social/states.ts');
  assert.doesNotMatch(src, /from 'react/);
  assert.doesNotMatch(src, /from 'react-native/);
  assert.doesNotMatch(src, /@supabase|@\/lib\/supabase/);
  assert.doesNotMatch(src, /useQuery|useState|useEffect/);
});

test('the state screens hold no state of their own', () => {
  // The other half of "back from offline without losing scroll position". A
  // presentational component that owned a `useState` would give the surface a
  // reason to remount it, and a remounted scroll container starts at the top.
  const src = body('src/components/daily-social/state-screens.tsx');
  assert.doesNotMatch(src, /useState|useReducer|useRef/);
  assert.doesNotMatch(src, /useQuery|useMutation|supabase/);
});
