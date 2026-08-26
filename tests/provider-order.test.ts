import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * The 2026-08-26 boot-crash regression.
 *
 * `usePlan` folds in `useSdkPlan`, whose enabled branch calls `useSuperwall` —
 * which throws with no `SuperwallProvider` above it. The keyless dev checkout
 * takes the disabled branch, so a `usePlan` caller mounted above `<Superwall>`
 * passes every local run and then crashes every production launch: the OTA
 * that shipped `<AnalyticsProperties />` two lines above the provider took the
 * whole app down until a rollback-to-embedded was published. Source order in
 * the root layout is the whole bug, so source order is what this pins.
 */

const layout = readFileSync('src/app/_layout.tsx', 'utf8');

test('every usePlan caller in the root layout mounts inside <Superwall>', () => {
  const provider = layout.indexOf('<Superwall>');
  const close = layout.indexOf('</Superwall>');
  assert.ok(provider > -1 && close > provider, 'the Superwall provider is missing from the root layout');

  const analytics = layout.indexOf('<AnalyticsProperties');
  assert.ok(analytics > -1, 'AnalyticsProperties left the root layout — move this pin to wherever it went');
  assert.ok(
    provider < analytics && analytics < close,
    'AnalyticsProperties reads usePlan and MUST render inside <Superwall> — ' +
      'outside it, the production (keyed) bundle throws on the first render and ' +
      'the app crashes on every launch. Dev cannot catch this: the keyless ' +
      'checkout runs the disabled SDK branch.',
  );
});
