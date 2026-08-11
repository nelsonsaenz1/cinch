/**
 * Alert thresholds.
 *
 * WHY THESE ARE WORTH TESTING WHEN ALMOST NOTHING ELSE IN OPS IS
 *
 * Because of when they run. A threshold is written once, is correct as far as
 * anybody can tell by reading it, and then does nothing at all for four months
 * — until the one morning it is the only thing standing between a silent
 * failure and a bill. That is the worst possible moment to discover an
 * inverted comparison, and it is a class of bug that reading does not catch:
 * `>=` and `>` look equally right on the page.
 *
 * The other reason is that every condition here is INVISIBLE from the app. A
 * spent Datafeedr quota, a failing cache write, a merchant list that has
 * drifted — all of them surface to a user as an empty shop row, which is a
 * legitimate state Cinch renders every day. If the alert does not fire, nothing
 * else will.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluate, type Report } from '../supabase/functions/commerce-health/thresholds.ts';

/** A system in perfect health. Every test below is this, with one thing wrong. */
function healthy(): Report {
  return {
    at: '2026-08-11T18:00:00Z',
    quota: {
      provider: 'datafeedr',
      used: 100,
      limit: 10_000,
      remaining: 9_900,
      fraction_used: 0.01,
      reserve: 500,
      cycle_start: '2026-08-11',
      cycle_end: '2026-09-11',
      bill_day: 11,
      cache_write_failures: 0,
    },
    cache: { rows: 200, live: 180, expired: 20, answered: 190, coverage: 0.95, total_hits: 400 },
    monetisation: { joined_programmes: 0, networks: [] },
    counters: {
      suggestions_served: { value: 500, last_at: null, last_detail: null },
      suggestions_empty: { value: 50, last_at: null, last_detail: null },
      links_direct: { value: 500, last_at: null, last_detail: null },
      links_paid: { value: 0, last_at: null, last_detail: null },
      provider_failure: { value: 0, last_at: null, last_detail: null },
      rows_refused_as_irrelevant: { value: 120, last_at: null, last_detail: null },
    },
    provider: {
      datafeedr_configured: true,
      awin_publisher_id_set: true,
      rakuten_tracking_id_set: false,
      unlicensed_fallback_on: false,
    },
    merchants: { allowlisted: 82 },
  };
}

const keys = (r: Report) => evaluate(r).map((a) => a.key).sort();

test('a healthy system alerts about nothing', () => {
  // Including: zero joined programmes is NOT an alert. It is the normal state
  // before any Awin approval lands, and the app tells the truth about it by
  // labelling every link "Open at merchant".
  assert.deepEqual(keys(healthy()), []);
});

test('quota warns at 80% and escalates at 95%', () => {
  const at = (fraction: number) => {
    const r = healthy();
    r.quota!.fraction_used = fraction;
    r.quota!.used = Math.round(fraction * 10_000);
    r.quota!.remaining = 10_000 - r.quota!.used;
    return keys(r);
  };

  assert.deepEqual(at(0.79), []);
  assert.deepEqual(at(0.8), ['quota_warning'], 'the boundary itself must fire');
  assert.deepEqual(at(0.94), ['quota_warning']);
  assert.deepEqual(at(0.95), ['quota_critical']);
  assert.deepEqual(at(1), ['quota_critical']);

  // One or the other, never both — two emails about one number is how an alert
  // channel becomes something people filter.
  for (const f of [0.8, 0.9, 0.95, 0.99]) assert.equal(at(f).length, 1);
});

test('an unconfigured provider is critical, because it looks like nothing', () => {
  const r = healthy();
  r.provider.datafeedr_configured = false;
  const alerts = evaluate(r);
  assert.deepEqual(alerts.map((a) => a.key), ['provider_unconfigured']);
  assert.equal(alerts[0].severity, 'critical');
});

test('the unlicensed image fallback being on is critical', () => {
  // It was the default once. The entire licensed catalogue exists because it
  // should not be, so this must be loud rather than a note in a log.
  const r = healthy();
  r.provider.unlicensed_fallback_on = true;
  assert.deepEqual(keys(r), ['unlicensed_fallback_on']);
});

test('a single failed cache write is worth saying out loud', () => {
  const r = healthy();
  r.quota!.cache_write_failures = 1;
  assert.deepEqual(keys(r), ['cache_write_failures']);
});

test('coverage only alerts once there is enough traffic to mean anything', () => {
  const r = healthy();
  r.cache = { rows: 10, live: 10, expired: 0, answered: 1, coverage: 0.1, total_hits: 10 };
  assert.deepEqual(keys(r), [], '10 lookups is not evidence of degradation');

  r.cache = { rows: 200, live: 200, expired: 0, answered: 60, coverage: 0.3, total_hits: 200 };
  assert.deepEqual(keys(r), ['coverage_degraded']);

  r.cache = { rows: 200, live: 200, expired: 0, answered: 120, coverage: 0.6, total_hits: 200 };
  assert.deepEqual(keys(r), [], 'above the floor is not an alert');
});

test('provider failures alert on their share, not their count', () => {
  const r = healthy();
  // 20 failures against 550 suggestions is under 10% — noise, not an outage.
  r.counters.provider_failure = { value: 20, last_at: '2026-08-11T17:00:00Z', last_detail: 'x' };
  assert.deepEqual(keys(r), []);

  r.counters.provider_failure = { value: 200, last_at: '2026-08-11T17:00:00Z', last_detail: 'x' };
  assert.deepEqual(keys(r), ['provider_failing']);
});

test('any failure at all is an outage when nothing has succeeded', () => {
  // The division would otherwise hide the worst case: a function that has never
  // returned a suggestion and fails every time has a denominator of zero.
  const r = healthy();
  r.counters.suggestions_served = { value: 0, last_at: null, last_detail: null };
  r.counters.suggestions_empty = { value: 0, last_at: null, last_detail: null };
  r.counters.provider_failure = { value: 1, last_at: '2026-08-11T17:00:00Z', last_detail: 'x' };
  assert.deepEqual(keys(r), ['provider_failing']);
});

test('claiming a paid link with no joined programme is critical and near-instant', () => {
  // The inverse of the usual alert. `paid` is computed FROM the joined
  // programmes table, so this state should be unreachable — and if it is ever
  // reached, the app is telling users something untrue about money.
  const r = healthy();
  r.counters.links_paid = { value: 3, last_at: null, last_detail: null };
  const alerts = evaluate(r);
  assert.deepEqual(alerts.map((a) => a.key), ['paid_links_without_programmes']);
  assert.equal(alerts[0].severity, 'critical');
  assert.ok(alerts[0].cooldownHours <= 1, 'this one must not be rate-limited into silence');

  // With a programme actually joined it is simply normal traffic.
  r.monetisation = { joined_programmes: 1, networks: ['awin'] };
  assert.deepEqual(keys(r), []);
});

test('every alert key is stable and every cooldown is sane', () => {
  // A key with a number interpolated into it would defeat the cooldown — each
  // tick would look like a brand-new alert and mail again.
  const r = healthy();
  r.provider.datafeedr_configured = false;
  r.provider.unlicensed_fallback_on = true;
  r.quota!.fraction_used = 0.99;
  r.quota!.cache_write_failures = 5;
  r.counters.links_paid = { value: 1, last_at: null, last_detail: null };

  const alerts = evaluate(r);
  assert.ok(alerts.length >= 5);
  for (const a of alerts) {
    assert.match(a.key, /^[a-z_]+$/, `unstable alert key: ${a.key}`);
    assert.ok(a.cooldownHours >= 1 && a.cooldownHours <= 24, `odd cooldown on ${a.key}`);
    assert.ok(a.title.length > 0 && a.detail.length > 0, `${a.key} has no message`);
  }
  assert.equal(new Set(alerts.map((a) => a.key)).size, alerts.length, 'duplicate keys');
});
