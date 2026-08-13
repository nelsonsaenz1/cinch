/**
 * The batch import's four decisions.
 *
 * A batch is N writes over a mobile connection, and every interesting way it
 * can be wrong is a decision made before the first byte moves: which rows are
 * duplicates of each other, which the closet already holds, whether there is
 * room for the rest, and whether the answer to that stops everything.
 *
 * The failure this is really about is the boring one. A user taps "Add 3 to
 * closet" on a train, three items are written, the response never arrives, and
 * the app retries. Without the checks below that is six shirts — and the user
 * has no way to tell which three to delete, because all six are identical.
 *
 * `planCatalogueBatch` is pure so this can be proved without a Postgres. The
 * database half — the partial unique index that catches the racing case, and
 * the trigger that remains the only authority on capacity — is asserted in
 * `supabase/tests/14_catalogue_import.sql`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type BatchRow,
  planCatalogueBatch,
  type Room,
  summariseBatch,
} from '../supabase/functions/garment-search/import-batch.ts';

const row = (externalId: string, colourLabel?: string): BatchRow => ({
  externalId,
  imageUrl: `https://cdn.shop.test/${externalId}.jpg`,
  pageUrl: `https://shop.test/p/${externalId}`,
  title: 'Crew Neck Jersey Tee',
  colourLabel,
});

/** Three colourways of one shirt — the launch fixture's own family. */
const THREE = [row('df-101', 'White'), row('df-102', 'Black'), row('df-103', 'Heather Grey')];

const room = (over: Partial<Room> = {}): Room => ({
  active: 0,
  active_limit: 10,
  total: 0,
  total_limit: 30,
  ...over,
});

const NONE = new Map<string, string>();

// ---------------------------------------------------------------------------
// Multiple colours
// ---------------------------------------------------------------------------

test('every selected colourway is planned, in the order it was sent', () => {
  const plan = planCatalogueBatch(THREE, NONE, room());
  assert.equal(plan.refusal, null);
  assert.deepEqual(plan.pending.map((r) => r.externalId), ['df-101', 'df-102', 'df-103']);
  assert.deepEqual(plan.alreadyHeld, []);
});

test('the same colourway sent twice is one garment, not a failure', () => {
  // The unique index would refuse the second write anyway. Deduplicating here
  // is what makes the ANSWER match the question rather than containing a
  // spurious failure the user cannot act on.
  const plan = planCatalogueBatch([...THREE, row('df-101', 'White')], NONE, room());
  assert.equal(plan.pending.length, 3);
});

// ---------------------------------------------------------------------------
// Idempotent retry
// ---------------------------------------------------------------------------

test('a retry of a batch that fully landed writes nothing and reports success', () => {
  const held = new Map([
    ['df-101', 'item-1'],
    ['df-102', 'item-2'],
    ['df-103', 'item-3'],
  ]);
  const plan = planCatalogueBatch(THREE, held, room({ active: 3 }));

  assert.deepEqual(plan.pending, [], 'a full retry would have written something');
  assert.equal(plan.refusal, null, 'a full retry was refused');
  assert.deepEqual(
    plan.alreadyHeld.map((h) => h.itemId),
    ['item-1', 'item-2', 'item-3'],
    'the retry lost track of the items it had already created',
  );
});

test('a retry of a batch that half landed writes only the half that did not', () => {
  const held = new Map([['df-101', 'item-1']]);
  const plan = planCatalogueBatch(THREE, held, room({ active: 1 }));

  assert.deepEqual(plan.pending.map((r) => r.externalId), ['df-102', 'df-103']);
  assert.deepEqual(plan.alreadyHeld, [{ externalId: 'df-101', itemId: 'item-1' }]);
});

test('capacity counts what would be WRITTEN, never what was sent', () => {
  // The trap: a free closet at 9 of 10, retrying a batch of three of which two
  // already landed. Counting all three refuses the retry for the slots its own
  // successes are sitting in — a dead end the user cannot get out of by any
  // action available to them.
  const held = new Map([
    ['df-101', 'item-1'],
    ['df-102', 'item-2'],
  ]);
  const plan = planCatalogueBatch(THREE, held, room({ active: 9, total: 9 }));

  assert.equal(plan.refusal, null, 'the retry was refused for its own successes');
  assert.deepEqual(plan.pending.map((r) => r.externalId), ['df-103']);
});

// ---------------------------------------------------------------------------
// Capacity refusal, before any write
// ---------------------------------------------------------------------------

test('three colourways into two free slots is refused as a batch', () => {
  // Not two written and an apology for the third: the user asked one question,
  // and half an answer chosen by the app is the worst available outcome.
  const plan = planCatalogueBatch(THREE, NONE, room({ active: 8, active_limit: 10 }));

  assert.ok(plan.refusal, 'a batch that does not fit was allowed to start');
  assert.equal(plan.refusal.code, 'closet_limit_reached');
  assert.equal(plan.refusal.requested, 3);
  assert.equal(plan.refusal.active, 8);
  assert.equal(plan.refusal.activeLimit, 10);
});

test('a batch that exactly fills the closet is allowed', () => {
  // Off-by-one in the direction that matters: refusing the batch that exactly
  // fits would make the last slot unreachable.
  const plan = planCatalogueBatch(THREE, NONE, room({ active: 7, active_limit: 10 }));
  assert.equal(plan.refusal, null);
});

test('the archive ceiling refuses with its own code, because it has its own remedy', () => {
  // A full ACTIVE closet is fixed by storing a piece. A full account is not —
  // telling somebody to make room when making room will not help is the dead
  // end migration 20260808190100 exists to remove.
  const plan = planCatalogueBatch(THREE, NONE, room({ total: 29, total_limit: 30 }));
  assert.ok(plan.refusal);
  assert.equal(plan.refusal.code, 'storage_limit_reached');
  assert.equal(plan.refusal.total, 29);
  assert.equal(plan.refusal.totalLimit, 30);
});

test('an unreadable capacity read does not close the door', () => {
  // `import_capacity` is a PREFLIGHT and `items_enforce_limit` is the
  // authority. Refusing on a failed read would turn a monitoring blip into a
  // closed door; letting it through means the trigger answers, which is what
  // was always going to decide.
  const plan = planCatalogueBatch(THREE, NONE, null);
  assert.equal(plan.refusal, null);
  assert.equal(plan.pending.length, 3);
});

test('a retry with nothing left to write is never refused for capacity', () => {
  const held = new Map([['df-101', 'i1'], ['df-102', 'i2'], ['df-103', 'i3']]);
  const plan = planCatalogueBatch(THREE, held, room({ active: 10, active_limit: 10 }));
  assert.equal(plan.refusal, null, 'a full closet refused a retry that would write nothing');
});

// ---------------------------------------------------------------------------
// Partial recovery
// ---------------------------------------------------------------------------

test('a failed row is reported beside the successes, never instead of them', () => {
  // The handoff: "colourways succeed and fail independently and successes are
  // never rolled back." So the response is a list, not a verdict.
  const summary = summariseBatch([
    { externalId: 'df-101', status: 'added', itemId: 'i1' },
    { externalId: 'df-102', status: 'failed', error: 'image_unreachable', message: 'x' },
    { externalId: 'df-103', status: 'added', itemId: 'i3' },
  ]);
  assert.deepEqual(summary, { added: 2, alreadyAdded: 0, failed: 1 });
});

test('already-added is a success, and is counted apart from added', () => {
  // A retry that finds everything already there reports three already-added and
  // zero failed — which is what lets the screen say "these are in your closet"
  // rather than "nothing happened".
  const summary = summariseBatch([
    { externalId: 'df-101', status: 'already-added', itemId: 'i1' },
    { externalId: 'df-102', status: 'already-added', itemId: 'i2' },
    { externalId: 'df-103', status: 'already-added', itemId: 'i3' },
  ]);
  assert.deepEqual(summary, { added: 0, alreadyAdded: 3, failed: 0 });
});
