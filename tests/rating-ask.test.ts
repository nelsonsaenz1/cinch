import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ASKED_KEY,
  MIN_DAYS_BETWEEN_ASKS,
  evaluateRatingAsk,
  type RatingAskIo,
  type RatingAskOutcome,
} from '../src/features/rating/rating-ask-core';

/**
 * The App Store rating ask: one moment, one cool-down, write-before-request.
 *
 * The behavioural half executes every branch of the core; the source half
 * pins the things no unit can see — that the wear sheet's Done is the ONLY
 * call site, and that no error path can ever ask.
 */

const NOW = new Date('2026-08-25T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function io(overrides: Partial<RatingAskIo> & { stored?: string | null } = {}) {
  const writes: [string, string][] = [];
  const requests: number[] = [];
  const impl: RatingAskIo = {
    getItem: async () => overrides.stored ?? null,
    setItem: async (key, value) => {
      writes.push([key, value]);
    },
    request: () => {
      requests.push(1);
    },
    cancelled: () => false,
    ...overrides,
  };
  return { impl, writes, requests };
}

async function run(
  overrides: Parameters<typeof io>[0] = {},
  at: Date = NOW,
): Promise<{ outcome: RatingAskOutcome; writes: [string, string][]; requests: number[] }> {
  const { impl, writes, requests } = io(overrides);
  const outcome = await evaluateRatingAsk(at, impl);
  return { outcome, writes, requests };
}

test('a device that never asked asks, and stamps the moment first', async () => {
  const { outcome, writes, requests } = await run();
  assert.equal(outcome, 'requested');
  assert.equal(requests.length, 1);
  assert.deepEqual(writes, [[ASKED_KEY, NOW.toISOString()]]);
});

test('inside the cool-down nothing is asked and nothing is written', async () => {
  const recent = new Date(NOW.getTime() - (MIN_DAYS_BETWEEN_ASKS - 1) * DAY_MS);
  const { outcome, writes, requests } = await run({ stored: recent.toISOString() });
  assert.equal(outcome, 'too_soon');
  assert.equal(requests.length, 0);
  assert.equal(writes.length, 0);
});

test('the day the cool-down lapses, it asks again', async () => {
  const stale = new Date(NOW.getTime() - MIN_DAYS_BETWEEN_ASKS * DAY_MS);
  const { outcome, requests } = await run({ stored: stale.toISOString() });
  assert.equal(outcome, 'requested');
  assert.equal(requests.length, 1);
});

test('a garbled marker reads as never-asked and is overwritten with a real one', async () => {
  const { outcome, writes } = await run({ stored: 'not-a-date' });
  assert.equal(outcome, 'requested');
  assert.deepEqual(writes, [[ASKED_KEY, NOW.toISOString()]]);
});

test('cancelled before the read-back: nothing written, nothing asked', async () => {
  const { outcome, writes, requests } = await run({ cancelled: () => true });
  assert.equal(outcome, 'cancelled');
  assert.equal(writes.length, 0);
  assert.equal(requests.length, 0);
});

test('cancelled between write and request: the marker survives, the ask does not', async () => {
  // The deliberate "better wrong" — identical to the trial-expiry flow: dying
  // between the two lines costs one quiet cool-down, never a doubled ask.
  let calls = 0;
  const { outcome, writes, requests } = await run({
    cancelled: () => ++calls > 1,
  });
  assert.equal(outcome, 'marked_only');
  assert.equal(writes.length, 1);
  assert.equal(requests.length, 0);
});

test('the self-cap fits inside Apple display budget by construction', () => {
  // Three asks per 365 days is Apple's ceiling on DISPLAYS; the cool-down
  // must make a fourth CALL within a year impossible.
  assert.ok(MIN_DAYS_BETWEEN_ASKS * 3 >= 365 - MIN_DAYS_BETWEEN_ASKS);
  assert.ok(Math.floor(365 / MIN_DAYS_BETWEEN_ASKS) <= 3);
});

// ── Source contracts ───────────────────────────────────────────────────────

const read = (p: string) => readFileSync(p, 'utf8');

test('the wear sheet Done is the only call site', () => {
  const today = read('src/app/(tabs)/index.tsx');
  assert.equal(
    (today.match(/askForRatingAfterWear\(\)/g) ?? []).length,
    1,
    'the ask fires from more or fewer places than the settled wear',
  );
  // And it fires from onDone — the settled composition — not onCancel, not
  // onError, not an effect.
  assert.match(today, /onDone=\{\(\) => \{\s*closeWearSheet\(\);[\s\S]{0,400}askForRatingAfterWear\(\);/);

  // No other screen asks.
  for (const file of [
    'src/app/(tabs)/closet.tsx',
    'src/app/(tabs)/stylist.tsx',
    'src/app/(tabs)/plan.tsx',
    'src/app/(tabs)/explore.tsx',
    'src/app/reveal.tsx',
  ]) {
    assert.doesNotMatch(read(file), /askForRatingAfterWear|requestReview/, `${file} asks for a rating`);
  }
});

test('the helper gates on availability and sends no properties', () => {
  const src = read('src/features/rating/ask-for-rating.ts');
  assert.match(src, /isAvailableAsync/, 'requestReview called without the availability gate');
  assert.match(
    src,
    /track\('rating_prompt_requested'\)/,
    'the ask must be countable, with no payload beside the name',
  );
  assert.doesNotMatch(
    src,
    /track\('rating_prompt_requested',/,
    'rating_prompt_requested must carry no properties',
  );
});

test('the core owns the decision — the helper contains no dates and no maths', () => {
  const src = read('src/features/rating/ask-for-rating.ts');
  assert.doesNotMatch(src, /ASKED_KEY|getTime|Date\.parse|DAY_MS/, 'cool-down logic leaked into the helper');
  assert.match(src, /evaluateRatingAsk/, 'the helper must delegate to the tested core');
});
