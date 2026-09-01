/**
 * The returning_free schedule — every edge of both windows, executed.
 *
 * `evaluateReturningFree` (returning-free-core.ts) is pure, so the boundaries
 * are run directly rather than pinned by grep: day 3 and day 6 at their exact
 * instants, day 7 and day 14 at theirs, the spacing rule between the two asks,
 * and the qualifications that silence the whole calendar. The convention is
 * promo-caps.test.ts's — half-open windows, one millisecond either side of
 * every edge.
 *
 * What the core cannot prove — that the hook goes through `presentPromo`,
 * claims a once-per-open latch, and filters the ledger to this placement —
 * is pinned by source-contract assertions at the bottom, the same way
 * promo-caps.test.ts reads present-promo.ts.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  evaluateReturningFree,
  type ReturningImpression,
} from '../src/features/billing/returning-free-core';

const NOW = '2026-08-31T12:00:00.000Z';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const nowMs = new Date(NOW).getTime();

/** An account created `ms` before NOW. */
const createdAgo = (ms: number) => new Date(nowMs - ms).toISOString();

/** A returning_free impression shown `ms` before NOW. */
const shownAgo = (ms: number): ReturningImpression => ({
  shownAtIso: new Date(nowMs - ms).toISOString(),
});

const DUE_DAY3 = { due: true, window: 'day3' } as const;
const DUE_DAY7 = { due: true, window: 'day7' } as const;
const NOT_DUE = { due: false, window: null } as const;

// ── The day-3 window: [3d, 6d) ──────────────────────────────────────────────

test('due at exactly 3 days — the window edge is inclusive', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(3 * DAY), 1, []), DUE_DAY3);
});

test('one millisecond before day 3 is not due', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(3 * DAY - 1), 1, []), NOT_DUE);
});

test('due throughout the window — day 4, day 5', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(4 * DAY), 3, []), DUE_DAY3);
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(6 * DAY - 1), 3, []), DUE_DAY3);
});

test('the day-3 window closes at exactly 6 days — the edge is excluded', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(6 * DAY), 1, []), NOT_DUE);
});

test('any prior returning_free impression spends the day-3 window', () => {
  assert.deepEqual(
    evaluateReturningFree(NOW, createdAgo(4 * DAY), 5, [shownAgo(1 * DAY)]),
    NOT_DUE,
  );
});

test('a brand-new account is never asked — day 0 through day 3 exclusive', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(0), 10, []), NOT_DUE);
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(1 * DAY), 10, []), NOT_DUE);
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(2 * DAY), 10, []), NOT_DUE);
});

// ── The gap: [6d, 7d) is silent ─────────────────────────────────────────────

test('the stretch between the windows never asks', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(6 * DAY), 5, []), NOT_DUE);
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(7 * DAY - 1), 5, []), NOT_DUE);
});

// ── The day-7 window: [7d, 14d) ─────────────────────────────────────────────

test('due at exactly 7 days with an empty ledger', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(7 * DAY), 1, []), DUE_DAY7);
});

test('due through the window — day 10, and one millisecond before day 14', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(10 * DAY), 2, []), DUE_DAY7);
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(14 * DAY - 1), 2, []), DUE_DAY7);
});

test('the calendar ends at exactly 14 days — no stale ask, ever after', () => {
  // The bounded upper edge is the product decision the core documents: a
  // return offer weeks later is spam, not a return offer, and the 7-day trial
  // it sells has nothing left to say by then.
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(14 * DAY), 5, []), NOT_DUE);
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(30 * DAY), 5, []), NOT_DUE);
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(365 * DAY), 5, []), NOT_DUE);
});

// ── The spacing rule between the two asks ───────────────────────────────────

test('day 7 allows a second ask when the first was exactly 3 days ago', () => {
  assert.deepEqual(
    evaluateReturningFree(NOW, createdAgo(7 * DAY), 1, [shownAgo(3 * DAY)]),
    DUE_DAY7,
  );
});

test('day 7 refuses a second ask one millisecond inside 3 days', () => {
  assert.deepEqual(
    evaluateReturningFree(NOW, createdAgo(7 * DAY), 1, [shownAgo(3 * DAY - 1)]),
    NOT_DUE,
  );
});

test('the realistic pair: asked on day 3, due again on day 8', () => {
  // Created 8 days ago, shown the day-3 ask 5 days ago — the exact history a
  // reader who took both offers accumulates.
  assert.deepEqual(
    evaluateReturningFree(NOW, createdAgo(8 * DAY), 4, [shownAgo(5 * DAY)]),
    DUE_DAY7,
  );
});

test('two prior impressions close the door for good', () => {
  assert.deepEqual(
    evaluateReturningFree(NOW, createdAgo(10 * DAY), 4, [shownAgo(7 * DAY), shownAgo(3 * DAY)]),
    NOT_DUE,
  );
});

test('an unparseable prior timestamp fails the spacing test rather than passing it', () => {
  // Recency unprovable resolves to silence — the same direction present-promo
  // takes on an unreadable ledger.
  assert.deepEqual(
    evaluateReturningFree(NOW, createdAgo(8 * DAY), 4, [{ shownAtIso: 'not-a-date' }]),
    NOT_DUE,
  );
});

// ── The outfit qualification ────────────────────────────────────────────────

test('a closet that never made a number is never asked, in either window', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(4 * DAY), 0, []), NOT_DUE);
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(8 * DAY), 0, []), NOT_DUE);
});

test('a nonsensical count is a zero, not a pass', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(4 * DAY), -1, []), NOT_DUE);
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(4 * DAY), NaN, []), NOT_DUE);
});

test('one outfit is enough — the qualification is "made a number", not a bar', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(3 * DAY), 1, []), DUE_DAY3);
});

// ── Unreadable inputs resolve to silence ────────────────────────────────────

test('a garbage clock or creation date is never due', () => {
  assert.deepEqual(evaluateReturningFree('not-a-date', createdAgo(4 * DAY), 3, []), NOT_DUE);
  assert.deepEqual(evaluateReturningFree(NOW, 'not-a-date', 3, []), NOT_DUE);
});

test('an account created in the future is a broken clock, not a candidate', () => {
  assert.deepEqual(evaluateReturningFree(NOW, createdAgo(-1 * DAY), 3, []), NOT_DUE);
});

// ── The hook's contract, pinned as source ───────────────────────────────────

const HOOK_RAW = readFileSync('src/features/billing/use-returning-free.ts', 'utf8');
const HOOK = HOOK_RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the hook goes through presentPromo, never the bare gate', () => {
  assert.match(HOOK, /presentPromo\(gate, Placement\.ReturningFree/);
  assert.doesNotMatch(HOOK, /gate\.present\(/);
});

test('the ledger is filtered to this placement before the core sees it', () => {
  assert.match(HOOK, /row\.placement === Placement\.ReturningFree/);
});

test('the once-per-app-open latch is claimed, not read', () => {
  assert.match(HOOK, /claimReturningFree\(\)/);
  assert.match(HOOK, /let claimed = false/);
});

test('the evaluation is deferred behind interactions, off the render', () => {
  assert.match(HOOK, /InteractionManager\.runAfterInteractions/);
});

test('the cheap gates run before anything is claimed or fetched', () => {
  assert.match(HOOK, /if \(loading \|\| unconfirmed \|\| plan !== 'free' \|\| trialing\) return/);
  assert.match(HOOK, /if \(outfitCount < 1\) return/);
});
