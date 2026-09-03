import { formatTemp } from '@/features/context/weather';
import type { WeatherContext } from '@/lib/styling';

/**
 * PL-01 and PL-03's masthead lines.
 *
 * A `.ts`, not a `.tsx`, for the reason `packing-math.ts` gives: the test
 * bundler cannot parse React Native's Flow source, so anything worth holding
 * must not reach a component file. Every sentence here is composed from facts
 * the screen already has — a date range, a forecast, a count of committed days
 * — and NONE of them is estimated. Where the fact is missing the fragment is
 * dropped rather than filled.
 */

const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
];

const word = (n: number): string => WORDS[n] ?? String(n);
const cap = (s: string): string => (s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * "7–13 August" — the week, said once.
 *
 * Locale-formatted rather than built from a month table, and the month is said
 * once when it does not change, twice when it does.
 */
export function weekRangeLine(start: Date, days: number): string {
  const end = new Date(start);
  end.setDate(start.getDate() + days - 1);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'long' });

  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${month(start)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
}

/**
 * "68–84°" — the week's real spread, or null.
 *
 * Read off the forecast the screen already has, low of the lows to high of the
 * highs. Null for an empty forecast: a range invented from one day, or from
 * seasonal normals with nothing saying so, is exactly the estimated figure the
 * refusals forbid.
 */
export function weekTempRange(
  forecasts: readonly WeatherContext[],
  units: 'C' | 'F' = 'F',
): string | null {
  if (forecasts.length === 0) return null;
  const low = Math.min(...forecasts.map((f) => f.lowC));
  const high = Math.max(...forecasts.map((f) => f.highC));
  return `${formatTemp(low, units).replace('°', '')}–${formatTemp(high, units)}`;
}

/**
 * ── AUDIT 2026-09-02 · 15 · ONE FORECAST GRAMMAR FOR EVERY WEEK ROW ─────────
 *
 * "Repeated weather microcopy ('today,' 'mild') is inconsistent across future
 * rows. Normalize forecast phrasing."
 *
 * The week's seven rows were composed as `formatTemp(feelsLikeC)` joined to
 * `describeWeather()`, which produced four different shapes on adjacent days:
 *
 *   Thu 7   72° · 60% rain          a quantity
 *   Fri 8   72° · windy             an adjective
 *   Sat 9   72° · 64°–83° today     a SECOND temperature, and a false "today"
 *   Sun 10  72° · mild              an adjective that restates the 72°
 *
 * Two defects, and the third row holds both. `describeWeather` takes no date,
 * so its swing clause appends the literal word "today" to every day in the
 * week — printed, in production, on the row labelled `Sat 9`. And it states the
 * day's low–high beside a feels-like the row has already printed, so the reader
 * is given two temperatures for one day and no rule for telling them apart.
 *
 * `describeWeather` itself is NOT changed: it is Today's strip, the masthead
 * eyebrow, the diary and the packing memo as well, and on Today the word
 * "today" is true and pinned (`tests/context-label.test.ts`). This is the Plan
 * row's own composition, and it lives here — beside the other week lines, in a
 * `.ts` a test can execute — rather than inside `day-row.tsx`, where nothing
 * could reach it.
 *
 * THE GRAMMAR, one shape for all seven rows:
 *
 *   <temperature> · [quantified conditions] · <adjective>
 *
 *   * The temperature is a RANGE on a day that swings and a point on a day that
 *     does not, so the range replaces the feels-like instead of arguing with
 *     it. Both come off the same reading `describeWeather` uses.
 *   * The quantified conditions are the same two facts and the same thresholds
 *     (`>= 0.4` rain, `>= 25` wind) — a row must not disagree with Today about
 *     whether it is going to rain.
 *   * The adjective always closes the line, so no row ends on a number and no
 *     row is the only one without a word.
 *   * NO TIME WORD, on any row. The row is already labelled with its own day.
 */
export function dayForecastLine(weather: WeatherContext, units: 'C' | 'F' = 'F'): string {
  const parts: string[] = [
    weather.swing
      ? `${formatTemp(weather.lowC, units).replace('°', '')}–${formatTemp(weather.highC, units)}`
      : formatTemp(weather.feelsLikeC, units),
  ];

  if (weather.precipitationChance >= 0.4) {
    parts.push(`${Math.round(weather.precipitationChance * 100)}% rain`);
  }
  if (weather.windKph >= 25) parts.push('windy');

  // The closing adjective, on the same three thresholds `describeWeather` uses
  // for its own fallback. Read off the feels-like even on a swing day: it is
  // what the day is like NOW, which is what an adjective is for.
  parts.push(weather.feelsLikeC >= 24 ? 'warm' : weather.feelsLikeC <= 8 ? 'cold' : 'mild');

  return parts.join(' · ');
}

/**
 * The masthead's second line — the range, and the temperatures when known.
 *
 * The atlas also prints a city ("7–13 August · Denver · 68–84°F"). It is NOT
 * drawn here: the week's forecast is fetched from coordinates
 * (`useStyleContext` resolves a latitude and a longitude, and the privacy
 * manifest's Coarse Location claim is about exactly those two numbers), and
 * nothing in the app reverse-geocodes them to a place name. Printing "Denver"
 * would be either a name nobody looked up or a new network call to a service
 * this screen does not use. The fragment is absent, and the dependency is a
 * reverse-geocode the app does not perform.
 */
export function weekSubtitle(
  start: Date,
  days: number,
  forecasts: readonly WeatherContext[],
  units: 'C' | 'F' = 'F',
): string {
  const temps = weekTempRange(forecasts, units);
  return [weekRangeLine(start, days), temps].filter(Boolean).join(' · ');
}

/**
 * "Three days planned, four to go." — PL-03's masthead when the week is part
 * done.
 *
 * A COUNT, never a bar and never a percentage. Both halves are counted from
 * the calendar rows in hand: what is committed, and what is left of the days
 * the screen is showing. Null when nothing is committed yet — a week with no
 * plans in it does not need to be told it has none, and zero is quiet.
 */
export function weekProgressLine(plannedDays: number, totalDays: number): string | null {
  if (plannedDays <= 0) return null;
  const left = Math.max(0, totalDays - plannedDays);
  const planned = `${cap(word(plannedDays))} ${plannedDays === 1 ? 'day' : 'days'} planned`;
  if (left === 0) return `${planned}. The week is done.`;
  return `${planned}, ${word(left)} to go.`;
}
