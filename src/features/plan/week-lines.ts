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
