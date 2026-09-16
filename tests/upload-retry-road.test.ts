import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * Ledger A83 (2026-09-16) — a retry can finish an upload.
 *
 * 2026-09-14 20:33Z, the first paying account: three cutout transfers died in
 * flight; attempts two and three of each job were refused a signed URL (400,
 * the original already existed); the retry door then re-asked the TAGGER for
 * rows with no image, four times, 409 each. Fifteen `unknown` events. These
 * pin the three fixes: upsert on the signed URL, the stage a run died at
 * kept on the job, and the retry door reading it.
 */
const UQ = readFileSync('src/features/ingest/upload-queue.ts', 'utf8');
const STORE = readFileSync('src/features/ingest/queue-store.ts', 'utf8');

test('signed upload URLs are minted with upsert, so a retry can write over what landed', () => {
  assert.match(UQ, /\.createSignedUploadUrl\(path, \{ upsert: true \}\)/);
  assert.equal((UQ.match(/createSignedUploadUrl\(/g) ?? []).length, 1, 'one upload road');
});

test('every upload throw carries a bracketed code for the classifier', () => {
  assert.match(UQ, /Could not get an upload URL \[\$\{code\}\]/);
  assert.match(UQ, /Upload did not reach the server \[net_error\]/);
  assert.match(UQ, /Upload failed \[\$\{result\.status\}\]/);
  assert.doesNotMatch(UQ, /Upload failed with \$\{/, 'the uncoded message is gone');
});

test('the drain loop records the stage a run died at, and the store carries it', () => {
  assert.match(UQ, /retryable: exhausted \? true : undefined,[\s\S]{0,400}?diedAt,\s*\}\);/);
  assert.match(STORE, /diedAt\?: JobStage;/);
});

test('the retry door sends an owed upload back through the queue, never to the tagger', () => {
  const road = "if (!itemId || (job.diedAt !== undefined && job.diedAt !== 'tagging') || isImageMissing(job.error)) {";
  const owed = UQ.indexOf(road);
  assert.ok(owed !== -1, 'the three signs an upload is owed, in one condition');
  assert.match(UQ.slice(owed, owed + 400), /diedAt: undefined,/);
  assert.doesNotMatch(UQ, /if \(!job\.itemId\) \{\s*update\(jobId, \{\s*stage: 'queued'/, 'the itemId-only test is gone');
});

test('a 409 with no image is blocked with the sentinel and marked retryable', () => {
  const branch = UQ.indexOf("status === 409 && /no image/i.test(detail ?? '')");
  assert.ok(branch !== -1);
  const block = UQ.slice(branch, branch + 200);
  assert.match(block, /kind: 'blocked', message: IMAGE_MISSING_MESSAGE, retryable: true, accountWide: false/);
  // Ahead of the catch-all 409 (`in_progress`), which stays a retry.
  assert.ok(branch < UQ.indexOf('// 409 (another invocation holds the claim)'));
});
