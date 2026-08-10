/**
 * The Privacy & data pages' arithmetic and its two honesty rules.
 *
 * Both rules are the reason this file exists rather than a nicety:
 *
 *   1. Expiry is derived from the clock, never stored. `data_exports` has no
 *      'expired' status on purpose — "a status that needs a cron job to stay
 *      true is a status that will one day be wrong".
 *   2. Photo sends are two numbers, not one. Adding the itemised tagging count
 *      to the un-itemisable listing count would replace an undercount with an
 *      overcount and print it as a single confident figure.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  consentStatusLine,
  earlierExportLine,
  exportStateOf,
  formatBytes,
  sentClause,
  type DataExport,
} from '../src/features/privacy/format';

const NOW = new Date('2026-08-10T12:00:00Z');

function row(overrides: Partial<DataExport>): DataExport {
  return {
    id: 'x',
    requestedAt: '2026-08-01T09:38:00Z',
    status: 'ready',
    readyAt: '2026-08-01T10:02:00Z',
    bytes: 412_000_000,
    expiresAt: '2026-08-08T09:38:00Z',
    error: null,
    ...overrides,
  };
}

// ── Expiry is a fact about the clock ───────────────────────────────────────

test('a ready export whose expiry has passed reads as expired', () => {
  assert.equal(exportStateOf(row({}), NOW), 'expired');
});

test('a ready export still inside its window reads as ready', () => {
  assert.equal(exportStateOf(row({ expiresAt: '2026-08-17T09:38:00Z' }), NOW), 'ready');
});

test('a ready export with no expiry recorded is not called expired', () => {
  // `expires_at` is nullable and the worker writes it; a null must never be
  // rendered as "link expired", which would send someone to request a fresh
  // export they do not need.
  assert.equal(exportStateOf(row({ expiresAt: null }), NOW), 'ready');
});

test('pending and failed are the column’s own values and pass straight through', () => {
  assert.equal(exportStateOf(row({ status: 'pending', expiresAt: null }), NOW), 'pending');
  // A failed row could still carry a stale expiry; the clock must not turn a
  // failure into an "expired" success.
  assert.equal(exportStateOf(row({ status: 'failed' }), NOW), 'failed');
});

// ── Sizes are measured, so they are formatted, not estimated ───────────────

test('bytes are formatted in the units the Files app uses', () => {
  assert.equal(formatBytes(412_000_000), '412 MB');
  assert.equal(formatBytes(1_240_000_000), '1.2 GB');
  assert.equal(formatBytes(884_000), '884 kB');
  assert.equal(formatBytes(512), '512 bytes');
});

test('a failed export shows no size rather than a measured-looking zero', () => {
  assert.equal(
    earlierExportLine(row({ status: 'failed', bytes: null }), NOW),
    'did not finish',
  );
});

test('an expired export still names its real size', () => {
  assert.equal(earlierExportLine(row({}), NOW), '412 MB · link expired');
});

// ── Two doors, two numbers ─────────────────────────────────────────────────

test('nothing sent says so plainly', () => {
  assert.equal(sentClause(0, 0), 'No photo has left this phone.');
});

test('the listing count is never folded into the photo count', () => {
  const line = sentClause(12, 3);
  // The itemised figure keeps its own sentence…
  assert.match(line, /12 photos sent for tagging\./);
  // …and the second door is counted as searches, not as photographs, because
  // a search run from a typed description alone sends no image and `ai_calls`
  // cannot tell the two apart.
  assert.match(line, /3 listing searches/);
  assert.doesNotMatch(line, /15/);
});

test('a single send of either kind is singular', () => {
  assert.match(sentClause(1, 0), /1 photo sent for tagging\./);
  assert.match(sentClause(0, 1), /1 listing search/);
});

test('listing sends are still disclosed when nothing was ever tagged', () => {
  // The undercount this replaces would have said "No photo has left this
  // phone" to somebody who had run three listing matches.
  const line = sentClause(0, 3);
  assert.match(line, /No photo has been sent for tagging\./);
  assert.match(line, /3 listing searches/);
});

// ── The status line ────────────────────────────────────────────────────────

test('withdrawn consent still reports what was sent while it was on', () => {
  const line = consentStatusLine(false, null, '2026-07-28T00:00:00Z', 12, 3);
  assert.match(line, /^Off since /);
  assert.match(line, /12 photos sent for tagging\./);
});

test('a live consent with no recorded date does not invent one', () => {
  assert.equal(consentStatusLine(true, null, null, 0, 0), 'On. No photo has left this phone.');
});
