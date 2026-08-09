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
