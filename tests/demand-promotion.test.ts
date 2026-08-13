/**
 * The gate between the private demand aggregate and a committed fixture.
 *
 * Workstream 2 allowed the golden regression set to be driven by measured
 * demand rather than by what the founder happened to think of — on condition
 * that an intent crosses a threshold before it becomes public. These are the
 * cases where that gate has to hold, including the one where it would be
 * tempting to let a single interesting search through.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  isPromotable,
  promote,
  MIN_DISTINCT_DAYS,
  MIN_SEARCHES,
  MIN_ZERO_RESULT_SEARCHES,
  type DemandRollup,
} from '../supabase/functions/_shared/demand-promote.ts';

const rollup = (over: Partial<DemandRollup> = {}): DemandRollup => ({
  intentKey: 'a'.repeat(64),
  brandSlug: 'james-perse',
  garmentClass: 't-shirt',
  audience: 'mens',
  colourFamily: null,
  searches: MIN_SEARCHES,
  zeroResultSearches: 0,
  distinctDays: MIN_DISTINCT_DAYS,
  ...over,
});

test('a genuinely popular intent is promotable', () => {
  assert.deepEqual(isPromotable(rollup()), { promotable: true, because: 'demand' });
});

test('one person having an unusual afternoon is not demand', () => {
  // Both floors matter, and they fail for different reasons: plenty of searches
  // on a single day is one session, and a handful spread over a fortnight is
  // noise. Neither is a pattern worth committing.
  assert.deepEqual(isPromotable(rollup({ distinctDays: 1, searches: 400 })), {
    promotable: false,
    because: 'too_few_days',
  });
  assert.deepEqual(isPromotable(rollup({ searches: MIN_SEARCHES - 1 })), {
    promotable: false,
    because: 'too_few_searches',
  });
});

test('a hole in the catalogue clears a lower bar than a working query', () => {
  // The whole point: a search that returns nothing is the most useful fixture
  // in the set, and holding it to the popularity floor keeps the failures out
  // for exactly as long as they stay rare.
  const hole = rollup({ searches: MIN_ZERO_RESULT_SEARCHES, zeroResultSearches: MIN_ZERO_RESULT_SEARCHES, distinctDays: 2 });
  assert.deepEqual(isPromotable(hole), { promotable: true, because: 'zero_result' });
  assert.ok(MIN_ZERO_RESULT_SEARCHES < MIN_SEARCHES);
});

test('but a single failed search is still an anecdote', () => {
  assert.equal(
    isPromotable(rollup({ searches: 1, zeroResultSearches: 1, distinctDays: 1 })).promotable,
    false,
  );
});

test('a row with nothing recognised in it is not an intent', () => {
  // Mirrors the table's own `catalogue_demand_not_empty` constraint. A fixture
  // built from one would assert nothing at all.
  assert.deepEqual(
    isPromotable(rollup({ brandSlug: null, garmentClass: null, searches: 9_000, distinctDays: 90 })),
    { promotable: false, because: 'not_an_intent' },
  );
});

test('the promoted fixture drops the private join key', () => {
  const [first] = promote([rollup()]);
  assert.ok(!('intentKey' in first), 'the hash was carried into a committed file');
  assert.deepEqual(Object.keys(first).sort(), [
    'audience',
    'because',
    'brandSlug',
    'colourFamily',
    'garmentClass',
  ]);
});

test('promotion is stable, so a diff means the data moved', () => {
  const rows = [
    rollup({ brandSlug: 'sunspel' }),
    rollup({ brandSlug: 'james-perse' }),
    rollup({ brandSlug: 'arket' }),
  ];
  const once = promote(rows).map((r) => r.brandSlug);
  const again = promote([...rows].reverse()).map((r) => r.brandSlug);
  assert.deepEqual(once, again);
  assert.deepEqual(once, ['arket', 'james-perse', 'sunspel']);
});

test('the rule does not claim to be k-anonymity', () => {
  // The aggregate holds no user column by design, so nothing here can count
  // distinct people. A comment claiming otherwise would be a privacy guarantee
  // asserted by a file that cannot possibly check it.
  const src = readFileSync('supabase/functions/_shared/demand-promote.ts', 'utf8');
  assert.match(src, /POPULARITY FLOOR, not k-anonymity/);
  assert.ok(
    !/user_id|distinctUsers|uniqueUsers/.test(src),
    'the promotion rule reaches for a user identity the aggregate must not hold',
  );
});
