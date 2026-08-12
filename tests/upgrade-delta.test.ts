/**
 * MB-09 — the delta, and the six things it may never say.
 *
 * D-5 was never a question about whether an upgrade surface could exist. It was
 * a question about where a price comes from: the atlas draws MB-09's price
 * positions as live StoreKit reads, and this app has no StoreKit module, so the
 * only honest place for a term is the Superwall document that renders one. The
 * app's half is the delta.
 *
 * That makes the scanning tests below the load-bearing ones. A currency symbol,
 * a period, a per-month figure or a trial phrase appearing anywhere in this
 * feature is the exact regression D-5 existed to prevent, and it is the kind
 * that reads perfectly and ships.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PLANS } from '../src/features/billing/plans';
import { Placement } from '../src/features/billing/placements';
import { contextLineFor } from '../src/features/billing/context-lines';
import {
  canUpgrade,
  upgradeDelta,
  UPGRADE_CTA,
  UPGRADE_DECLINE,
  UPGRADE_KEEPS_LINE,
  UPGRADE_PRORATION_LINE,
  UPGRADE_UNAVAILABLE_LINE,
} from '../src/features/billing/upgrade-delta';

test('three rows, each carrying the current figure and the new one', () => {
  const rows = upgradeDelta('standard');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { label: 'Active pieces', from: '150', to: '1,000' });
  assert.deepEqual(rows[1], { label: 'Stored pieces', from: '450', to: '3,000' });
  // Correction 18 resolved packing as Pro-only, so it is a delta row rather
  // than a feature bullet.
  assert.deepEqual(rows[2], { label: 'Packing memos', from: 'Not included', to: 'Included' });
});

test('the figures derive from PLANS rather than being typed', () => {
  const rows = upgradeDelta('standard');
  assert.equal(rows[0]!.to, PLANS.pro.items.toLocaleString('en-US'));
  assert.equal(rows[1]!.from, PLANS.standard.storedItems.toLocaleString('en-US'));
});

test('the table is computed from the tier the read named, not assumed', () => {
  // A hard-coded 150 → 1,000 would be wrong the moment this table were reached
  // from anywhere but Standard.
  assert.equal(upgradeDelta('free')[0]!.from, '10');
});

test('only a member below Pro has an upgrade', () => {
  assert.equal(canUpgrade('standard'), true);
  assert.equal(canUpgrade('pro'), false);
  // Free has a first purchase, not an upgrade — that is the paywall's own job
  // at `reveal_complete` and the limit placements.
  assert.equal(canUpgrade('free'), false);
});

test('the CTA names the act, never a figure', () => {
  assert.equal(UPGRADE_CTA, 'See both terms');
  assert.equal(UPGRADE_DECLINE, 'Stay on Standard');
});

/**
 * The scan. Every string this feature can put on screen, plus the two files
 * that render them, checked for the literals D-5 forbids.
 */
const STRINGS = [
  ...upgradeDelta('standard').flatMap((r) => [r.label, r.from, r.to]),
  UPGRADE_KEEPS_LINE,
  UPGRADE_CTA,
  UPGRADE_DECLINE,
  UPGRADE_PRORATION_LINE,
  UPGRADE_UNAVAILABLE_LINE,
];

test('no price, no period, no per-month arithmetic anywhere in MB-09', () => {
  for (const s of STRINGS) {
    assert.doesNotMatch(s, /[$£€]/, `currency symbol in: ${s}`);
    assert.doesNotMatch(s, /\d+\s*\.\s*\d{2}/, `price-shaped figure in: ${s}`);
    assert.doesNotMatch(s, /\/\s*(mo|month|yr|year)\b|per month|a month|a year/i, `period in: ${s}`);
  }
});

test('no trial is promised, drawn or implied', () => {
  // Correction 06 governs this outright, and it is independently true of the
  // products: all four are `trial_period_days: null`, verified against the
  // Superwall API on 2026-08-12.
  for (const s of STRINGS) {
    assert.doesNotMatch(s, /trial|free for|days free/i, `trial language in: ${s}`);
  }
});

test('no proration figure is derived — the App Store owns it and the copy says so', () => {
  assert.match(UPGRADE_PRORATION_LINE, /App Store handles the balance/);
  assert.doesNotMatch(UPGRADE_PRORATION_LINE, /\d/);
});

test('the shipping route and the fixture contain no price literal either', () => {
  // The strings above are only half the surface: a price typed straight into
  // JSX would pass every assertion so far.
  for (const path of ['src/app/membership-upgrade.tsx', 'src/app/dev-w3-g6-mb-09.tsx']) {
    const src = readFileSync(path, 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(src, /[$£€]\d/, `price literal in ${path}`);
    assert.doesNotMatch(src, /\d+\.\d{2}/, `price-shaped figure in ${path}`);
  }
});

test('the placement is registered and carries no context line', () => {
  // MB-09 has already said everything a line above the headline could. `null`
  // is a decision here, like `repeat_upsell`'s, not an omission — the lookup
  // it would otherwise fall through to returns `undefined ?? null` and would
  // read identically while meaning nothing.
  assert.equal(Placement.MembershipUpgrade, 'membership_upgrade');
  assert.equal(contextLineFor(Placement.MembershipUpgrade), null);
  assert.equal(contextLineFor(Placement.MembershipUpgrade, { plan: 'standard' }), null);
});

test('the campaign that makes this placement resolve is recorded in the source', () => {
  // A placement name is a contract with a dashboard campaign, and an unmatched
  // name resolves SILENTLY to nothing at all — which is precisely why this row
  // was parked for a packet. The campaign id belongs next to the name, so the
  // next person can check it rather than assume it.
  const placements = readFileSync('src/features/billing/placements.ts', 'utf8');
  assert.match(placements, /Membership upgrade" \(101571\)/);
  assert.match(placements, /254200/);
});

test('MB-09 draws its own unavailable outcome, so the CTA is not a dead control', () => {
  // Paywall 254200 is still `published_at: null`, so `present()` resolves
  // `unavailable` today and the fail-safe tears the empty sheet down. Without
  // this branch the member would be left with a button that appears to do
  // nothing.
  assert.match(UPGRADE_UNAVAILABLE_LINE, /nothing was started/);
  assert.match(UPGRADE_UNAVAILABLE_LINE, /Nothing has changed/);
  const screen = readFileSync('src/app/membership-upgrade.tsx', 'utf8');
  assert.match(screen, /outcome === 'unavailable'/);
});
