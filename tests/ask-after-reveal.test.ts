/**
 * A68 (2026-09-10) — the first ask follows the first outfit.
 *
 * Until this change The Ten's finish presented the `ten_completed` promo
 * BEFORE routing to the Reveal, and promo-caps' pair rule then refused
 * `reveal_complete` for a day — so every real person's first paywall arrived
 * 4–60 seconds before her first outfit (4 of 4 lifetime, 0 bought; the
 * 2026-09-09 nightly, §8.2). These pins hold the new order: The Ten routes
 * straight to the Reveal with no ask on the line, the Reveal's exit still
 * carries `reveal_complete` through `presentPromo`, and the retired placement
 * keeps its name so the ledger's historical rows keep counting.
 *
 * Source pins, because the screens are React Native modules the node suite
 * cannot import (see the header of tests/reveal-page.test.ts).
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

/** Block and whole-line comments out, so prose naming the old beat is not read as code. */
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

const TEN = code(read('src/app/the-ten.tsx'));
const REVEAL = code(read('src/app/reveal.tsx'));

test('The Ten routes to the Reveal with no ask on the line', () => {
  assert.doesNotMatch(TEN, /presentPromo\(/, 'The Ten must not present a promo');
  assert.doesNotMatch(TEN, /Placement\.TenCompleted/, 'The Ten must not name the retired beat');
  assert.doesNotMatch(TEN, /use-plan'/, 'The Ten no longer needs the plan for a qualification');
  // The one route, synchronous, and nothing between the tap and the Reveal.
  const start = TEN.indexOf('const finishToReveal = () => {');
  assert.ok(start > 0, 'finishToReveal is a plain function');
  const body = TEN.slice(start, TEN.indexOf('};', start));
  assert.match(body, /router\.replace\('\/reveal'\)/);
  assert.doesNotMatch(body, /await|try|finally|gate\./);
  // Both exits still bind the same handler.
  assert.match(TEN, /onFinish=\{finishToReveal\}/);
  assert.match(TEN, /onSeeOutfits=\{finishToReveal\}/);
});

test('the Reveal exit still carries the first ask, through presentPromo', () => {
  assert.match(REVEAL, /presentPromo\(gate, Placement\.RevealComplete/);
  assert.match(REVEAL, /maySellOnExit\(\{ paying, offline, thin \}\)/);
});

test('no screen or hook in src presents ten_completed any more', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = `${dir}/${name}`;
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name) && /Placement\.TenCompleted/.test(code(readFileSync(path, 'utf8'))))
        offenders.push(path);
    }
  };
  walk('src');
  // The two files that may still NAME it: the caps' set and pair rule
  // (historical rows) and the origin map (analytics on old rows). The
  // definition itself spells it `TenCompleted: 'ten_completed'` and is pinned
  // below.
  assert.deepEqual(offenders.sort(), [
    'src/features/billing/paywall-origin.ts',
    'src/features/billing/promo-caps.ts',
  ]);
});

test('the placement and the pair rule survive for the ledger', () => {
  const placements = read('src/features/billing/placements.ts');
  const caps = code(read('src/features/billing/promo-caps.ts'));
  assert.match(placements, /TenCompleted: 'ten_completed'/);
  assert.match(caps, /Placement\.TenCompleted,\n\s*Placement\.RevealComplete,/);
  assert.match(caps, /reason: 'consecutive_ten_reveal'/);
});
