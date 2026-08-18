/**
 * The closet's analytics — six events, and the things none of them carry.
 *
 * Every builder in `features/closet/closet-analytics.ts` is a pure function
 * with no PostHog import, precisely so this suite can EXECUTE each of them
 * across every legal input and read what actually comes out.
 *
 * Two forbidden things deserve their own tests. SEARCH TEXT: somebody typing a
 * brand or "interview" into their own closet is telling this app about their
 * life. And A COUNT OF OWNED PIECES: a wardrobe size is a wealth proxy and a
 * near-unique number, which is why a selection reports its bucket.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BULK_ACTIONS,
  BULK_RESULTS,
  CAPACITY_VALUES,
  CLOSET_EVENTS,
  FILTER_VALUES,
  RAILS_VALUES,
  SELECTION_VALUES,
  closetBulkProps,
  closetCapacityProps,
  closetFilterProps,
  closetPlansDoorProps,
  closetSelectionProps,
  closetViewedProps,
  type ClosetProps,
} from '../src/features/closet/closet-analytics';

const ROUTE_RAW = readFileSync('src/app/(tabs)/closet.tsx', 'utf8');
const POSTHOG = readFileSync('src/lib/posthog.tsx', 'utf8');
const stripped = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const ROUTE = stripped(ROUTE_RAW);

/** Every payload this screen can produce, from every legal input. */
const EVERY_PAYLOAD: [string, ClosetProps][] = [
  ...RAILS_VALUES.map((r) => [CLOSET_EVENTS.viewed, closetViewedProps(r)] as [string, ClosetProps]),
  ...FILTER_VALUES.map((f) => [CLOSET_EVENTS.filter, closetFilterProps(f)] as [string, ClosetProps]),
  ...SELECTION_VALUES.map(
    (s) => [CLOSET_EVENTS.selection, closetSelectionProps(s)] as [string, ClosetProps],
  ),
  ...BULK_ACTIONS.flatMap((a) =>
    BULK_RESULTS.map((r) => [CLOSET_EVENTS.bulk, closetBulkProps(a, r)] as [string, ClosetProps]),
  ),
  ...CAPACITY_VALUES.map(
    (c) => [CLOSET_EVENTS.capacityState, closetCapacityProps(c)] as [string, ClosetProps],
  ),
  [CLOSET_EVENTS.plansDoor, closetPlansDoorProps()],
];

// ---------------------------------------------------------------------------
// The allowlist
// ---------------------------------------------------------------------------

test('six events, no more', () => {
  assert.equal(Object.keys(CLOSET_EVENTS).length, 6);
  assert.deepEqual(new Set(Object.values(CLOSET_EVENTS)), new Set([
    'closet_viewed',
    'closet_filter',
    'closet_selection',
    'closet_bulk',
    'closet_capacity_state',
    'closet_plans_door_opened',
  ]));
});

test('all six are members of the app’s closed event union', () => {
  for (const name of Object.values(CLOSET_EVENTS)) {
    assert.ok(POSTHOG.includes(`'${name}'`), `${name} cannot be tracked`);
  }
});

test('the route sends only the six events this screen is allowed', () => {
  const sent = [...ROUTE.matchAll(/track\(\s*CLOSET_EVENTS\.(\w+)/g)].map((m) => m[1]);
  const allowed = new Set(Object.keys(CLOSET_EVENTS));
  for (const s of sent) assert.ok(allowed.has(s!), `the route sends ${s}`);
  assert.ok(sent.length >= 5, `expected the call sites, found ${sent.length}`);
  // And nothing else on this screen tracks anything at all.
  const anyTrack = [...ROUTE.matchAll(/track\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(anyTrack, [], `a bare event name is tracked: ${anyTrack.join(', ')}`);
});

// ---------------------------------------------------------------------------
// Nothing about the contents
// ---------------------------------------------------------------------------

test('no payload carries an unbounded string', () => {
  const ENUMS = new Set<string>([
    ...RAILS_VALUES,
    ...FILTER_VALUES,
    ...SELECTION_VALUES,
    ...BULK_ACTIONS,
    ...BULK_RESULTS,
    ...CAPACITY_VALUES,
  ]);
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== 'string') continue;
      assert.ok(ENUMS.has(value), `${name}.${key} sent an unbounded string: ${value}`);
    }
  }
});

test('no payload carries a number at all', () => {
  // The strongest form of "no counts of owned pieces": nothing numeric leaves
  // this screen, so a wardrobe size cannot arrive by any route.
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const [key, value] of Object.entries(props)) {
      assert.notEqual(typeof value, 'number', `${name}.${key} sent a number: ${String(value)}`);
    }
  }
});

test('no payload carries anything that could be an identifier or content', () => {
  const FORBIDDEN =
    /(^|_)(id|uid|user|person|item|garment|piece|name|title|category|query|search|text|image|photo|url|path|price|plan|count|total|city|note)(_|$)/i;
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

test('THE SEARCH QUERY NEVER LEAVES THE DEVICE', () => {
  // The sharpest one on this screen. `closet_filter` reports WHICH KINDS of
  // filter are active and nothing about either of them.
  for (const f of FILTER_VALUES) {
    assert.deepEqual(closetFilterProps(f), { kind: f });
    assert.equal(Object.keys(closetFilterProps(f)).length, 1);
  }
  // And no call site in the route hands the query to anything that tracks.
  const calls = ROUTE.match(/track\([\s\S]{0,180}?\)/g) ?? [];
  for (const c of calls) {
    assert.doesNotMatch(c, /screen\.query|screen\.category|query|category/, c);
  }
});

test('a selection reports its bucket and never its size', () => {
  for (const s of SELECTION_VALUES) {
    assert.deepEqual(closetSelectionProps(s), { size: s });
  }
  const calls = ROUTE.match(/closetSelectionProps\([^)]*\)/g) ?? [];
  for (const c of calls) {
    assert.doesNotMatch(c, /\.size\b|length/, `the raw count reached the payload: ${c}`);
  }
});

test('capacity reports which wall and never the ceiling or the usage', () => {
  for (const c of CAPACITY_VALUES) {
    assert.deepEqual(closetCapacityProps(c), { state: c });
  }
  const calls = ROUTE.match(/closetCapacityProps\([^)]*\)/g) ?? [];
  for (const c of calls) {
    assert.doesNotMatch(c, /used|limit|stored/, `a ceiling reached the payload: ${c}`);
  }
});

test('the plans door carries nothing — no plan, no price, no ceiling', () => {
  assert.deepEqual(closetPlansDoorProps(), {});
});

test('a bulk write reports what and whether, never to what', () => {
  for (const a of BULK_ACTIONS) {
    for (const r of BULK_RESULTS) {
      assert.deepEqual(closetBulkProps(a, r), { action: a, result: r });
    }
  }
  // All four actions are reportable, so a silent one cannot be introduced.
  assert.deepEqual([...BULK_ACTIONS], ['recategorise', 'store', 'restore', 'delete']);
});

test('the rails event says which rails, never what is in them', () => {
  for (const r of RAILS_VALUES) {
    assert.deepEqual(closetViewedProps(r), { rails: r });
  }
});

// ---------------------------------------------------------------------------
// The module boundary that makes this suite possible
// ---------------------------------------------------------------------------

test('the builders take on no dependency, so they can be executed', () => {
  const src = readFileSync('src/features/closet/closet-analytics.ts', 'utf8');
  assert.doesNotMatch(src, /^import /m, 'the builders took on a dependency');
});

test('the hook reports bulk outcomes outward rather than tracking directly', () => {
  // `use-closet-screen.ts` is executed by the node suite; `@/lib/posthog`
  // cannot be. Handing the report outward keeps the hook runnable and keeps
  // the payload assertable where it is built.
  const hook = readFileSync('src/features/closet/use-closet-screen.ts', 'utf8');
  assert.doesNotMatch(hook, /from '@\/lib\/posthog'/);
  assert.match(hook, /onBulk\?\.\('delete', 'ok'\)/);
  assert.match(hook, /onBulk\?\.\('delete', 'failed'\)/);
});
