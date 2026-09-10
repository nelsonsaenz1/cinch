import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * The tier numbers exist in three places — the Edge Functions' authority copy,
 * the client's display copy, and item_limit_for_plan() in the database — and a
 * comment in each promises a test holds them together. This is that test for
 * the two TypeScript copies; the pgTAP suite (04_plans.sql) covers the SQL one.
 *
 * The Edge Function module imports from `npm:` specifiers Deno understands and
 * Node does not, so the limits are asserted against literals here rather than
 * imported — which is fine, because the point is a tripwire, not DRY: changing
 * any copy without changing the others must fail SOMETHING.
 */
import { PLANS } from '../src/features/billing/plans';

const EDGE_ITEM_LIMITS = { free: 10, standard: 150, pro: 1000 } as const;
const EDGE_STORED_ITEM_LIMITS = { free: 30, standard: 450, pro: 3000 } as const;

/**
 * `PLAN_LIMITS.<plan>.outfit_generation` in the Edge Functions' copy — the
 * ENFORCED ceiling, which deliberately sits above the promise. Same literal
 * treatment as the item limits above, for the same `npm:` specifier reason.
 */
const EDGE_OUTFIT_CEILINGS = {
  free: { limit: 5, period: 'week' },
  standard: { limit: 15, period: 'day' },
  pro: { limit: 60, period: 'day' },
} as const;

test('client plan copy agrees with the edge/database item limits', () => {
  for (const plan of ['free', 'standard', 'pro'] as const) {
    assert.equal(
      PLANS[plan].items,
      EDGE_ITEM_LIMITS[plan],
      `${plan}: client says ${PLANS[plan].items}, edge/database say ${EDGE_ITEM_LIMITS[plan]}`,
    );
    assert.equal(
      PLANS[plan].storedItems,
      EDGE_STORED_ITEM_LIMITS[plan],
      `${plan}: client stores ${PLANS[plan].storedItems}, edge/database say ${EDGE_STORED_ITEM_LIMITS[plan]}`,
    );
  }
});

test('the outfit promise sits below the enforced ceiling, in the same period', () => {
  // The server's plans.ts calls this the trap worth naming: the promise is
  // what the UI says and the ceiling is an abuse control above it, and the gap
  // is the slack that makes the promise deliverable through a failed provider
  // call. A promise that reached the ceiling would make "this week's 3
  // outfits" a sentence the user can disprove.
  for (const plan of ['free', 'standard'] as const) {
    const promise = PLANS[plan].outfitPromise;
    assert.ok(promise, `${plan} must promise a number — context-lines.ts quotes it`);
    assert.equal(promise.period, EDGE_OUTFIT_CEILINGS[plan].period, plan);
    assert.ok(
      promise.count < EDGE_OUTFIT_CEILINGS[plan].limit,
      `${plan}: promises ${promise.count} per ${promise.period} against a ceiling of ${EDGE_OUTFIT_CEILINGS[plan].limit}`,
    );
  }
});

test('Pro promises no outfit number, because its copy says Unlimited', () => {
  // A figure here would contradict the word two lines above it in the same
  // object, and whichever one a surface picked would be the wrong one.
  assert.equal(PLANS.pro.outfitPromise, null);
  assert.equal(PLANS.pro.outfits, 'Unlimited');
});

test('price hints carry the 2026-09-10 affordable-membership prices, and free carries none', () => {
  // Hints, not truth — the paywall reads StoreKit live and formats per locale
  // (plans.ts spells this out). But a stale hint quotes a price the purchase
  // sheet then contradicts, which reads as a bait-and-switch rather than a
  // typo. These literals are the founder's 2026-09-10 repricing: Standard
  // $0.99 / month, Pro $2.99 / month; the annual products keep $39.99 / $79.99
  // for existing subscribers and leave the primary paywall. Change the
  // monthly hints only alongside the App Store Connect price points.
  assert.equal(PLANS.standard.monthlyPriceHint, '$0.99');
  assert.equal(PLANS.standard.annualPriceHint, '$39.99');
  assert.equal(PLANS.pro.monthlyPriceHint, '$2.99');
  assert.equal(PLANS.pro.annualPriceHint, '$79.99');
  assert.equal(PLANS.free.monthlyPriceHint, null);
  assert.equal(PLANS.free.annualPriceHint, null);
});

test('no price hint smuggles trial wording in beside the number', () => {
  // Correction 06: in-app copy never states a trial duration as a constant —
  // the paywall document reads the live StoreKit offer. A hint that grew
  // "…with 7-day trial" would go stale the day the offer changed.
  for (const plan of ['free', 'standard', 'pro'] as const) {
    for (const hint of [PLANS[plan].monthlyPriceHint, PLANS[plan].annualPriceHint]) {
      if (hint === null) continue;
      assert.match(hint, /^\$\d+(\.\d{2})?$/, `${plan}: "${hint}" must be a bare price`);
      assert.doesNotMatch(hint, /trial|free|day/i, `${plan}: "${hint}" must not mention a trial`);
    }
  }
});

test('the total ceiling leaves real room above the active one', () => {
  // The two exist to do different jobs. If they were ever set equal, storing a
  // piece would stop making room and The Wall's non-payment exit would quietly
  // become decorative again — the exact regression migration 20260808170000
  // was written to undo.
  for (const plan of ['free', 'standard', 'pro'] as const) {
    assert.ok(
      PLANS[plan].storedItems > PLANS[plan].items,
      `${plan}: storing must free an active slot, so the total ceiling has to sit above the active one`,
    );
  }
});
