import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DONE_KEY,
  DWELL_MS,
  MIN_SESSION,
  MOVES_BEFORE_PROMPT,
  SESSION_COUNT_KEY,
  WRITE_REVIEW_URL,
  markDone,
  promptEligible,
  recordSession,
  settledIn,
  type ReviewPromptIo,
} from '../src/features/rating/review-prompt-core';

function memIo(seed: Record<string, string> = {}): ReviewPromptIo & { store: Map<string, string> } {
  const store = new Map(Object.entries(seed));
  return {
    store,
    read: (k) => store.get(k) ?? null,
    write: (k, v) => void store.set(k, v),
  };
}

test('sessions count up from nothing, one per launch', () => {
  const io = memIo();
  assert.equal(recordSession(io), 1);
  assert.equal(recordSession(io), 2);
  assert.equal(io.store.get(SESSION_COUNT_KEY), '2');
});

test('a corrupted counter reads as zero, never a throw', () => {
  const io = memIo({ [SESSION_COUNT_KEY]: 'NaN garbage' });
  assert.equal(recordSession(io), 1);
});

test('session one — the account’s own session — never asks', () => {
  const io = memIo();
  assert.equal(promptEligible(1, io), false);
  assert.equal(promptEligible(MIN_SESSION, io), true);
});

test('rate or already-rated ends the ask permanently; a dismissal does not', () => {
  const io = memIo();
  assert.equal(promptEligible(5, io), true);
  markDone(io);
  assert.equal(io.store.get(DONE_KEY), 'true');
  assert.equal(promptEligible(5, io), false);
  // Nothing in the core writes DONE on "later" — there is no API for it.
});

test('settle-in fires on dwell or on movement, whichever comes first', () => {
  assert.equal(settledIn(0, 0), false);
  assert.equal(settledIn(DWELL_MS, 0), true);
  assert.equal(settledIn(0, MOVES_BEFORE_PROMPT), true);
  assert.equal(settledIn(DWELL_MS - 1, MOVES_BEFORE_PROMPT - 1), false);
});

test('the review URL is the store’s composer, not the listing', () => {
  assert.match(WRITE_REVIEW_URL, /^https:\/\/apps\.apple\.com\/app\/id6798479578\?action=write-review$/);
});
