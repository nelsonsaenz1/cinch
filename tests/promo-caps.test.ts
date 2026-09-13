/**
 * The general-promo frequency caps — the arithmetic and the seams.
 *
 * `evaluatePromoCaps` (promo-caps.ts) is pure, so every boundary is executed
 * here directly: the rolling 24h and 7d windows at exactly their edges, the
 * ten→reveal pair rule, and the placements the caps must never count. What
 * the pure core cannot prove — that `presentPromo` records an impression on
 * exactly the outcomes that mean a sheet visibly presented, that
 * 'unavailable' never spends the allowance, that the eligibility denominator
 * fires unconditionally — is pinned by source-contract assertions at the
 * bottom, the same way trial-expired-placement.test.ts reads its modules.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  evaluatePromoCaps,
  GENERAL_PROMO_PLACEMENTS,
  type PromoImpression,
} from '../src/features/billing/promo-caps';

const NOW = '2026-08-31T12:00:00.000Z';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** An impression `ms` before NOW. */
const ago = (ms: number, placement = 'trial_expired'): PromoImpression => ({
  placement,
  shownAtIso: new Date(new Date(NOW).getTime() - ms).toISOString(),
});

// ── Membership: which placements the caps govern ────────────────────────────

test('the general promos are exactly the four app-initiated asks', () => {
  assert.deepEqual(
    [...GENERAL_PROMO_PLACEMENTS].sort(),
    ['returning_free', 'reveal_complete', 'ten_completed', 'trial_expired'].sort(),
  );
});

test('a contextual gate is never capped, whatever the history says', () => {
  // The user asked for a locked feature; the answer may not be silence.
  const saturated = [ago(1 * HOUR), ago(2 * DAY), ago(3 * DAY), ago(4 * DAY)];
  for (const placement of [
    'add_garment_over_limit',
    'generate_outfit_over_limit',
    'open_stylist',
    'packing_access',
    'membership_upgrade',
    'event_join_over_limit',
    'event_hosting_over_limit',
    'repeat_upsell',
  ] as const) {
    assert.deepEqual(evaluatePromoCaps(NOW, saturated, placement), {
      allowed: true,
      reason: 'ok',
    });
  }
});

test('contextual-gate impressions in the ledger do not spend the general allowance', () => {
  // Only rows whose placement is itself a general promo count — a user who
  // hit the closet ceiling an hour ago has not used up today's ask.
  const contextual = [
    ago(1 * HOUR, 'add_garment_over_limit'),
    ago(2 * HOUR, 'open_stylist'),
    ago(3 * HOUR, 'repeat_upsell'),
  ];
  assert.deepEqual(evaluatePromoCaps(NOW, contextual, 'returning_free'), {
    allowed: true,
    reason: 'ok',
  });
});

// ── The 24-hour cap, at its exact edges ─────────────────────────────────────

test('an empty history allows', () => {
  assert.deepEqual(evaluatePromoCaps(NOW, [], 'ten_completed'), { allowed: true, reason: 'ok' });
});

test('one general promo inside 24h refuses with cap_24h', () => {
  assert.deepEqual(evaluatePromoCaps(NOW, [ago(23 * HOUR)], 'returning_free'), {
    allowed: false,
    reason: 'cap_24h',
  });
});

test('the 24h window is half-open: one millisecond inside refuses, exactly 24h allows', () => {
  assert.equal(evaluatePromoCaps(NOW, [ago(DAY - 1)], 'returning_free').allowed, false);
  // Aged exactly 24h, the row has LEFT the rolling window.
  assert.deepEqual(evaluatePromoCaps(NOW, [ago(DAY)], 'returning_free'), {
    allowed: true,
    reason: 'ok',
  });
});

// ── The 7-day cap, at its exact edges ───────────────────────────────────────

test('three general promos inside 7d refuse a fourth with cap_7d', () => {
  const three = [ago(2 * DAY), ago(4 * DAY), ago(6 * DAY)];
  assert.deepEqual(evaluatePromoCaps(NOW, three, 'returning_free'), {
    allowed: false,
    reason: 'cap_7d',
  });
});

test('two inside 7d allow a third — the cap is a maximum of three, not of two', () => {
  const two = [ago(2 * DAY), ago(6 * DAY)];
  assert.deepEqual(evaluatePromoCaps(NOW, two, 'returning_free'), {
    allowed: true,
    reason: 'ok',
  });
});

test('the 7d window is half-open too: a row aged exactly 7d has left it', () => {
  // Two recent (but outside 24h) plus one at exactly the 7-day edge: the edge
  // row no longer counts, so only two remain in the window and the ask passes.
  const edge = [ago(2 * DAY), ago(4 * DAY), ago(7 * DAY)];
  assert.deepEqual(evaluatePromoCaps(NOW, edge, 'returning_free'), {
    allowed: true,
    reason: 'ok',
  });
  // One millisecond younger and it still counts — three in window, refused.
  const inside = [ago(2 * DAY), ago(4 * DAY), ago(7 * DAY - 1)];
  assert.deepEqual(evaluatePromoCaps(NOW, inside, 'returning_free'), {
    allowed: false,
    reason: 'cap_7d',
  });
});

test('cap_24h outranks cap_7d when both apply', () => {
  const both = [ago(1 * HOUR), ago(2 * DAY), ago(3 * DAY)];
  assert.deepEqual(evaluatePromoCaps(NOW, both, 'returning_free'), {
    allowed: false,
    reason: 'cap_24h',
  });
});

// ── The ten→reveal pair rule ────────────────────────────────────────────────

test('reveal_complete is refused right after ten_completed, with its own reason', () => {
  // The overlap with cap_24h is real — one ask per day would catch this pair
  // too — but the reasons must stay distinct: "you already asked today" and
  // "you were about to bracket one Reveal with two asks" are different
  // product bugs, and the analytics have to be able to tell them apart.
  assert.deepEqual(evaluatePromoCaps(NOW, [ago(1 * HOUR, 'ten_completed')], 'reveal_complete'), {
    allowed: false,
    reason: 'consecutive_ten_reveal',
  });
});

test('the pair rule needs ten_completed to be the MOST RECENT general promo', () => {
  // A trial_expired after the ten breaks the adjacency; what remains is the
  // ordinary 24h cap.
  const history = [ago(20 * HOUR, 'ten_completed'), ago(2 * HOUR, 'trial_expired')];
  assert.deepEqual(evaluatePromoCaps(NOW, history, 'reveal_complete'), {
    allowed: false,
    reason: 'cap_24h',
  });
});

test('the pair rule expires with the 24h window', () => {
  assert.deepEqual(evaluatePromoCaps(NOW, [ago(DAY, 'ten_completed')], 'reveal_complete'), {
    allowed: true,
    reason: 'ok',
  });
});

test('the pair rule binds reveal_complete alone — other promos after ten_completed hit the plain cap', () => {
  assert.deepEqual(evaluatePromoCaps(NOW, [ago(1 * HOUR, 'ten_completed')], 'returning_free'), {
    allowed: false,
    reason: 'cap_24h',
  });
});

// ── Hostile rows ────────────────────────────────────────────────────────────

test('unparseable and future timestamps are ignored rather than wedging the caps', () => {
  const junk: PromoImpression[] = [
    { placement: 'trial_expired', shownAtIso: 'not-a-date' },
    { placement: 'trial_expired', shownAtIso: new Date(new Date(NOW).getTime() + DAY).toISOString() },
  ];
  assert.deepEqual(evaluatePromoCaps(NOW, junk, 'returning_free'), {
    allowed: true,
    reason: 'ok',
  });
});

// ── Source contracts: the wiring the pure core cannot prove ─────────────────

const src = (path: string) => readFileSync(`src/${path}`, 'utf8');

test('A19 — the ledger row is written where paywall_presented fires, for every placement', () => {
  // The seam moved (2026-09-05). `presentPromo` used to write the row off the
  // resolved outcome, which reached only the general promos; the contextual
  // gates never pass through it, so `paywall_impressions` was blind to every
  // tap-driven ask. Now use-gate's `onPresent` — Superwall's own "a sheet is
  // on screen" — writes the row beside the event, and nothing else does.
  const gate = src('features/billing/use-gate.ts');
  const promo = src('features/billing/present-promo.ts');
  assert.equal((promo.match(/recordImpression\(/g) ?? []).length, 0, 'presentPromo must not write the ledger');
  assert.doesNotMatch(promo, /import \{[^}]*recordImpression/);
  const calls = gate.match(/recordImpression\(/g) ?? [];
  assert.equal(calls.length, 1, 'exactly one call site — a second could double-spend the caps');
  // Beside the event, inside onPresent, on the same placement.
  const onPresent = gate.indexOf('onPresent:');
  const onDismiss = gate.indexOf('onDismiss:');
  const emit = gate.indexOf("track('paywall_presented'");
  const record = gate.indexOf('recordImpression(target.placement)');
  assert.ok(onPresent !== -1 && onDismiss !== -1 && emit !== -1 && record !== -1);
  assert.ok(emit > onPresent && record > emit && record < onDismiss, 'the row is written right after the event, inside onPresent');
  // A gate that is not the owner records nothing — `owned` guards the handler.
  assert.match(gate.slice(onPresent, onDismiss), /const target = owned\(ownerId\);\s*if \(!target\) return;/);
});

test('the caps ignore the contextual rows the wider seam now lands', () => {
  // Every tap-driven placement is outside GENERAL_PROMO_PLACEMENTS, so its
  // rows change no verdict — that is what makes A19 safe for the promos.
  const rows = [
    { placement: 'add_garment_over_limit', shownAtIso: '2026-09-05T10:00:00Z' },
    { placement: 'open_stylist', shownAtIso: '2026-09-05T11:00:00Z' },
    { placement: 'packing_access', shownAtIso: '2026-09-05T12:00:00Z' },
  ];
  assert.deepEqual(evaluatePromoCaps('2026-09-05T13:00:00Z', rows, 'returning_free'), {
    allowed: true,
    reason: 'ok',
  });
});

test('paywall_eligible is the denominator: fired before the eligibility branch returns', () => {
  const promo = src('features/billing/present-promo.ts');
  const eligibleEmit = promo.indexOf("'paywall_eligible'");
  const bail = promo.indexOf("return 'ineligible'");
  // `await gate.present(` — the call expression, not the docstring's mention
  // of the method name.
  const present = promo.indexOf('await gate.present(');
  assert.ok(eligibleEmit !== -1 && bail !== -1 && present !== -1);
  assert.ok(
    eligibleEmit < bail && eligibleEmit < present,
    'the denominator fires whether or not presentation proceeds',
  );
});

test("paywall_dismissed fires from the gate on the SDK's own decline, never off the settled outcome", () => {
  // 2026-09-13: the promo-path emit had fired zero times in 30 days against
  // 58 presentations — a non-gated paywall resolves `registerPlacement` on
  // close, so 'granted' always won the grace race and no promo ever settled
  // 'declined'. The event lives at the sheet now, for every placement.
  const promo = src('features/billing/present-promo.ts');
  assert.doesNotMatch(promo, /'paywall_dismissed'/, 'the dead emit is gone');
  const gate = src('features/billing/use-gate.ts');
  const emits = gate.match(/track\('paywall_dismissed'/g) ?? [];
  assert.equal(emits.length, 1);
  const onDismiss = gate.indexOf('onDismiss: (_info, result)');
  const emit = gate.indexOf("track('paywall_dismissed'");
  assert.ok(onDismiss !== -1 && emit > onDismiss, 'emitted inside onDismiss');
  assert.match(gate, /if \(result\.type === 'declined'\) \{[\s\S]{0,1200}?track\('paywall_dismissed'/);
  assert.match(gate, /seconds_open/);
  assert.match(gate, /target\.presentedAt = Date\.now\(\)/);
});

test('presentPromo cannot throw — the Reveal path is not blockable', () => {
  const promo = src('features/billing/present-promo.ts');
  assert.match(promo, /try \{/, 'the whole flow is wrapped');
  assert.match(promo, /return 'unavailable';\s*\}\s*$/m, 'every failure collapses to a quiet outcome');
  assert.doesNotMatch(promo, /\bthrow\b/, 'nothing in this module may throw at a caller');
});

test('an unreadable ledger declines to ask rather than treating history as empty', () => {
  const promo = src('features/billing/present-promo.ts');
  assert.match(promo, /'caps_unknown'/);
  const io = src('features/billing/promo-caps-io.ts');
  assert.match(io, /if \(error\) throw error;/, 'fetch must surface the failure, not fabricate []');
});

test('recordImpression swallows its own failures — the ledger is best-effort by contract', () => {
  const io = src('features/billing/promo-caps-io.ts');
  assert.match(io, /recordImpression[\s\S]*?\.catch\(\(\) => \{/, 'a failed insert must not reach the caller');
});

test('the promo placements exist in placements.ts under their contracted names', () => {
  const placements = src('features/billing/placements.ts');
  assert.match(placements, /TenCompleted: 'ten_completed'/);
  assert.match(placements, /ReturningFree: 'returning_free'/);
});

test('the caps read is raced against a clock — a hung network cannot strand the Reveal', () => {
  const promo = src('features/billing/present-promo.ts');
  // The failure this pins is a HANG, not an error: promo-caps-io's fetch has
  // no timeout of its own, and an unresolved promise here would strand the
  // `finally` that routes The Ten to the Reveal.
  assert.match(
    promo,
    /await withTimeout\(fetchRecentImpressions\(\), CAPS_READ_TIMEOUT_MS\)/,
    'the ledger read must be bounded before it is awaited',
  );
  assert.match(promo, /const CAPS_READ_TIMEOUT_MS = \d+;/, 'the bound is a named constant');
  assert.match(
    promo,
    /clearTimeout\(timer\)/,
    'the timer is cleared on both settle paths, so no handle outlives the race',
  );
});
