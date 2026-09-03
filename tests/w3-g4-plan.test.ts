/**
 * Wave 3 · Group 4 — the plan week's masthead lines.
 *
 * Atlas frames PL-01, PL-02, PL-03 (audit 79, 80).
 *
 * `day-row.tsx` is a `.tsx` and therefore unreachable from the test bundler —
 * esbuild cannot parse React Native's Flow source — so the arithmetic that
 * matters was put in `features/plan/week-lines.ts` where it can be held. What
 * is held: a temperature range that is never invented, and a progress line that
 * is a count rather than a bar.
 */

import assert from 'node:assert/strict';
import { dayForecastLine } from '../src/features/plan/week-lines.ts';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { WeatherContext } from '../src/lib/styling/types';
import {
  weekProgressLine,
  weekRangeLine,
  weekSubtitle,
  weekTempRange,
} from '../src/features/plan/week-lines';

const PLAN_SCREEN = readFileSync('src/app/(tabs)/plan.tsx', 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

test('the week promises minimised repeats, never a hard cap', () => {
  // RESTORED 2026-08-18 with the week page itself.
  //
  // The promise survived a change of REGISTER, not of meaning. The empty
  // week's 44-word paragraph became a colophon — "Seven days · The forecast ·
  // Fewest repeats" — and the planned week still carries "Repeats kept to a
  // minimum" as its oxblood eyebrow. BOTH surfaces are asserted: an
  // alternation here would let either one vanish behind the other.
  //
  // Redesign 01 replaced the seven day-cards with a single plate, where the
  // eyebrow had nothing to be true of, so this file was rewritten to forbid
  // the line instead of requiring it. The founder reverted that page: the
  // seven cards are back, the eyebrow is back over them, and so is the
  // assertion that it is there.
  assert.match(PLAN_SCREEN, /Fewest repeats/);
  assert.match(PLAN_SCREEN, /Repeats kept to a minimum/);
  assert.doesNotMatch(PLAN_SCREEN, /no piece worn more than twice/i);

  // The REFUSAL redesign 01 added is kept, because it is right on either page
  // and this is the half a later edit could actually get wrong: no surface in
  // the slice may promise a COUNT of outfits, which is the week engine's
  // standing contract. The reverted body and spec are gone, so the route —
  // which draws the week again — is the whole slice.
  assert.doesNotMatch(PLAN_SCREEN, /\b\d+ (outfits|looks) (for|this)\b/i, 'a count was promised');
});

const w = (lowC: number, highC: number): WeatherContext => ({
  feelsLikeC: (lowC + highC) / 2,
  highC,
  lowC,
  precipitationChance: 0,
  windKph: 8,
  swing: false,
});

test('the week says its month once, and twice when it changes', () => {
  // 6–12 August, all one month.
  assert.equal(weekRangeLine(new Date(2026, 7, 6), 7), '6–12 August');
  // 29 August – 4 September crosses, so both months are said.
  assert.equal(weekRangeLine(new Date(2026, 7, 29), 7), '29 August – 4 September');
});

test('the temperature range is the forecast’s real spread, or nothing at all', () => {
  // Low of the lows to high of the highs, across every day in hand.
  assert.equal(weekTempRange([w(14, 26), w(19, 29), w(12, 22)]), '54–84°');

  // No forecast reached the week. A range invented from one day, or from
  // seasonal normals with nothing saying so, is the estimated figure the
  // refusals forbid — so the fragment is absent.
  assert.equal(weekTempRange([]), null);
});

test('the subtitle drops the temperature fragment rather than filling it', () => {
  const start = new Date(2026, 7, 6);
  assert.equal(weekSubtitle(start, 7, [w(14, 26)]), '6–12 August · 57–79°');
  assert.equal(weekSubtitle(start, 7, []), '6–12 August');
});

test('progress is a count, and zero is quiet', () => {
  assert.equal(weekProgressLine(3, 7), 'Three days planned, four to go.');
  assert.equal(weekProgressLine(1, 7), 'One day planned, six to go.');
  assert.equal(weekProgressLine(7, 7), 'Seven days planned. The week is done.');

  // Nothing committed yet: a week with no plans does not need to be told it
  // has none.
  assert.equal(weekProgressLine(0, 7), null);

  // More rows kept than the screen is showing cannot produce a negative
  // remainder — it produces the done sentence. Past the spelling table the
  // digits take over rather than the word list being extended for a case a
  // seven-day week cannot reach.
  assert.equal(weekProgressLine(8, 7), '8 days planned. The week is done.');
});

// ---------------------------------------------------------------------------
// One forecast grammar for every week row — audit 2026-09-02 · 15
// ---------------------------------------------------------------------------

/** A day's forecast, with only the fields the phrasing reads. */
const day = (over: Partial<Parameters<typeof dayForecastLine>[0]> = {}) =>
  ({
    feelsLikeC: 16,
    highC: 18,
    lowC: 14,
    precipitationChance: 0,
    windKph: 0,
    swing: false,
    ...over,
  }) as Parameters<typeof dayForecastLine>[0];

test('no week row says “today”, because six of the seven are not', () => {
  // The defect this replaced: `describeWeather` takes no date, so its swing
  // clause appended the literal word "today" to every day in the week — printed,
  // in production, on the row labelled `Sat 9`.
  const rows = [
    dayForecastLine(day()),
    dayForecastLine(day({ swing: true, lowC: 12, highC: 28 })),
    dayForecastLine(day({ precipitationChance: 0.6 })),
    dayForecastLine(day({ windKph: 30 })),
  ];
  for (const row of rows) assert.doesNotMatch(row, /today|tomorrow|tonight|now\b/i, row);
});

test('a swing day states a RANGE instead of a second temperature', () => {
  // The row already prints one temperature. `72° · 64°–83° today` gave the
  // reader two and no rule for telling them apart.
  assert.equal(dayForecastLine(day({ swing: true, lowC: 12, highC: 28 })), '54–82° · mild');
  // A day that does not swing keeps its point reading.
  assert.equal(dayForecastLine(day({ feelsLikeC: 16 })), '61° · mild');
});

test('every row ends on an adjective, and the quantified facts sit between', () => {
  // The old fallback produced a bare "mild" on some rows and nothing on others,
  // so one row in seven was the only one without a word. Now the shape is
  // always <temperature> · [quantities] · <adjective>.
  assert.equal(dayForecastLine(day({ feelsLikeC: 26, precipitationChance: 0.6 })), '79° · 60% rain · warm');
  assert.equal(dayForecastLine(day({ feelsLikeC: 2, windKph: 30 })), '36° · windy · cold');
  for (const row of [
    dayForecastLine(day()),
    dayForecastLine(day({ swing: true, lowC: 12, highC: 28 })),
    dayForecastLine(day({ precipitationChance: 0.6 })),
  ]) {
    assert.match(row, /(warm|cold|mild)$/, row);
  }
});

test('the thresholds are the ones Today already uses', () => {
  // A Plan row must not disagree with Today's strip about whether it is going
  // to rain: `describeWeather` uses 0.4 and 25, and so does this.
  assert.doesNotMatch(dayForecastLine(day({ precipitationChance: 0.39 })), /rain/);
  assert.match(dayForecastLine(day({ precipitationChance: 0.4 })), /40% rain/);
  assert.doesNotMatch(dayForecastLine(day({ windKph: 24 })), /windy/);
  assert.match(dayForecastLine(day({ windKph: 25 })), /windy/);
});
