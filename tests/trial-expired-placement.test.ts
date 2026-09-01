/**
 * The trial-expired placement contract — ONCE PER LAPSE, NOT ONCE PER LAUNCH.
 *
 * `evaluateTrialExpired` is the whole decision flow of
 * `useTrialExpiredPlacement` with its IO injected (trial-expired-core.ts);
 * these tests execute every branch against an in-memory storage and count the
 * presents. The wiring the pure core cannot prove — that the hook actually
 * delegates to it, that the tab layout actually mounts the hook, and that
 * `paywall_presented` only ever fires from a real `onPresent` — is pinned by
 * the source-contract assertions at the bottom, the same way
 * catalogue-client.test.ts reads its emitting module.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  evaluateTrialExpired,
  FIRED_KEY,
  type TrialExpiredState,
} from '../src/features/billing/trial-expired-core';

const EXPIRED = '2026-08-10T00:00:00.000Z';

/** An expired free account with a trial marker — the one state that fires. */
const lapsed = (over: Partial<TrialExpiredState> = {}): TrialExpiredState => ({
  loading: false,
  trialing: false,
  plan: 'free',
  marker: EXPIRED,
  ...over,
});

/** In-memory AsyncStorage plus a present counter and a cancellation switch. */
function harness() {
  const store = new Map<string, string>();
  let presented = 0;
  let cancelled = false;
  return {
    io: {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => void store.set(key, value),
      present: () => {
        presented += 1;
      },
      cancelled: () => cancelled,
    },
    store,
    presents: () => presented,
    cancel: () => {
      cancelled = true;
    },
  };
}

test('an expired free account with a trial marker presents, and writes the marker first', async () => {
  const h = harness();
  const outcome = await evaluateTrialExpired(lapsed(), h.io);
  assert.equal(outcome, 'presented');
  assert.equal(h.presents(), 1);
  assert.equal(h.store.get(FIRED_KEY), EXPIRED);
});

test('an active trial does not present', async () => {
  const h = harness();
  // While trialing, usePlan folds the plan to 'pro' as well — assert both the
  // realistic pair and the flag alone, so neither guard is load-bearing by
  // accident.
  assert.equal(await evaluateTrialExpired(lapsed({ trialing: true, plan: 'pro' }), h.io), 'not_lapsed');
  assert.equal(await evaluateTrialExpired(lapsed({ trialing: true }), h.io), 'not_lapsed');
  assert.equal(h.presents(), 0);
  assert.equal(h.store.size, 0);
});

test('a paid plan does not present', async () => {
  const h = harness();
  assert.equal(await evaluateTrialExpired(lapsed({ plan: 'pro' }), h.io), 'not_lapsed');
  assert.equal(await evaluateTrialExpired(lapsed({ plan: 'standard' }), h.io), 'not_lapsed');
  assert.equal(h.presents(), 0);
  assert.equal(h.store.size, 0);
});

test('an account with no trial_ends_at never lapsed and does not present', async () => {
  const h = harness();
  assert.equal(await evaluateTrialExpired(lapsed({ marker: null }), h.io), 'not_lapsed');
  assert.equal(h.presents(), 0);
  assert.equal(h.store.size, 0);
});

test('loading does not present', async () => {
  const h = harness();
  assert.equal(await evaluateTrialExpired(lapsed({ loading: true }), h.io), 'not_lapsed');
  assert.equal(h.presents(), 0);
  assert.equal(h.store.size, 0);
});

test('the same trial_ends_at fires only once — once per lapse, not once per launch', async () => {
  const h = harness();
  assert.equal(await evaluateTrialExpired(lapsed(), h.io), 'presented');
  // The next cold start, and the one after: same marker, no second interruption.
  assert.equal(await evaluateTrialExpired(lapsed(), h.io), 'already_fired');
  assert.equal(await evaluateTrialExpired(lapsed(), h.io), 'already_fired');
  assert.equal(h.presents(), 1);
});

test('a new trial_ends_at (a re-trial) fires exactly once again', async () => {
  const h = harness();
  const RETRIAL = '2026-11-01T00:00:00.000Z';
  assert.equal(await evaluateTrialExpired(lapsed(), h.io), 'presented');
  assert.equal(await evaluateTrialExpired(lapsed({ marker: RETRIAL }), h.io), 'presented');
  assert.equal(await evaluateTrialExpired(lapsed({ marker: RETRIAL }), h.io), 'already_fired');
  assert.equal(h.presents(), 2);
  assert.equal(h.store.get(FIRED_KEY), RETRIAL);
});

test('unmount between write and present loses the interruption, never repeats it', async () => {
  const h = harness();
  // Cancel the moment the marker lands — the tightest race the effect cleanup
  // can produce. The chosen wrong is one missed interruption: the marker is
  // already on disk, so the next launch stays quiet too.
  h.io.setItem = async (key: string, value: string) => {
    h.store.set(key, value);
    h.cancel();
  };
  assert.equal(await evaluateTrialExpired(lapsed(), h.io), 'marked_only');
  assert.equal(h.presents(), 0);
  assert.equal(h.store.get(FIRED_KEY), EXPIRED);
});

test('unmount before the read returns writes nothing and presents nothing', async () => {
  const h = harness();
  h.cancel();
  assert.equal(await evaluateTrialExpired(lapsed(), h.io), 'cancelled');
  assert.equal(h.presents(), 0);
  assert.equal(h.store.size, 0);
});

// ── Source contracts: the wiring the pure core cannot prove ─────────────────

// Repo-relative, matching the other source-reading tests: the runner's cwd is
// the repository root.
const src = (path: string) => readFileSync(`src/${path}`, 'utf8');

test('the hook delegates to the tested core and registers Placement.TrialExpired', () => {
  const hook = src('features/billing/use-trial-expired.ts');
  assert.match(hook, /evaluateTrialExpired\(/, 'the hook must run the flow these tests prove');
  assert.match(hook, /from '\.\/trial-expired-core'/);
  // Through presentPromo, never the bare gate: trial_expired is one of the
  // four general promos, so the qualification, the frequency caps and the
  // paywall_eligible/dismissed events all belong to that one function.
  assert.match(hook, /presentPromo\(gate, Placement\.TrialExpired/);
  assert.doesNotMatch(hook, /gate\.present\(/);
  assert.doesNotMatch(
    hook,
    /getItem\(\s*['"`]/,
    'the storage key belongs to the core; a second literal here could fork it',
  );
});

test('the trial-expired hook is mounted on the authenticated tab layout', () => {
  const layout = src('app/(tabs)/_layout.tsx');
  assert.match(layout, /useTrialExpiredPlacement\(\)/);
});

test('paywall_presented is emitted from onPresent alone', () => {
  const gate = src('features/billing/use-gate.ts');
  const emits = gate.match(/track\('paywall_presented'/g) ?? [];
  assert.equal(emits.length, 1, 'exactly one emit — a second would double the funnel top');
  const onPresent = gate.indexOf('onPresent:');
  const nextHandler = gate.indexOf('onDismiss:');
  const emit = gate.indexOf("track('paywall_presented'");
  assert.ok(onPresent !== -1 && nextHandler !== -1 && emit !== -1);
  assert.ok(
    emit > onPresent && emit < nextHandler,
    'the impression must come from the SDK reporting an actual presentation',
  );
});
