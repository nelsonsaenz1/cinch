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
import { test } from 'node:test';

import type { WeatherContext } from '../src/lib/styling/types';
import {
  weekProgressLine,
  weekRangeLine,
  weekSubtitle,
  weekTempRange,
} from '../src/features/plan/week-lines';

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
