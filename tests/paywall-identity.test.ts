/**
 * The affordable-membership change (2026-09-10) alters price, packaging and
 * the paywall document together, so every impression and every purchase has
 * to say WHICH document it came from and WHICH product it bought — otherwise
 * the first hundred paying users cannot be read apart from the paywall that
 * came before them. These pins hold the gate to that, and hold the one
 * in-app surface that used to print a typed price to printing none.
 *
 * Source pins: `use-gate.ts` is a hook over the Superwall SDK and cannot be
 * imported by the node suite (see tests/reveal-page.test.ts for the rule).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PLANS } from '../src/features/billing/plans';
import { membershipCopyFor } from '../src/features/profile/membership-copy';

const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

const GATE = code('src/features/billing/use-gate.ts');

test('paywall_presented carries the paywall identifier and the product list', () => {
  assert.match(GATE, /onPresent: \(info\) => \{/);
  assert.match(GATE, /target\.paywall = info\.identifier/);
  assert.match(
    GATE,
    /track\('paywall_presented', \{\s*placement: target\.placement,\s*paywall: info\.identifier,\s*products: info\.productIds\.join\(','\),\s*\}\)/,
  );
});

test('paywall_converted carries the paywall and the purchased product id', () => {
  assert.match(GATE, /if \(result\.type === 'purchased'\) target\.productId = result\.productId/);
  assert.match(
    GATE,
    /track\('paywall_converted', \{\s*placement: target\.placement,\s*result: target\.purchase,\s*paywall: target\.paywall \?\? undefined,\s*product_id: target\.productId \?\? undefined,\s*\}\)/,
  );
  // Never a price: the amount is Apple's and the webhook ledger's.
  assert.doesNotMatch(GATE, /price:|amount:|currency:/);
  // Both fields start empty on every presentation.
  assert.match(GATE, /purchase: null,\s*paywall: null,\s*productId: null,/);
});

test('the profile membership copy prints the term, never a price', () => {
  const copy = membershipCopyFor({
    plan: 'standard',
    copy: PLANS.standard,
    paid: true,
    trialing: false,
    trialEndsAt: null,
    currentPeriodEnd: new Date('2026-10-10T12:00:00Z'),
  });
  assert.equal(copy.visible, true);
  assert.equal(copy.title, 'Cinch Standard');
  assert.match(copy.subtitle, /^Through /);
  assert.doesNotMatch(copy.subtitle, /\$|\/ month|renew/i);
  // An unknown period end prints nothing rather than a guessed date or a price.
  assert.equal(
    membershipCopyFor({
      plan: 'pro',
      copy: PLANS.pro,
      paid: true,
      trialing: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
    }).subtitle,
    '',
  );
  // And the hints themselves are the 2026-09-10 monthly prices, bare.
  assert.equal(PLANS.standard.monthlyPriceHint, '$0.99');
  assert.equal(PLANS.pro.monthlyPriceHint, '$2.99');
  assert.doesNotMatch(code('src/features/profile/membership-copy.ts'), /PriceHint/);
});
