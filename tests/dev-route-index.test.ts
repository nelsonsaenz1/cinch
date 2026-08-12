/**
 * The fixture index cannot go stale.
 *
 * `src/app/dev-screens.tsx` lists every `__DEV__` route in the app, because
 * expo-router gives no runtime enumeration to build the list from and 154
 * hand-typed lines rot the moment somebody adds a frame and forgets. A stale
 * index is worse than none: it looks complete, so the missing route reads as a
 * route that does not exist rather than one nobody linked.
 *
 * So the filesystem is the source of truth and this test is the enforcement.
 * Add a `dev-*.tsx` route, add its line — that is the whole contract.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const routes = readdirSync('src/app')
  .filter((f) => f.startsWith('dev-') && f.endsWith('.tsx'))
  .map((f) => f.slice(0, -'.tsx'.length))
  // The index does not link to itself.
  .filter((f) => f !== 'dev-screens');

const index = readFileSync('src/app/dev-screens.tsx', 'utf8');

test('every dev route is named in the fixture index', () => {
  const missing = routes.filter((r) => !index.includes(`'/${r}'`));
  assert.deepEqual(missing, [], `add these to dev-screens.tsx:\n${missing.join('\n')}`);
});

test('the fixture index names no route that no longer exists', () => {
  // The other direction: a deleted fixture leaves a row that pushes onto a
  // path expo-router cannot resolve, which is a dead control in a screen whose
  // entire job is navigation.
  const listed = [...index.matchAll(/'\/(dev-[a-z0-9-]+)'/g)].map((m) => m[1]!);
  const stale = [...new Set(listed)].filter((r) => !routes.includes(r));
  assert.deepEqual(stale, [], `delete these from dev-screens.tsx:\n${stale.join('\n')}`);
});

test('Wave 3 group 6 contributes all thirteen of its drawn states', () => {
  // MB-09 was the thirteenth, parked on D-5 for a packet because an upgrade
  // CTA could only lead to an unmatched Superwall placement. Campaign 101571
  // now routes `membership_upgrade` to Membership v3, so it is built — with
  // the terms on the paywall rather than in the layout, because a price in a
  // layout is the one thing D-5 was ever about.
  const g6 = routes.filter((r) => r.startsWith('dev-w3-g6-'));
  assert.equal(g6.length, 13, `group 6 fixtures: ${g6.sort().join(', ')}`);
});

test('Wave 3 group 5 contributes its twenty-one drawn states', () => {
  // Group 5 draws 19 base states plus GF-02 / AX and SL-01 / AX. Two of them
  // (PK-01 aside, which belongs to group 4) are dependency-parked rather than
  // undrawn, so the fixture count is the full 21 — a parked state still has a
  // frame; what it lacks is the server rule its copy would assert.
  const g5 = routes.filter((r) => r.startsWith('dev-w3-g5-'));
  assert.equal(g5.length, 21, `group 5 fixtures: ${g5.sort().join(', ')}`);
});
