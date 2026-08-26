import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  APPLE_ROOT_CA_G3_B64,
  ASC_GRANTING,
  ASC_REVOKING,
  SUPERWALL_FORWARD_URL,
  ascVerdict,
} from '../supabase/functions/_shared/asc-plan.ts';
import { PRODUCT_PLANS } from '../supabase/functions/_shared/superwall-plan.ts';
import { evaluate, type Report } from '../supabase/functions/commerce-health/thresholds.ts';

/**
 * The Event Forwarding rearrangement: Apple → `asc-notifications` → Superwall,
 * with the plan settled from Apple's word directly. The behavioural half runs
 * every branch of the verdict table; the source half pins the security
 * properties no unit can execute — verify-before-forward, verify-before-write,
 * and the pinned root.
 */

// ── The verdict table ───────────────────────────────────────────────────────

test('a purchase, a renewal and a redeemed offer grant the mapped plan', () => {
  for (const type of ['SUBSCRIBED', 'DID_RENEW', 'OFFER_REDEEMED']) {
    assert.deepEqual(ascVerdict(type, null, 'cinch.standard.monthly'), {
      kind: 'grant',
      plan: 'standard',
    });
    assert.deepEqual(ascVerdict(type, null, 'cinch.pro.annual'), { kind: 'grant', plan: 'pro' });
  }
});

test('expiry, grace-period expiry, revoke and refund all end the entitlement', () => {
  for (const type of ['EXPIRED', 'GRACE_PERIOD_EXPIRED', 'REVOKE', 'REFUND']) {
    assert.deepEqual(ascVerdict(type, null, 'cinch.standard.monthly'), {
      kind: 'grant',
      plan: 'free',
    });
  }
});

test('turning off auto-renew and a failed charge change NOTHING', () => {
  // The two easiest mistakes: cancellation keeps what was paid for until
  // EXPIRED, and Apple retries a failed charge for days.
  assert.deepEqual(ascVerdict('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED', 'cinch.pro.monthly'), {
    kind: 'no_change',
  });
  assert.deepEqual(ascVerdict('DID_FAIL_TO_RENEW', null, 'cinch.pro.monthly'), {
    kind: 'no_change',
  });
});

test('a renewal-preference change grants only on an immediate UPGRADE', () => {
  assert.deepEqual(ascVerdict('DID_CHANGE_RENEWAL_PREF', 'UPGRADE', 'cinch.pro.monthly'), {
    kind: 'grant',
    plan: 'pro',
  });
  // A downgrade applies at the next renewal; DID_RENEW will carry it.
  assert.deepEqual(ascVerdict('DID_CHANGE_RENEWAL_PREF', 'DOWNGRADE', 'cinch.standard.monthly'), {
    kind: 'no_change',
  });
});

test('a granting event with an unknown product is loud, not free', () => {
  assert.deepEqual(ascVerdict('SUBSCRIBED', 'INITIAL_BUY', 'cinch.platinum.lunar'), {
    kind: 'unmapped',
    productId: 'cinch.platinum.lunar',
  });
});

test("Apple's TEST ping and unknown types are no_change", () => {
  assert.deepEqual(ascVerdict('TEST', null, null), { kind: 'no_change' });
  assert.deepEqual(ascVerdict('CONSUMPTION_REQUEST', null, 'cinch.pro.monthly'), {
    kind: 'no_change',
  });
});

test('the two pipelines share one product table', () => {
  // The whole reason asc-plan imports PRODUCT_PLANS instead of copying it:
  // Superwall's webhook and Apple's notifications must never disagree about
  // what a product grants.
  for (const type of ASC_GRANTING) {
    for (const [productId, plan] of Object.entries(PRODUCT_PLANS)) {
      assert.deepEqual(ascVerdict(type, null, productId), { kind: 'grant', plan });
    }
  }
  // And no type sits in both sets.
  for (const type of ASC_GRANTING) assert.ok(!ASC_REVOKING.has(type), `${type} both grants and revokes`);
});

// ── The commerce-health alarm (handoff task 5) ──────────────────────────────

function baseRevenue(): NonNullable<Report['revenue']> {
  return { events_7d: 3, unattributed_7d: 0, unmapped_7d: 0, write_failed_7d: 0, last_event_at: null };
}

/** A report where nothing else fires, so the revenue rules test in isolation. */
function quietReport(revenue: Report['revenue']): Report {
  return {
    at: '2026-08-26T18:00:00Z',
    quota: null,
    cache: { rows: 0, live: 0, expired: 0, answered: 0, coverage: null, total_hits: 0 },
    monetisation: { joined_programmes: 1, networks: ['awin'] },
    counters: {},
    provider: {
      datafeedr_configured: true,
      awin_publisher_id_set: true,
      rakuten_tracking_id_set: false,
      unlicensed_fallback_on: false,
    },
    merchants: {
      allowlisted: 82,
      owner: 'founder',
      reviewed_on: '2026-08-11',
      review_by: '2026-11-11',
      review_in_days: 92,
    },
    revenue,
  };
}

test('an unattributed or unwritten revenue event is critical', () => {
  const unattributed = evaluate(quietReport({ ...baseRevenue(), unattributed_7d: 1 }));
  assert.ok(unattributed.some((a) => a.key === 'revenue_event_unapplied' && a.severity === 'critical'));

  const failed = evaluate(quietReport({ ...baseRevenue(), write_failed_7d: 2 }));
  assert.ok(failed.some((a) => a.key === 'revenue_event_unapplied'));
});

test('an unmapped product warns, and a clean week fires nothing', () => {
  const unmapped = evaluate(quietReport({ ...baseRevenue(), unmapped_7d: 1 }));
  assert.ok(unmapped.some((a) => a.key === 'revenue_product_unmapped' && a.severity === 'warning'));

  assert.deepEqual(
    evaluate(quietReport(baseRevenue())).filter((a) => a.key.startsWith('revenue')),
    [],
  );
  // A report from before the migration has no section and alarms on nothing.
  assert.deepEqual(evaluate(quietReport(null)).filter((a) => a.key.startsWith('revenue')), []);
});

// ── Source contracts ────────────────────────────────────────────────────────

const src = readFileSync('supabase/functions/asc-notifications/index.ts', 'utf8');

test('verification precedes both the forward and every database write', () => {
  const verify = src.indexOf('await verifyAppleJws(signedPayload)');
  const forward = src.indexOf('fetch(SUPERWALL_FORWARD_URL');
  const write = src.indexOf(".from('subscriptions')");
  assert.ok(verify > -1 && forward > -1 && write > -1, 'a stage is missing');
  assert.ok(verify < forward, 'the forward runs before verification — an open relay');
  assert.ok(verify < write, 'a write runs before verification');
});

test('the chain root is pinned by byte equality, not by name', () => {
  assert.match(src, /x5c\[x5c\.length - 1\] !== APPLE_ROOT_CA_G3_B64/);
  // And the pin itself is still well-formed base64 of DER-plausible length.
  assert.ok(APPLE_ROOT_CA_G3_B64.length > 700);
  assert.match(APPLE_ROOT_CA_G3_B64, /^[A-Za-z0-9+/]+={0,2}$/);
});

test('the nested transaction JWS is verified in its own right', () => {
  assert.match(src, /verifyAppleJws\(note\.data\.signedTransactionInfo\)/);
});

test('the forward sends the raw bytes to the documented Superwall intake', () => {
  assert.match(src, /body: rawBody/);
  assert.ok(SUPERWALL_FORWARD_URL.startsWith('https://integrations.superwall.com/integrations/app-store-connect/webhook?pk=pk_'));
});

test('a failed forward asks Apple to redeliver', () => {
  assert.match(src, /if \(!forwarded\) \{\s*return Response\.json\(\{ error: 'Forward failed\.' \}, \{ status: 500 \}\);/);
});

test('the user is only ever the transaction’s own appAccountToken, as a UUID', () => {
  assert.match(src, /UUID_RE\.test\(txn\.appAccountToken\)/);
  assert.doesNotMatch(src, /originalAppUserId/, 'a Superwall-shaped id leaked into the Apple path');
});
