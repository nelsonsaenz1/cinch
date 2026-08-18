/**
 * The Reveal's analytics — three additions, and the things none of them carry.
 *
 * Every builder in `features/onboarding/reveal-analytics.ts` is a pure function
 * with no PostHog import, precisely so this suite can EXECUTE each of them
 * across every legal input and read what actually comes out — rather than
 * grepping the call sites and hoping the payload matches the paragraph above it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  COUNT_BUCKETS,
  REVEAL_EVENTS,
  REVEAL_EXITS,
  REVEAL_PHASES,
  countBucket,
  countBucketProps,
  revealExitProps,
  revealPhaseProps,
  revealSetViewedProps,
  type RevealProps,
} from '../src/features/onboarding/reveal-analytics';

const ROUTE = readFileSync('src/app/reveal.tsx', 'utf8');
const POSTHOG = readFileSync('src/lib/posthog.tsx', 'utf8');

/** Every payload this screen can produce, from every legal input. */
const EVERY_PAYLOAD: [string, RevealProps][] = [
  ...REVEAL_PHASES.map((p) => [REVEAL_EVENTS.phase, revealPhaseProps(p)] as [string, RevealProps]),
  ...REVEAL_EXITS.map((e) => [REVEAL_EVENTS.exit, revealExitProps(e)] as [string, RevealProps]),
  ...[0, 1, 2, 9, 10, 49, 50, 184, 100000].map(
    (n) => [REVEAL_EVENTS.countBucket, countBucketProps(n)] as [string, RevealProps],
  ),
  ...[0, 1, 2, 3].flatMap((n) =>
    [true, false].map(
      (o) => ['outfit_set_viewed', revealSetViewedProps(n, o)] as [string, RevealProps],
    ),
  ),
];

// ---------------------------------------------------------------------------
// The allowlist
// ---------------------------------------------------------------------------

test('three additions, no more', () => {
  assert.equal(Object.keys(REVEAL_EVENTS).length, 3);
  assert.deepEqual(new Set(Object.values(REVEAL_EVENTS)), new Set([
    'reveal_phase',
    'reveal_exit',
    'outfit_count_bucket',
  ]));
});

test('all three are members of the app’s closed event union', () => {
  for (const name of Object.values(REVEAL_EVENTS)) {
    assert.ok(POSTHOG.includes(`'${name}'`), `${name} cannot be tracked`);
  }
});

test('the route sends only the four events this screen is allowed', () => {
  const sent = [...ROUTE.matchAll(/track\(\s*(?:REVEAL_EVENTS\.(\w+)|'([^']+)')/g)].map(
    (m) => m[1] ?? m[2],
  );
  const allowed = new Set(['phase', 'exit', 'countBucket', 'outfit_set_viewed']);
  for (const s of sent) assert.ok(allowed.has(s!), `the route sends ${s}`);
  assert.ok(sent.length >= 4, `expected four call sites, found ${sent.length}`);
});

// ---------------------------------------------------------------------------
// The count never travels
// ---------------------------------------------------------------------------

test('the raw outfit count is never sent as an unbucketed field', () => {
  // The exact count is a deterministic function of one wardrobe with a long
  // tail: 184 is close to unique, and joined to a timestamp it is a fingerprint.
  for (const n of [0, 1, 7, 27, 184, 4096]) {
    const props = countBucketProps(n);
    assert.deepEqual(Object.keys(props), ['bucket']);
    assert.ok((COUNT_BUCKETS as readonly string[]).includes(props.bucket as string));
    if (n > 1) assert.notEqual(props.bucket, String(n), `sent ${n} as itself`);
  }
});

test('the buckets partition every count, with no gap and no overlap', () => {
  const seen = new Map<number, string>();
  for (let n = 0; n <= 200; n += 1) seen.set(n, countBucket(n));
  assert.equal(seen.get(0), '0');
  assert.equal(seen.get(1), '1');
  for (let n = 2; n <= 9; n += 1) assert.equal(seen.get(n), '2-9', String(n));
  for (let n = 10; n <= 49; n += 1) assert.equal(seen.get(n), '10-49', String(n));
  for (let n = 50; n <= 200; n += 1) assert.equal(seen.get(n), '50+', String(n));
});

test('a nonsense count cannot fall through as undefined', () => {
  for (const n of [-1, -100, Number.NaN, Number.POSITIVE_INFINITY, 2.7]) {
    const b = countBucket(n);
    assert.ok((COUNT_BUCKETS as readonly string[]).includes(b), `${n} → ${b}`);
  }
  assert.equal(countBucket(Number.NaN), '0');
  assert.equal(countBucket(-5), '0');
  assert.equal(countBucket(2.7), '2-9');
});

// ---------------------------------------------------------------------------
// What may never be sent — asserted against real payloads, not against prose
// ---------------------------------------------------------------------------

test('no payload carries an unbounded string', () => {
  const ENUMS = new Set<string>([
    ...REVEAL_PHASES,
    ...REVEAL_EXITS,
    ...COUNT_BUCKETS,
    'reveal',
  ]);
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== 'string') continue;
      assert.ok(ENUMS.has(value), `${name}.${key} sent an unbounded string: ${value}`);
    }
  }
});

test('no payload carries anything that could be an identifier', () => {
  const FORBIDDEN =
    /(^|_)(id|uid|user|person|profile|garment|item|outfit|look|image|photo|url|path|name|title|city|lat|lon|coord|location|calendar|note|text|query|transcript)(_|$)/i;
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const key of Object.keys(props)) {
      assert.doesNotMatch(key, FORBIDDEN, `${name} carries a forbidden property: ${key}`);
    }
  }
});

test('no payload carries a uuid, a path or a url', () => {
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const value of Object.values(props)) {
      if (typeof value !== 'string') continue;
      assert.doesNotMatch(value, UUID, `${name} sent a uuid`);
      assert.doesNotMatch(value, /[/.]/, `${name} sent something path-shaped: ${value}`);
      assert.doesNotMatch(value, /https?:/i, `${name} sent a url`);
    }
  }
});

test('the impression event counts PLATES, never outfits', () => {
  // `count: 1` is the number of plates on screen, bounded by MAX_PLATES — the
  // same field every other surface sends. It is emphatically not the reveal's
  // headline number, which travels only as a bucket.
  assert.deepEqual(revealSetViewedProps(1, false), {
    surface: 'reveal',
    count: 1,
    offline: false,
  });
  for (const n of [0, 1, 2, 3]) assert.ok(Number(revealSetViewedProps(n, true).count) <= 3);
  assert.equal(Number(revealSetViewedProps(-2, false).count), 0);
});

test('a phase carries the beat and nothing about how long it took', () => {
  for (const p of REVEAL_PHASES) {
    assert.deepEqual(revealPhaseProps(p), { phase: p });
  }
});

test('dismissed and unavailable stay apart', () => {
  // A refusal and a campaign outage are different facts, even though both land
  // on the same Today with the same free tier intact.
  assert.notEqual(revealExitProps('dismissed').exit, revealExitProps('unavailable').exit);
  assert.equal(REVEAL_EXITS.length, 6);
});

test('every exit is reported, including the two off the zero screen', () => {
  assert.ok(REVEAL_EXITS.includes('zero_repair'));
  assert.ok(REVEAL_EXITS.includes('zero_open_today'));
});

// ---------------------------------------------------------------------------
// The module boundary that makes this suite possible
// ---------------------------------------------------------------------------

test('the builders take on no dependency, so they can be executed', () => {
  const src = readFileSync('src/features/onboarding/reveal-analytics.ts', 'utf8');
  assert.doesNotMatch(src, /^import /m, 'the builders took on a dependency');
});
