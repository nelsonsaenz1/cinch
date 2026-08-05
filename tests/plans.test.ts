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

const EDGE_ITEM_LIMITS = { free: 30, standard: 150, pro: 1000 } as const;

test('client plan copy agrees with the edge/database item limits', () => {
  for (const plan of ['free', 'standard', 'pro'] as const) {
    assert.equal(
      PLANS[plan].items,
      EDGE_ITEM_LIMITS[plan],
      `${plan}: client says ${PLANS[plan].items}, edge/database say ${EDGE_ITEM_LIMITS[plan]}`,
    );
  }
});
