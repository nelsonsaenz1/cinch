/**
 * The ten-minute no-ask window after a failed import (CMO ledger A16), and the
 * Postgres-code instrumentation on `clothes_import_failed` (A15).
 *
 * The window arithmetic is pure and executed directly. What the pure core
 * cannot prove — that every terminal failure in the upload queue opens the
 * window, that the four row-write throw sites embed a code the event can
 * carry, and that the gate actually consults the window before presenting the
 * garment-limit placement — is pinned by source-contract assertions, the same
 * way promo-caps.test.ts reads its modules.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  IMPORT_FAILURE_GRACE_MS,
  recordImportFailure,
  resetImportFailureGraceForTest,
  withinImportFailureGrace,
} from '../src/features/billing/import-failure-grace';

const NOW = Date.parse('2026-09-01T16:36:49.000Z'); // the live repro's paywall moment
const MINUTE = 60 * 1000;

// ── The window ──────────────────────────────────────────────────────────────

test('no failure ever recorded means no suppression', () => {
  resetImportFailureGraceForTest();
  assert.equal(withinImportFailureGrace(NOW), false);
});

test('the live repro is inside the window: failure 16:34:28, paywall 16:36:49', () => {
  resetImportFailureGraceForTest();
  recordImportFailure(Date.parse('2026-09-01T16:34:28.000Z'));
  assert.equal(withinImportFailureGrace(NOW), true);
});

test('the window is ten minutes, closed at exactly its edge', () => {
  assert.equal(IMPORT_FAILURE_GRACE_MS, 10 * MINUTE);
  resetImportFailureGraceForTest();
  recordImportFailure(NOW - IMPORT_FAILURE_GRACE_MS + 1);
  assert.equal(withinImportFailureGrace(NOW), true);
  recordImportFailure(NOW - IMPORT_FAILURE_GRACE_MS);
  assert.equal(withinImportFailureGrace(NOW), false);
});

test('a later failure re-opens the window from its own moment', () => {
  resetImportFailureGraceForTest();
  recordImportFailure(NOW - 20 * MINUTE);
  assert.equal(withinImportFailureGrace(NOW), false);
  recordImportFailure(NOW - MINUTE);
  assert.equal(withinImportFailureGrace(NOW), true);
});

test('a clock that moved backwards suppresses rather than asks', () => {
  resetImportFailureGraceForTest();
  recordImportFailure(NOW + 5 * MINUTE);
  assert.equal(withinImportFailureGrace(NOW), true);
});

// ── Source contracts ────────────────────────────────────────────────────────

const uploadQueue = readFileSync('src/features/ingest/upload-queue.ts', 'utf8');
const useGate = readFileSync('src/features/billing/use-gate.ts', 'utf8');

test('every terminal import failure goes through the one helper that opens the window', () => {
  // The raw event name may appear exactly once — inside `trackImportFailed`,
  // whose body records the failure first. A second bare emitter would be a
  // failure that counts without suppressing.
  const bareEmits = uploadQueue.match(/track\('clothes_import_failed'/g) ?? [];
  assert.equal(bareEmits.length, 1);
  const helper = uploadQueue.slice(uploadQueue.indexOf('function trackImportFailed'));
  assert.ok(
    helper.indexOf('recordImportFailure()') < helper.indexOf("track('clothes_import_failed'"),
    'trackImportFailed must record the failure before emitting',
  );
  // And the queue actually uses it, at every terminal transition (eight call
  // sites as of 2026-09-01; more is fine, fewer means a site was orphaned).
  const calls = uploadQueue.match(/trackImportFailed\(\{/g) ?? [];
  assert.ok(calls.length >= 8, `expected ≥8 trackImportFailed call sites, found ${calls.length}`);
});

test('all four row-write throw sites embed the Postgres code the event carries', () => {
  const createSites = uploadQueue.match(/Could not create item \[\$\{error\?\.code \?\? 'no_code'\}\]/g) ?? [];
  assert.equal(createSites.length, 2);
  const recordSites =
    uploadQueue.match(/Could not record upload \[\$\{updateError\.code \?\? 'no_code'\}\]/g) ?? [];
  assert.equal(recordSites.length, 2);
  // The extractor only speaks for row writes — no other failure's message may
  // smuggle a bracketed token into analytics.
  assert.ok(uploadQueue.includes("if (!/Could not create item|Could not record upload/i.test(raw)) return undefined;"));
});

test('the gate consults the window before presenting the garment-limit placement', () => {
  assert.ok(useGate.includes('Placement.AddGarmentOverLimit && withinImportFailureGrace()'));
  // The suppression is measured, and resolves to the outcome every call site
  // already handles rather than hanging or granting.
  assert.ok(useGate.includes("reason: 'import_failure_grace'"));
  const guard = useGate.slice(useGate.indexOf('withinImportFailureGrace()'));
  assert.ok(guard.slice(0, 400).includes("return 'unavailable'"));
});
