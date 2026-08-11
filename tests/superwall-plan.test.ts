/**
 * The plan decision, which two functions now share.
 *
 * WHY THIS FILE EXISTS
 *
 * `PRODUCT_PLANS`, `GRANTING` and `REVOKING` used to live inside
 * `superwall-webhook/index.ts`, where nothing could import them and nothing did
 * test them — the only coverage was reading the comments and believing them.
 * Audit item 24 gave them a second caller (`superwall-reconcile`, replaying
 * stored events), and a rule with two implementations is a rule with a drift
 * bug waiting. Extracting them made them testable; this is the test.
 *
 * The stakes are asymmetric. Getting a grant wrong gives somebody a tier they
 * did not pay for. Getting a revoke wrong takes away a tier somebody DID pay
 * for, from inside the one code path that can move `subscriptions.plan` at all.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALIAS_PREFIX,
  GRANTING,
  isStale,
  isSuperwallAlias,
  PRODUCT_PLANS,
  reconcile,
  REVOKING,
  verdictFor,
} from '../supabase/functions/_shared/superwall-plan.ts';

// ---------------------------------------------------------------------------
// The product table
// ---------------------------------------------------------------------------

test('every configured product maps to the tier its id claims', () => {
  // Written out rather than derived from the id, because deriving it from the
  // string is exactly the bug this would fail to catch.
  assert.equal(PRODUCT_PLANS['cinch.standard.monthly'], 'standard');
  assert.equal(PRODUCT_PLANS['cinch.standard.annual'], 'standard');
  assert.equal(PRODUCT_PLANS['cinch.pro.monthly'], 'pro');
  assert.equal(PRODUCT_PLANS['cinch.pro.annual'], 'pro');
  assert.equal(Object.keys(PRODUCT_PLANS).length, 4);
});

test('no product maps to free', () => {
  // A product that grants `free` would be indistinguishable from a revocation,
  // and would silently downgrade whoever bought it.
  for (const [id, plan] of Object.entries(PRODUCT_PLANS)) {
    assert.notEqual(plan, 'free', `${id} grants free`);
  }
});

// ---------------------------------------------------------------------------
// Which events move anything
// ---------------------------------------------------------------------------

test('cancellation does not revoke', () => {
  // The single easiest mistake in this file. Cancelling turns off auto-renew;
  // the user keeps what they paid for until expirationAt. `expiration` is the
  // event that ends it.
  assert.equal(REVOKING.has('cancellation'), false);
  assert.deepEqual(verdictFor('cancellation', 'cinch.pro.annual'), { kind: 'no_change' });
});

test('billing_issue does not revoke', () => {
  // Apple retries a failed charge for days and the subscription is in grace
  // throughout. Downgrading on the first failure punishes an expired card.
  assert.equal(REVOKING.has('billing_issue'), false);
  assert.deepEqual(verdictFor('billing_issue', 'cinch.pro.annual'), { kind: 'no_change' });
});

test('expiration and subscription_paused revoke to free', () => {
  assert.deepEqual(verdictFor('expiration', 'cinch.pro.annual'), { kind: 'grant', plan: 'free' });
  assert.deepEqual(verdictFor('subscription_paused', null), { kind: 'grant', plan: 'free' });
});

test('a revocation ignores the product it names', () => {
  // Otherwise an `expiration` carrying a pro productId would read as a grant.
  assert.deepEqual(verdictFor('expiration', 'cinch.pro.monthly'), { kind: 'grant', plan: 'free' });
});

test('every granting event grants what its product says', () => {
  for (const type of GRANTING) {
    assert.deepEqual(
      verdictFor(type, 'cinch.standard.monthly'),
      { kind: 'grant', plan: 'standard' },
      type,
    );
  }
});

test('product_change grants the new product, not the old one', () => {
  // Superwall sends product_change with the NEW productId, which is why it sits
  // in GRANTING and needs no special case.
  assert.deepEqual(verdictFor('product_change', 'cinch.pro.annual'), {
    kind: 'grant',
    plan: 'pro',
  });
});

test('an unknown product is unmapped, never free', () => {
  // Treating it as free would silently downgrade a paying customer the moment a
  // product is added in the dashboard and forgotten here.
  assert.deepEqual(verdictFor('initial_purchase', 'cinch.platinum.monthly'), {
    kind: 'unmapped',
    productId: 'cinch.platinum.monthly',
  });
  assert.deepEqual(verdictFor('renewal', null), { kind: 'unmapped', productId: null });
});

test('an unrecognised event type changes nothing', () => {
  assert.deepEqual(verdictFor('some_future_event', 'cinch.pro.annual'), { kind: 'no_change' });
});

// ---------------------------------------------------------------------------
// Recency
// ---------------------------------------------------------------------------

test('an event ending no later than what is stored is stale', () => {
  assert.equal(isStale('2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'), true);
  assert.equal(isStale('2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z'), true, 'a tie is stale');
  assert.equal(isStale('2026-03-01T00:00:00Z', '2026-02-01T00:00:00Z'), false);
});

test('an event with no end date is never stale', () => {
  // subscription_paused has no expirationAt and must not become ignorable
  // because of it.
  assert.equal(isStale(null, '2027-01-01T00:00:00Z'), false);
});

test('nothing is stale against an empty subscription', () => {
  assert.equal(isStale('2026-01-01T00:00:00Z', null), false);
  assert.equal(isStale('2026-01-01T00:00:00Z', undefined), false);
});

// ---------------------------------------------------------------------------
// Aliases
// ---------------------------------------------------------------------------

test('a real SuperwallKit alias is recognised', () => {
  // The shape IdentityLogic.generateAlias() produces: the prefix plus a
  // UUID().uuidString.
  assert.equal(isSuperwallAlias(`${ALIAS_PREFIX}3F2504E0-4F89-11D3-9A0C-0305E82C3301`), true);
  assert.equal(isSuperwallAlias(`${ALIAS_PREFIX}3f2504e0-4f89-11d3-9a0c-0305e82c3301`), true);
});

test('anything that is not an alias is refused', () => {
  const rejected = [
    '',
    'not-an-alias',
    // A real Supabase user id, which is the value an attacker would reach for
    // first: claiming another USER's events rather than another alias's.
    '3F2504E0-4F89-11D3-9A0C-0305E82C3301',
    `${ALIAS_PREFIX}`,
    `${ALIAS_PREFIX}nope`,
    `${ALIAS_PREFIX}3F2504E0-4F89-11D3-9A0C-0305E82C33`,
    `${ALIAS_PREFIX}3F2504E0-4F89-11D3-9A0C-0305E82C3301-extra`,
    // SQL wildcards, in case the lookup ever moves to LIKE.
    `${ALIAS_PREFIX}%`,
    `%${ALIAS_PREFIX}3F2504E0-4F89-11D3-9A0C-0305E82C3301`,
    ` ${ALIAS_PREFIX}3F2504E0-4F89-11D3-9A0C-0305E82C3301`,
  ];
  for (const value of rejected) {
    assert.equal(isSuperwallAlias(value), false, JSON.stringify(value));
  }
});

// ---------------------------------------------------------------------------
// Settling a queue
// ---------------------------------------------------------------------------

test('an empty queue settles to nothing', () => {
  assert.equal(reconcile([]), null);
});

test('a queue of only no-change events settles to nothing', () => {
  // A cancellation on its own must not be read as "write free". The user never
  // had a plan written; writing free would be inventing a downgrade.
  assert.equal(
    reconcile([
      { type: 'cancellation', productId: 'cinch.pro.annual', periodEnd: '2026-06-01T00:00:00Z' },
      { type: 'billing_issue', productId: 'cinch.pro.annual', periodEnd: null },
    ]),
    null,
  );
});

test('a single purchase settles to its plan and period', () => {
  assert.deepEqual(
    reconcile([
      {
        type: 'initial_purchase',
        productId: 'cinch.standard.monthly',
        periodEnd: '2026-09-01T00:00:00Z',
      },
    ]),
    { plan: 'standard', periodEnd: '2026-09-01T00:00:00Z', unmapped: [] },
  );
});

test('an upgrade later in the queue wins', () => {
  const settled = reconcile([
    {
      type: 'initial_purchase',
      productId: 'cinch.standard.monthly',
      periodEnd: '2026-09-01T00:00:00Z',
    },
    { type: 'product_change', productId: 'cinch.pro.annual', periodEnd: '2027-09-01T00:00:00Z' },
  ]);
  assert.deepEqual(settled, { plan: 'pro', periodEnd: '2027-09-01T00:00:00Z', unmapped: [] });
});

test('an older event cannot beat a newer one, whatever the order it arrives in', () => {
  const newer = {
    type: 'renewal',
    productId: 'cinch.pro.annual',
    periodEnd: '2027-09-01T00:00:00Z',
  };
  const older = {
    type: 'initial_purchase',
    productId: 'cinch.standard.monthly',
    periodEnd: '2026-09-01T00:00:00Z',
  };
  const expected = { plan: 'pro', periodEnd: '2027-09-01T00:00:00Z', unmapped: [] };

  assert.deepEqual(reconcile([older, newer]), expected);
  assert.deepEqual(reconcile([newer, older]), expected, 'receipt order must not decide it');
});

test('a queued purchase that has since expired settles to free', () => {
  // The whole queue is replayed, not just the purchase. A user whose anonymous
  // subscription ran out before they ever signed in must not be handed a live
  // entitlement by the reconciliation.
  assert.deepEqual(
    reconcile([
      {
        type: 'initial_purchase',
        productId: 'cinch.pro.annual',
        periodEnd: '2026-09-01T00:00:00Z',
      },
      { type: 'expiration', productId: 'cinch.pro.annual', periodEnd: '2026-10-01T00:00:00Z' },
    ]),
    { plan: 'free', periodEnd: '2026-10-01T00:00:00Z', unmapped: [] },
  );
});

test('a pause with no end date still wins over a dated purchase', () => {
  // Mirrors the live path, where a revocation with no expirationAt applies
  // unconditionally rather than being dropped for lacking a date.
  assert.deepEqual(
    reconcile([
      {
        type: 'initial_purchase',
        productId: 'cinch.pro.annual',
        periodEnd: '2027-09-01T00:00:00Z',
      },
      { type: 'subscription_paused', productId: null, periodEnd: null },
    ]),
    { plan: 'free', periodEnd: null, unmapped: [] },
  );
});

test('a repurchase after a pause wins', () => {
  assert.deepEqual(
    reconcile([
      { type: 'subscription_paused', productId: null, periodEnd: null },
      {
        type: 'initial_purchase',
        productId: 'cinch.pro.annual',
        periodEnd: '2027-09-01T00:00:00Z',
      },
    ]),
    { plan: 'pro', periodEnd: '2027-09-01T00:00:00Z', unmapped: [] },
  );
});

test('one unmapped product is reported without stranding the rest of the queue', () => {
  const settled = reconcile([
    {
      type: 'initial_purchase',
      productId: 'cinch.platinum.monthly',
      periodEnd: '2026-09-01T00:00:00Z',
    },
    { type: 'renewal', productId: 'cinch.pro.annual', periodEnd: '2027-09-01T00:00:00Z' },
  ]);
  assert.deepEqual(settled, {
    plan: 'pro',
    periodEnd: '2027-09-01T00:00:00Z',
    unmapped: ['cinch.platinum.monthly'],
  });
});

test('a queue of nothing but unmapped products settles to nothing, not to free', () => {
  // The dangerous shape: if this returned `free`, an unrecognised product would
  // write a downgrade for someone who had just paid.
  const settled = reconcile([
    {
      type: 'initial_purchase',
      productId: 'cinch.platinum.monthly',
      periodEnd: '2026-09-01T00:00:00Z',
    },
  ]);
  assert.equal(settled, null);
});
