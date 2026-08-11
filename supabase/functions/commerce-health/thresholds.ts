/**
 * When is a commerce number bad enough to wake somebody.
 *
 * A PURE MODULE, ON PURPOSE
 *
 * No Deno, no network, no database — so `tests/commerce-health.test.ts` can
 * feed it reports and assert what fires. Alert thresholds are exactly the kind
 * of code that is written once, never run in anger for months, and then turns
 * out to have an inverted comparison in it on the day it was needed.
 *
 * THE RULE BEHIND THE RULES
 *
 * Every alert here corresponds to a failure that is INVISIBLE from the app. A
 * spent quota, a failing cache write, a drifting merchant list and an unset
 * credential all produce the same user-facing symptom: an empty shop row, which
 * is a legitimate state the surface renders every day. Nothing that shows up as
 * an error to a user is alerted on, because that already has a reporter.
 */

export type Report = {
  at: string;
  quota: {
    provider: string;
    used: number;
    limit: number | null;
    remaining: number;
    fraction_used: number | null;
    reserve: number;
    cycle_start: string;
    cycle_end: string;
    bill_day: number;
    cache_write_failures: number;
  } | null;
  cache: {
    rows: number;
    live: number;
    expired: number;
    answered: number;
    coverage: number | null;
    total_hits: number;
  };
  monetisation: { joined_programmes: number; networks: string[] };
  counters: Record<string, { value: number; last_at: string | null; last_detail: string | null }>;
  provider: {
    datafeedr_configured: boolean;
    awin_publisher_id_set: boolean;
    rakuten_tracking_id_set: boolean;
    unlicensed_fallback_on: boolean;
  };
  merchants: { allowlisted: number };
};

export type Alert = {
  /** Stable across firings — it is the cooldown key. Never interpolate a
   *  number into it, or every tick becomes a new alert. */
  key: string;
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
  cooldownHours: number;
};

/** Quota is claimed against `limit - reserve` for speculative lookups, so the
 *  interesting line is well before 100%. */
const QUOTA_WARN = 0.8;
const QUOTA_CRITICAL = 0.95;

/** Below this, the catalogue is answering so few of our questions that a slot
 *  recipe or the merchant allowlist has probably drifted. Only meaningful once
 *  there is enough traffic for the ratio to mean anything. */
const COVERAGE_FLOOR = 0.5;
const COVERAGE_MIN_SAMPLE = 50;

export function evaluate(report: Report): Alert[] {
  const alerts: Alert[] = [];
  const counter = (name: string) => report.counters[name]?.value ?? 0;

  // ── The provider is not configured ───────────────────────────────────────
  //
  // First because it is the only one that makes every other number meaningless.
  if (!report.provider.datafeedr_configured) {
    alerts.push({
      key: 'provider_unconfigured',
      severity: 'critical',
      title: 'Datafeedr is not configured',
      detail:
        'DATAFEEDR_ACCESS_ID or DATAFEEDR_ACCESS_KEY is unset, so every commerce ' +
        'surface is returning an empty list — which looks exactly like a garment ' +
        'nobody sells. Set both with `supabase secrets set`.',
      cooldownHours: 6,
    });
  }

  // The unlicensed image path must stay off. It was the default once, and the
  // whole licensed catalogue exists because it should not be.
  if (report.provider.unlicensed_fallback_on) {
    alerts.push({
      key: 'unlicensed_fallback_on',
      severity: 'critical',
      title: 'The unlicensed image fallback is switched on',
      detail:
        'GARMENT_SEARCH_ALLOW_UNLICENSED is "true". Garment images are being ' +
        'taken from open-web search results, which carry no publisher licence. ' +
        'Unset it unless this is a deliberate, time-boxed test.',
      cooldownHours: 6,
    });
  }

  // ── Quota ────────────────────────────────────────────────────────────────
  const q = report.quota;
  if (q && q.fraction_used !== null) {
    if (q.fraction_used >= QUOTA_CRITICAL) {
      alerts.push({
        key: 'quota_critical',
        severity: 'critical',
        title: `Datafeedr quota at ${Math.round(q.fraction_used * 100)}%`,
        detail:
          `${q.used} of ${q.limit} requests used this cycle, ${q.remaining} left. ` +
          `There is no overage: at the limit the API returns error 301 until ${q.cycle_end}, ` +
          'and every commerce surface goes quiet. The reserve keeps exact lookups ' +
          'working slightly longer than keyword search.',
        cooldownHours: 12,
      });
    } else if (q.fraction_used >= QUOTA_WARN) {
      alerts.push({
        key: 'quota_warning',
        severity: 'warning',
        title: `Datafeedr quota at ${Math.round(q.fraction_used * 100)}%`,
        detail:
          `${q.used} of ${q.limit} requests used, cycle resets ${q.cycle_end}. ` +
          'Still time to act — this is the point where the cutoff becomes ' +
          'predictable, not the cutoff itself.',
        cooldownHours: 24,
      });
    }

    // A failed cache write is a bill that reports itself as nothing: the user
    // still gets their answer, and the next identical lookup pays again.
    if (q.cache_write_failures > 0) {
      alerts.push({
        key: 'cache_write_failures',
        severity: 'warning',
        title: `${q.cache_write_failures} catalogue cache writes have failed`,
        detail:
          'Every failure means the next identical lookup spends a metered request ' +
          'that should have been free. Nothing errors and no user notices — the ' +
          'answer was already in hand. Check the catalog_lookups constraints and ' +
          'the service role grant.',
        cooldownHours: 24,
      });
    }
  }

  // ── Coverage ─────────────────────────────────────────────────────────────
  if (
    report.cache.rows >= COVERAGE_MIN_SAMPLE &&
    report.cache.coverage !== null &&
    report.cache.coverage < COVERAGE_FLOOR
  ) {
    alerts.push({
      key: 'coverage_degraded',
      severity: 'warning',
      title: `Catalogue coverage down to ${Math.round(report.cache.coverage * 100)}%`,
      detail:
        `${report.cache.answered} of ${report.cache.rows} lookups came back with ` +
        'anything at all. This degrades silently: a slot whose recipe has drifted, ' +
        'or a merchant allowlist that has gone stale, returns fewer rows rather ' +
        'than an error. Re-run the fixtures in tests/slot-relevance.test.ts.',
      cooldownHours: 24,
    });
  }

  // ── The provider is failing ──────────────────────────────────────────────
  const failures = counter('provider_failure');
  const served = counter('suggestions_served') + counter('suggestions_empty');
  if (failures > 0 && (served === 0 || failures / Math.max(served, 1) > 0.1)) {
    alerts.push({
      key: 'provider_failing',
      severity: 'critical',
      title: 'Catalogue lookups are failing',
      detail:
        `${failures} failures against ${served} suggestions. Last: ` +
        `${report.counters.provider_failure?.last_detail ?? 'unknown'} at ` +
        `${report.counters.provider_failure?.last_at ?? 'unknown'}.`,
      cooldownHours: 6,
    });
  }

  // ── A paid link that is not paid ─────────────────────────────────────────
  //
  // The inverse of the usual alert: this one fires when we are CLAIMING to earn
  // from links while no programme is joined. It should be impossible — `paid`
  // is computed from `commerce_joined_programmes` — so if it ever fires, the
  // table and the label have come apart, and the app is telling users something
  // untrue about money.
  if (counter('links_paid') > 0 && report.monetisation.joined_programmes === 0) {
    alerts.push({
      key: 'paid_links_without_programmes',
      severity: 'critical',
      title: 'Links are being labelled paid with no joined programme',
      detail:
        `${counter('links_paid')} links were served as "paid" while ` +
        'commerce_joined_programmes holds no active row. Every one of those told ' +
        'a user we earn a commission we do not earn. Check how `paid` is computed ' +
        'in gap-shop-match.',
      cooldownHours: 1,
    });
  }

  return alerts;
}

export const __testables = { QUOTA_WARN, QUOTA_CRITICAL, COVERAGE_FLOOR, COVERAGE_MIN_SAMPLE };
