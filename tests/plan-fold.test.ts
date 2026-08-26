import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { foldPlan, planFromEntitlements } from '../src/features/billing/plan-fold';

/**
 * The two-source plan: the subscriptions row and StoreKit's own answer.
 *
 * The webhook that writes `subscriptions.plan` can lag a purchase — or, when
 * the endpoint is misconfigured, never arrive — and the one wrong answer in
 * that window is showing a paying subscriber a paywall. The fold takes the
 * higher of the two and NEVER the lower; these tests pin both directions.
 */

test('the SDK can only raise the plan, never lower it', () => {
  assert.equal(foldPlan('free', 'pro'), 'pro');
  assert.equal(foldPlan('free', 'standard'), 'standard');
  assert.equal(foldPlan('standard', 'pro'), 'pro');
  // A device with no entitlement is not evidence against the row — family
  // sharing, a second Apple ID and a slow SDK fetch all read as nothing.
  assert.equal(foldPlan('pro', null), 'pro');
  assert.equal(foldPlan('standard', null), 'standard');
  assert.equal(foldPlan('pro', 'standard'), 'pro');
});

test('with no SDK evidence the row stands', () => {
  assert.equal(foldPlan('free', null), 'free');
});

test('entitlement identifiers map to plans, and strangers map to nothing', () => {
  assert.equal(planFromEntitlements(['pro']), 'pro');
  assert.equal(planFromEntitlements(['standard']), 'standard');
  // Pro wins when both are somehow active.
  assert.equal(planFromEntitlements(['standard', 'pro']), 'pro');
  assert.equal(planFromEntitlements([]), null);
  // An entitlement this app never priced unlocks nothing.
  assert.equal(planFromEntitlements(['vip_2027']), null);
});

// ── Source contracts ───────────────────────────────────────────────────────

const read = (p: string) => readFileSync(p, 'utf8');

test('usePlan actually folds the SDK answer in', () => {
  const src = read('src/features/billing/use-plan.ts');
  assert.match(src, /useSdkPlan\(\)/, 'the SDK plan is never read');
  assert.match(src, /foldPlan\(/, 'the SDK plan is read but never folded');
});

test('the SDK hook never runs in a keyless build', () => {
  // `useSuperwall` throws with no provider above it, and the keyless build
  // mounts none — the same module-level branch `useGate` takes.
  const src = read('src/features/billing/use-sdk-plan.ts');
  assert.match(src, /PAYWALLS_ENABLED\s*\?\s*useSuperwallSdkPlan\s*:\s*useDisabledSdkPlan/);
});
