import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  CONSENT_WITHDRAWN_MESSAGE,
  analyticsFailureCode,
  analyticsFailureReason,
  isCapacityRefusal,
} from '../src/features/ingest/import-failure-classify';

/**
 * Ledger A15 / A28 — what `clothes_import_failed` says about a refused slot.
 *
 * For a month a full free closet was reported as `row_write_failed`, and
 * the one property that could have separated it (the SQLSTATE) cannot: both
 * ceilings and every column CHECK raise `23514`. The sentinel in the message
 * is the separator, and these pin that it is read.
 */

const CLOSET = 'Could not create item [23514]: closet_limit_reached: 10 of 10 garments';
const STORAGE = 'Could not create item [23514]: storage_limit_reached: 30 of 30 stored';

test('a refused active slot is named, not filed under row_write_failed', () => {
  assert.equal(analyticsFailureReason(CLOSET), 'closet_limit_reached');
  assert.equal(analyticsFailureCode(CLOSET), '23514');
  assert.equal(isCapacityRefusal(CLOSET), true);
});

test('a refused total slot is named separately — it has a different remedy', () => {
  assert.equal(analyticsFailureReason(STORAGE), 'storage_limit_reached');
  assert.equal(isCapacityRefusal(STORAGE), true);
});

test('a PostgREST failure stays row_write_failed with its code', () => {
  const raw = 'Could not record upload [PGRST301]: JWT expired';
  assert.equal(analyticsFailureReason(raw), 'row_write_failed');
  assert.equal(analyticsFailureCode(raw), 'PGRST301');
  assert.equal(isCapacityRefusal(raw), false);
});

test('an empty postgrest code is a transport failure, not a missing code', () => {
  // postgrest-js answers a network failure with `code: ''`, which the throw
  // site renders as `[]`. That is a different fact from "no code at all".
  assert.equal(analyticsFailureCode('Could not create item []: Network request failed'), 'net_error');
  assert.equal(analyticsFailureCode('Could not create item [no_code]: undefined'), 'no_code');
  assert.equal(analyticsFailureCode('Could not create item: something'), 'no_code');
});

test('a non-row-write failure carries no code', () => {
  assert.equal(analyticsFailureCode(CONSENT_WITHDRAWN_MESSAGE), undefined);
  assert.equal(analyticsFailureReason(CONSENT_WITHDRAWN_MESSAGE), 'consent_missing');
  assert.equal(analyticsFailureReason(undefined), 'unknown');
});

// ── Source contracts: the queue actually stops, and the gate no longer hides ──

const uploadQueue = readFileSync('src/features/ingest/upload-queue.ts', 'utf8');
const useGate = readFileSync('src/features/billing/use-gate.ts', 'utf8');
const store = readFileSync('src/features/ingest/queue-store.ts', 'utf8');

test('the drain parks a capacity refusal and everything behind it instead of retrying', () => {
  const catchBlock = uploadQueue.slice(uploadQueue.indexOf('void processJob({ ...next'));
  const refusal = catchBlock.indexOf('isCapacityRefusal(message)');
  const exhausted = catchBlock.indexOf('const exhausted = attempts >= MAX_ATTEMPTS');
  assert.ok(refusal > 0, 'the catch must classify the refusal');
  assert.ok(refusal < exhausted, 'the refusal branch must run before the retry arithmetic');
  assert.match(catchBlock, /holdQueuedJobs\(next\.id, message\)/);
  assert.match(catchBlock, /retryable: false, held/);
});

test('the row writes report their own stage, so a refusal no longer reads as a cutout', () => {
  const writes = uploadQueue.match(/update\(job\.id, \{ stage: 'writing'/g) ?? [];
  assert.ok(writes.length >= 3, `expected the three row-write sites to set 'writing', found ${writes.length}`);
});

test('held photographs survive the next sitting and do not count as in flight', () => {
  assert.match(store, /j\.stage !== 'held'/, 'selectActiveCount must exclude held jobs');
  const clear = store.slice(store.indexOf('clearSettled: () =>'), store.indexOf('clearFailed: () =>'));
  assert.doesNotMatch(clear, /'held'/, "clearSettled must not sweep 'held' jobs");
  assert.match(store, /job\.stage === 'held'\) return job;/, 'hydrate must restore held jobs as held');
});

test('the garment-limit paywall is never suppressed after an import failure (A16 reverted)', () => {
  // Every presentation of AddGarmentOverLimit in the app follows a tap on
  // "See plans". A window that hid it was hiding an answer somebody asked for.
  assert.doesNotMatch(useGate, /withinImportFailureGrace|import-failure-grace/);
  assert.doesNotMatch(uploadQueue, /recordImportFailure|import-failure-grace/);
});

test('the session read inside the queue is bounded, so a hung refresh cannot latch the drain', () => {
  assert.doesNotMatch(uploadQueue, /await getUserId\(\)/);
  assert.match(uploadQueue, /withDeadline\(getUserId\(\), USER_ID_DEADLINE_MS/);
});
