/**
 * Item detail — the eight events, and the things none of them carry.
 * Redesign 15.
 *
 * Every builder in `features/item/item-analytics.ts` is a pure function with
 * no PostHog import, so this suite EXECUTES each of them across every legal
 * input and reads what actually comes out.
 *
 * Three forbidden things get their own tests. THE PRICE VALUE is what somebody
 * paid for a coat, which is income data by another name. A WEAR COUNT is a
 * behavioural fingerprint. And a SIGNED URL is a bearer credential — anyone
 * holding one holds the image — which is why it may not reach a log, a
 * payload, an accessibility string or the screen as text.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FAILURE_CAUSES,
  ITEM_EVENTS,
  MAINTENANCE_ACTIONS,
  actionFailedProps,
  deletedProps,
  itemViewedProps,
  lendingSetProps,
  listingPhotoRemovedProps,
  maintenanceProps,
  priceAddedProps,
  storedProps,
  type ItemProps,
} from '../src/features/item/item-analytics';

const ROUTE_RAW = readFileSync('src/app/item/[id].tsx', 'utf8');
const POSTHOG = readFileSync('src/lib/posthog.tsx', 'utf8');
const HERO = readFileSync('src/components/item/item-hero.tsx', 'utf8');
const RAIL = readFileSync('src/components/item/wears-well-with.tsx', 'utf8');
const stripped = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const ROUTE = stripped(ROUTE_RAW);

/** Every payload this screen can produce, from every legal input. */
const EVERY_PAYLOAD: [string, ItemProps][] = [
  [ITEM_EVENTS.viewed, itemViewedProps()],
  ...[true, false].map((b) => [ITEM_EVENTS.priceAdded, priceAddedProps(b)] as [string, ItemProps]),
  ...[true, false].map((b) => [ITEM_EVENTS.lendingSet, lendingSetProps(b)] as [string, ItemProps]),
  ...MAINTENANCE_ACTIONS.map(
    (a) => [ITEM_EVENTS.maintenance, maintenanceProps(a)] as [string, ItemProps],
  ),
  ...[true, false].map(
    (b) => [ITEM_EVENTS.listingPhotoRemoved, listingPhotoRemovedProps(b)] as [string, ItemProps],
  ),
  ...[true, false].map((b) => [ITEM_EVENTS.stored, storedProps(b)] as [string, ItemProps]),
  ...[true, false].map((b) => [ITEM_EVENTS.deleted, deletedProps(b)] as [string, ItemProps]),
  ...FAILURE_CAUSES.map(
    (c) => [ITEM_EVENTS.actionFailed, actionFailedProps(c)] as [string, ItemProps],
  ),
];

// ---------------------------------------------------------------------------
// The allowlist
// ---------------------------------------------------------------------------

test('eight events, no more', () => {
  assert.equal(Object.keys(ITEM_EVENTS).length, 8);
  assert.deepEqual(new Set(Object.values(ITEM_EVENTS)), new Set([
    'item_detail_viewed',
    'price_added',
    'lending_set',
    'maintenance_action',
    'listing_photo_removed',
    'item_stored',
    'item_deleted',
    'action_failed',
  ]));
});

test('all eight are members of the app’s closed event union', () => {
  for (const name of Object.values(ITEM_EVENTS)) {
    assert.ok(POSTHOG.includes(`'${name}'`), `${name} cannot be tracked`);
  }
});

test('the route sends only the eight events this screen is allowed', () => {
  const sent = [...ROUTE.matchAll(/track\(\s*ITEM_EVENTS\.(\w+)/g)].map((m) => m[1]);
  const allowed = new Set(Object.keys(ITEM_EVENTS));
  for (const s of sent) assert.ok(allowed.has(s!), `the route sends ${s}`);
  assert.ok(sent.length >= 8, `expected the call sites, found ${sent.length}`);
  // And nothing bare — a string literal event would bypass the builders.
  const bare = [...ROUTE.matchAll(/track\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(bare, [], `a bare event name is tracked: ${bare.join(', ')}`);
});

// ---------------------------------------------------------------------------
// Nothing about the piece
// ---------------------------------------------------------------------------

test('no payload carries a number at all', () => {
  // The strongest available form of "no price value and no wear count":
  // nothing numeric leaves this screen, so neither can arrive by any route.
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const [key, value] of Object.entries(props)) {
      assert.notEqual(typeof value, 'number', `${name}.${key} sent a number: ${String(value)}`);
    }
  }
});

test('no payload carries an unbounded string', () => {
  const ENUMS = new Set<string>([...MAINTENANCE_ACTIONS, ...FAILURE_CAUSES]);
  for (const [name, props] of EVERY_PAYLOAD) {
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== 'string') continue;
      assert.ok(ENUMS.has(value), `${name}.${key} sent an unbounded string: ${value}`);
    }
  }
});

test('no payload key could be an identifier, a name or a path', () => {
  const FORBIDDEN =
    /(^|_)(id|uid|user|item|piece|garment|name|title|brand|price|cost|value|tag|colou?r|image|photo|url|path|wear|count|text|note|friend|borrower)(_|$)/i;
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

test('the visit says nothing about the piece — not even that it has a price', () => {
  assert.deepEqual(itemViewedProps(), {});
});

test('THE PRICE VALUE NEVER TRAVELS', () => {
  // Income data by another name.
  for (const b of [true, false]) assert.deepEqual(priceAddedProps(b), { added: b });
  const calls = ROUTE.match(/priceAddedProps\([^)]*\)/g) ?? [];
  for (const c of calls) {
    assert.doesNotMatch(c, /purchasePrice|parsePrice|\bprice\b(?!\s*!==)/, c);
    assert.match(c, /price !== null/, `the figure reached the payload: ${c}`);
  }
});

test('THE WEAR COUNT NEVER TRAVELS', () => {
  const calls = ROUTE.match(/track\([\s\S]{0,140}?\)/g) ?? [];
  for (const c of calls) {
    assert.doesNotMatch(c, /wearCount|item\.wear|wears\b/, c);
  }
});

test('lending reports a boolean and never a person', () => {
  for (const b of [true, false]) assert.deepEqual(lendingSetProps(b), { on: b });
  const calls = ROUTE.match(/lendingSetProps\([^)]*\)/g) ?? [];
  for (const c of calls) {
    assert.doesNotMatch(c, /friend|user|borrower|profile|\.id\b/, c);
  }
});

test('a failure reports a bounded CAUSE and never the server’s message', () => {
  for (const c of FAILURE_CAUSES) assert.deepEqual(actionFailedProps(c), { cause: c });
  const calls = ROUTE.match(/actionFailedProps\([^)]*\)/g) ?? [];
  assert.ok(calls.length > 0, 'nothing reports a failure');
  for (const c of calls) {
    assert.doesNotMatch(c, /err\.message|error\.message|String\(/, c);
  }
});

// ---------------------------------------------------------------------------
// Signed URLs are bearer credentials
// ---------------------------------------------------------------------------

test('no signed URL or storage path reaches an analytics payload', () => {
  const calls = ROUTE.match(/track\([\s\S]{0,140}?\)/g) ?? [];
  for (const c of calls) {
    assert.doesNotMatch(c, /resolve\(|imageUri|listingPath|cutoutPath|thumbPath|imagePath|signed/i, c);
  }
});

test('no signed URL is rendered as text or spoken', () => {
  // An accessibility label carrying a URL reads it aloud; a Text node prints
  // it. Either way the credential leaves the renderer.
  for (const [name, src] of [
    ['route', ROUTE],
    ['hero', stripped(HERO)],
    ['rail', stripped(RAIL)],
  ] as const) {
    assert.doesNotMatch(
      src,
      /accessibilityLabel=\{[^}]*(?:imageUri|resolve\(|signed|Path)[^}]*\}/i,
      `${name} speaks an image path`,
    );
    assert.doesNotMatch(src, /<Text[^>]*>\s*\{\s*imageUri/i, `${name} prints an image path`);
  }
});

test('no signed URL is logged', () => {
  for (const [name, src] of [
    ['route', ROUTE],
    ['hero', stripped(HERO)],
    ['rail', stripped(RAIL)],
  ] as const) {
    const logs = src.match(/console\.\w+\([^)]*\)/g) ?? [];
    for (const l of logs) {
      assert.doesNotMatch(l, /imageUri|resolve\(|Path|signed/i, `${name} logs an image path: ${l}`);
    }
  }
});

// ---------------------------------------------------------------------------
// The module boundary
// ---------------------------------------------------------------------------

test('the builders take on no dependency, so they can be executed', () => {
  const src = readFileSync('src/features/item/item-analytics.ts', 'utf8');
  assert.doesNotMatch(src, /^import /m, 'the builders took on a dependency');
});
