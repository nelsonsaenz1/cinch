import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admitBatch } from '../src/features/ingest/batch-capacity';

/**
 * Ledger A28 — the batch pre-flight that replaced a boolean.
 *
 * The regression that produced 46 `clothes_import_failed` events in 44
 * seconds: an empty free closet, 27 photographs picked, then 29. `full` was
 * false both times so everything went to the queue; 10 landed and 46 met the
 * trigger three times each. These pin the count-based admission that decides
 * BEFORE any photograph is encoded.
 */

const FREE = { limit: 10, storedLimit: 30, loading: false };
const cap = (used: number, stored = used, extra: Record<string, unknown> = {}) => ({
  ...FREE,
  used,
  stored,
  ...extra,
});

test('an empty closet admits a batch that fits', () => {
  assert.deepEqual(admitBatch(10, cap(0)), { kind: 'all', accept: 10 });
});

test('the live repro: an empty closet and 27 photographs admits ten, holds seventeen', () => {
  assert.deepEqual(admitBatch(27, cap(0)), {
    kind: 'partial',
    accept: 10,
    hold: 17,
    used: 0,
    limit: 10,
    wall: 'active',
  });
});

test('nine of ten used and 56 picked admits one and holds 55', () => {
  const verdict = admitBatch(56, cap(9));
  assert.equal(verdict.kind, 'partial');
  assert.equal(verdict.accept, 1);
  assert.equal(verdict.kind === 'partial' && verdict.hold, 55);
});

test('a full closet holds everything and names the active wall', () => {
  assert.deepEqual(admitBatch(3, cap(10)), {
    kind: 'none',
    accept: 0,
    hold: 3,
    used: 10,
    limit: 10,
    wall: 'active',
  });
});

test('the total ceiling refuses before the active one, with its own numbers', () => {
  // Five active, thirty rows in all: storing a piece would not help here.
  const verdict = admitBatch(1, cap(5, 30));
  assert.equal(verdict.kind, 'none');
  assert.equal(verdict.kind === 'none' && verdict.wall, 'total');
  assert.equal(verdict.kind === 'none' && verdict.used, 30);
  assert.equal(verdict.kind === 'none' && verdict.limit, 30);
});

test('an unread count never refuses — the trigger stays the authority', () => {
  assert.deepEqual(admitBatch(56, cap(0, 0, { loading: true })), { kind: 'all', accept: 56 });
});

test('a batch that exactly fills the closet is admitted whole', () => {
  assert.deepEqual(admitBatch(7, cap(3)), { kind: 'all', accept: 7 });
});

test('a grandfathered over-cap closet holds everything and never goes negative', () => {
  const verdict = admitBatch(2, cap(14));
  assert.equal(verdict.kind, 'none');
  assert.equal(verdict.accept, 0);
});

test('photographs already queued without a row take slots the server cannot see', () => {
  // Second pick of the live repro: the first ten are still uploading, the
  // count still reads zero, and the queue holds seven that have no row yet.
  assert.deepEqual(admitBatch(29, cap(0, 0, { pendingRows: 7 })), {
    kind: 'partial',
    accept: 3,
    hold: 26,
    used: 0,
    limit: 10,
    wall: 'active',
  });
});

test('nothing requested is nothing admitted, and never a refusal', () => {
  assert.deepEqual(admitBatch(0, cap(10)), { kind: 'all', accept: 0 });
});

test('a partial admission names the wall that bounded it', () => {
  // Five active of ten, twenty-eight rows of thirty: two fit, and the
  // ceiling that stops the third is the TOTAL one — "make room" cannot help.
  const verdict = admitBatch(5, cap(5, 28));
  assert.equal(verdict.kind, 'partial');
  assert.equal(verdict.accept, 2);
  assert.equal(verdict.kind === 'partial' && verdict.wall, 'total');
  assert.equal(verdict.kind === 'partial' && verdict.limit, 30);
  // And the ordinary case names the active wall with the active numbers.
  const active = admitBatch(27, cap(0));
  assert.equal(active.kind === 'partial' && active.wall, 'active');
  assert.equal(active.kind === 'partial' && active.limit, 10);
});
