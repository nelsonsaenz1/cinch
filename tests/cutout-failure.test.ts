/**
 * CP-05 — the notice, and the two things it must never say.
 *
 * The behaviour under this state has always been correct: a cutout that fails
 * does not fail the import. What is new is the telling, and telling has two
 * ways to be wrong that a screenshot would not catch — claiming a piece is
 * filed when no row was written, and offering a retry on a device that never
 * attempted the lift in the first place. Both are asserted here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CUTOUT_ACCEPT_ACTION,
  CUTOUT_FAILED_BODY,
  CUTOUT_FAILED_TITLE,
  CUTOUT_RETRY_ACTION,
  cutoutFailureCount,
  cutoutFailureLine,
  cutoutFailures,
} from '../src/features/ingest/cutout-failure';
import type { UploadJob } from '../src/features/ingest/queue-store';

const job = (over: Partial<UploadJob>): UploadJob =>
  ({
    id: 'j1',
    localUri: 'file:///a.jpg',
    width: 3000,
    height: 4000,
    stage: 'done',
    attempts: 0,
    tagAttempts: 0,
    progress: 1,
    ...over,
  }) as UploadJob;

test('the copy is the atlas’s, verbatim', () => {
  assert.equal(CUTOUT_FAILED_TITLE, 'Cinch could not lift the garment from the background');
  assert.equal(
    CUTOUT_FAILED_BODY,
    'Your photograph is saved and the piece is filed. Cinch will use the full picture instead.',
  );
  assert.equal(CUTOUT_RETRY_ACTION, 'Try again');
  assert.equal(CUTOUT_ACCEPT_ACTION, 'Keep the full photo');
});

test('the cause is named on this phone, and nothing is said to be queued', () => {
  // Correction 10: the cutout is Apple Vision running locally, so the copy may
  // not imply a server, a queue, or a window to wait out.
  assert.doesNotMatch(CUTOUT_FAILED_TITLE, /server|upload|network|connection/i);
  assert.doesNotMatch(CUTOUT_FAILED_BODY, /queue|waiting|until|retry|shortly|later/i);
});

test('what survived is said before what is missing', () => {
  const saved = CUTOUT_FAILED_BODY.indexOf('saved');
  const instead = CUTOUT_FAILED_BODY.indexOf('instead');
  assert.ok(saved > -1 && instead > saved, 'the loss must not be the first thing read');
});

test('the notice only appears over a piece that really was filed', () => {
  // The body's first sentence claims the piece is filed. A job whose cutout
  // failed before the row was created has filed nothing, and showing this over
  // it would be the app stating something it has not done.
  const filed = job({ id: 'filed', cutoutFailed: true, itemId: 'item-1' });
  const unfiled = job({ id: 'unfiled', cutoutFailed: true });
  assert.deepEqual(
    cutoutFailures([filed, unfiled]).map((j) => j.id),
    ['filed'],
  );
});

test('a job with no cutout failure raises nothing', () => {
  assert.deepEqual(cutoutFailures([job({ itemId: 'i' })]), []);
  assert.equal(cutoutFailureCount([job({ itemId: 'i' })]), null);
  // Explicitly false, not just absent — an unsupported device writes no flag,
  // and a successful retry writes `false`.
  assert.deepEqual(cutoutFailures([job({ itemId: 'i', cutoutFailed: false })]), []);
});

test('the count is a count, and one is never labelled', () => {
  const one = [job({ id: 'a', cutoutFailed: true, itemId: 'i1' })];
  const two = [...one, job({ id: 'b', cutoutFailed: true, itemId: 'i2' })];
  assert.equal(cutoutFailureCount(one), 1);
  assert.equal(cutoutFailureCount(two), 2);
  // The notice sits over its own subject, so "1 piece" would be counting to one.
  assert.equal(cutoutFailureLine(1), null);
  assert.equal(cutoutFailureLine(2), '2 pieces kept their full photograph.');
});

test('an unsupported device is not a failure — no notice, and no dead retry', () => {
  // `runCutout` returns three outcomes rather than a boolean precisely so this
  // case can be told apart. On a device whose OS cannot lift a subject nothing
  // was attempted, so nothing failed and a retry could only produce the same
  // nothing.
  const src = readFileSync('src/features/ingest/upload-queue.ts', 'utf8');
  assert.match(src, /outcome: 'unsupported'/);
  assert.match(src, /cutoutFailed: cutout\.outcome === 'failed'/);
  assert.doesNotMatch(src, /cutoutFailed: cutout\.outcome !== 'ok'/);
});

test('the flag is written only after the row exists', () => {
  // Both call sites sit after their item write, so "the piece is filed" is true
  // at the moment the notice becomes visible.
  const src = readFileSync('src/features/ingest/upload-queue.ts', 'utf8');
  const writes = [...src.matchAll(/cutoutFailed: cutout\.outcome === 'failed'/g)].map(
    (m) => m.index!,
  );
  assert.equal(writes.length, 2, 'one per import path — local and uploaded');
  for (const at of writes) {
    const before = src.slice(0, at);
    assert.ok(
      before.lastIndexOf('saveLocalPhoto') > -1 || before.lastIndexOf("from('items')") > -1,
      'the flag is set before anything has been filed',
    );
  }
});

test('retrying fabricates nothing and cannot cost the photograph already held', () => {
  const src = readFileSync('src/features/ingest/upload-queue.ts', 'utf8');
  const body = src.slice(src.indexOf('export async function retryCutout'));
  const fn = body.slice(0, body.indexOf('export function acceptFullPhoto'));
  // It adds the two objects that were missing. It must never rewrite the
  // original or the thumbnail — the notice's first promise is that the
  // photograph is saved, and a retry that could lose it would break that.
  assert.doesNotMatch(fn, /original\.jpg|thumb\.jpg|image_path|thumb_path/);
  // No placeholder, no stock URL, no second item.
  assert.doesNotMatch(fn, /insert\(|placeholder|https?:\/\//);
  // One pass per call: no interval, no timeout, no recursion. The declaration
  // line is dropped first, or the function's own name would read as a call.
  const inner = fn.slice(fn.indexOf('\n'));
  assert.doesNotMatch(inner, /setTimeout|setInterval|while \(|retryCutout\(/);
  // A second failure leaves the notice exactly where it was.
  assert.match(fn, /if \(cutout\.outcome !== 'ok'\)[\s\S]{0,400}?return false;/);
});

test('accepting is an outcome, and writes nothing', () => {
  const src = readFileSync('src/features/ingest/upload-queue.ts', 'utf8');
  const fn = src.slice(src.indexOf('export function acceptFullPhoto'));
  // The full photograph is already the piece's image and has been since it was
  // filed, so there is nothing to write. What is recorded is that the user
  // answered — which is the difference between a notice dismissed and one
  // never seen.
  assert.doesNotMatch(fn.slice(0, 400), /supabase|from\('items'\)|upload/);
  assert.match(fn, /cutoutFailed: false/);
});
