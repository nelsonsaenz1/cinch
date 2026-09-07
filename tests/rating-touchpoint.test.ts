import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { evaluateRatingAsk, type RatingAskIo } from '../src/features/rating/rating-ask-core';
import {
  TOUCHPOINT_COOLDOWN_DAYS,
  TOUCHPOINT_KEY,
  touchedRecently,
  touchpointStamp,
} from '../src/features/rating/rating-touchpoint-core';
import {
  DWELL_MS,
  PENDING_MOMENT_KEY,
  blockedByOtherSurface,
  markTouchpoint,
  promptEligible,
  settledIn,
  type ReviewPromptIo,
} from '../src/features/rating/review-prompt-core';

/**
 * Issue 6 (2026-08-31 funnel run): the native settled-wear ask (A) and the
 * custom review card (B) each decide independently, off separate storage
 * keys, so a single wear-completion window can find both cores saying
 * "ask" at once — the reader sees the Cinch card AND the system sheet
 * within seconds of each other.
 *
 * These tests model the collision at the decision level (no React, no
 * native module) and then prove the shared touchpoint closes it: once any
 * surface fires, every other surface reads the same key and stands down
 * for the cooldown window, while each surface's own cadence (122-day
 * native cap, per-moment card) is untouched once the window has passed.
 */

const NOW = new Date('2026-08-31T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

// Every store carries a pending moment: since A50 the card is armed by a
// moment, not a session count, and these tests are about the collision
// guard, not the cadence.
function sharedStore(seed: Record<string, string> = {}) {
  return new Map(Object.entries({ [PENDING_MOMENT_KEY]: 'ten', ...seed }));
}

function ratingIo(store: Map<string, string>): RatingAskIo {
  return {
    getItem: async (key) => store.get(key) ?? null,
    setItem: async (key, value) => void store.set(key, value),
    request: () => {},
    cancelled: () => false,
  };
}

function reviewIo(store: Map<string, string>): ReviewPromptIo {
  return {
    read: (key) => store.get(key) ?? null,
    write: (key, value) => void store.set(key, value),
  };
}

test('REPRODUCTION: with no shared key, a fresh wear completion lets A and B both decide "ask" at once', async () => {
  // Two independent stores, exactly as ship today: A never reads B's keys
  // and B never reads A's. Nothing has fired yet for either.
  const aStore = sharedStore();
  const bStore = sharedStore(); // a moment pending, eligible

  const aOutcome = await evaluateRatingAsk(NOW, ratingIo(aStore));
  const bWouldFire = promptEligible(reviewIo(bStore)) && settledIn(DWELL_MS);

  // This is the defect: both say yes, in the same completion window.
  assert.equal(aOutcome, 'requested');
  assert.equal(bWouldFire, true);
});

test('the shared touchpoint key exists and every surface consults it before firing', () => {
  const key = TOUCHPOINT_KEY;
  assert.match(key, /^cinch\./);
  assert.equal(touchedRecently(NOW, null), false);
  assert.equal(touchedRecently(NOW, touchpointStamp(NOW)), true);
  const justOutside = new Date(NOW.getTime() - TOUCHPOINT_COOLDOWN_DAYS * DAY_MS);
  assert.equal(touchedRecently(NOW, touchpointStamp(justOutside)), false);
  const justInside = new Date(NOW.getTime() - (TOUCHPOINT_COOLDOWN_DAYS * DAY_MS - 1));
  assert.equal(touchedRecently(NOW, touchpointStamp(justInside)), true);
});

test('FIX: once A fires it stamps the shared key, and B refuses within the cooldown', async () => {
  const store = sharedStore();

  const aOutcome = await evaluateRatingAsk(NOW, ratingIo(store));
  assert.equal(aOutcome, 'requested');
  assert.ok(store.get(TOUCHPOINT_KEY), 'A must stamp the shared touchpoint when it fires');

  // B, deciding a moment later in the same window, must see the stamp and
  // refuse — even though its own per-session cadence would otherwise say yes.
  const bIo = reviewIo(store);
  assert.equal(promptEligible(bIo), true, 'B is otherwise eligible this session');
  assert.equal(blockedByOtherSurface(NOW, bIo), true, 'B must defer to the touchpoint A just wrote');
});

test('FIX: once B fires it stamps the shared key, and A refuses within the cooldown', async () => {
  const store = sharedStore();
  const bIo = reviewIo(store);
  markTouchpoint(NOW, bIo);

  const aOutcome = await evaluateRatingAsk(NOW, ratingIo(store));
  assert.equal(aOutcome, 'blocked_by_other_surface');
  assert.equal(store.has('cinch.ratingAskedAt'), false, 'A must not mark its own cadence for a surface it never fired');
});

test('after the cooldown window, each surface returns to its own cadence unaffected', async () => {
  const stale = new Date(NOW.getTime() - (TOUCHPOINT_COOLDOWN_DAYS * DAY_MS + 1));

  // A, checked on its own store: a stale touchpoint does not block it.
  const aStore = sharedStore({ [TOUCHPOINT_KEY]: touchpointStamp(stale) });
  const aOutcome = await evaluateRatingAsk(NOW, ratingIo(aStore));
  assert.equal(aOutcome, 'requested');

  // B, checked on its own store (not the one A just rewrote): a stale
  // touchpoint does not block it either.
  const bStore = sharedStore({ [TOUCHPOINT_KEY]: touchpointStamp(stale) });
  const bIo = reviewIo(bStore);
  assert.equal(blockedByOtherSurface(NOW, bIo), false);
});

test('B still never asks twice once done, regardless of the touchpoint', () => {
  const store = sharedStore();
  const bIo = reviewIo(store);
  markTouchpoint(new Date(NOW.getTime() - 5 * DAY_MS), bIo); // long stale, would not block
  bIo.write('cinch.review.done.v1', 'true');
  assert.equal(promptEligible(bIo), false);
});

// ── Source contracts ───────────────────────────────────────────────────────

const read = (p: string) => readFileSync(p, 'utf8');

test('every native requestReview call site is one of the two known surfaces, and both consult the shared touchpoint', () => {
  const files = ['src/features/rating/ask-for-rating.ts', 'src/features/share/capture-plate.ts'];
  const everything = read('src/features/rating/rating-ask-core.ts') + read('src/features/share/capture-plate.ts');

  // Nowhere else in the app calls requestReview directly.
  const grepAll = (pattern: RegExp, files: string[]) =>
    files.reduce((n, f) => n + ((read(f).match(pattern) ?? []).length), 0);

  for (const dir of [
    'src/app/(tabs)/closet.tsx',
    'src/app/(tabs)/stylist.tsx',
    'src/app/(tabs)/plan.tsx',
    'src/app/(tabs)/explore.tsx',
    'src/app/reveal.tsx',
  ]) {
    assert.doesNotMatch(read(dir), /requestReview\(/, `${dir} calls requestReview directly`);
  }

  assert.equal(grepAll(/StoreReview\.requestReview\(/g, files), 2, 'exactly A and C call requestReview');

  const shareSrc = read('src/features/share/capture-plate.ts');
  assert.match(shareSrc, /TOUCHPOINT_KEY|touchedRecently/, 'C must consult the shared touchpoint before requesting');
  assert.match(
    shareSrc,
    /touchpointStamp[\s\S]{0,200}StoreReview\.requestReview\(\)|AsyncStorage\.setItem\([\s\S]{0,40}TOUCHPOINT_KEY[\s\S]{0,200}StoreReview\.requestReview\(\)/,
    'C must write the shared touchpoint before requesting (write-before-request)',
  );

  assert.match(everything, /TOUCHPOINT_KEY/, 'A must reference the shared touchpoint key');
});
