/**
 * THE MASTHEAD'S CONTEXT LABEL — Wave 3, audit item 57.
 *
 * "The temperature appears exactly once per screen, or not at all when it is
 * unknown. No two elements state the same weather fact."
 *
 * Before this the same fact was printed twice: the weather strip under the
 * masthead said "Feels 72° · mild · Denver", and every plate repeated it as a
 * colophon. The atlas's correction is not to relabel one of them — the two were
 * the same fact — but to state it once, in the label the date and place already
 * occupy, and remove the plate's eyebrow entirely.
 *
 * Two rules live here, and both are refusals:
 *
 *   * A temperature that is not known is OMITTED, never estimated and never
 *     dashed. Offline (T-09) the label is "Thu 7 Aug · Denver" and the notice
 *     beneath it says the weather is the part that may be wrong. A stale
 *     reading shown as a current one is the failure this prevents.
 *   * The clause is derived, never composed by hand at a call site, so the
 *     screen cannot drift from the plate or from `describeWeather`.
 *
 * Primitives in, string out: no React, no `expo-*`, no `WeatherContext`. The
 * unit test bundler cannot follow React Native's Flow source, and this is the
 * part of the masthead that is worth testing.
 */

/**
 * "Feels 72°F, mild" — or null when there is no reading.
 *
 * `temp` is `formatTemp`'s own output ("72°"), so the degree sign and the
 * rounding are the weather module's, not a second copy of them here. `units`
 * is appended because `formatTemp` deliberately does not print it and the
 * atlas's label does.
 *
 * `condition` is `describeWeather`'s phrase. The forecast this app reads
 * (Open-Meteo, `features/context/weather.ts`) returns no condition code, so
 * "clear" / "snow" as drawn in the atlas are not facts the app holds; what it
 * does hold is precipitation chance, wind and swing, which is what
 * `describeWeather` states. An absent phrase drops the clause rather than
 * inventing one.
 *
 * On a swing day `describeWeather`'s phrase carries the low–high range
 * ("64°–83° today"), and THIS clause is the only place on the screen that
 * range may appear (packet T): the plate's mark is the temperature alone plus
 * a condition symbol, and `resolveWeather` refuses the phrase by construction.
 */
export function feelsClause(
  temp: string | null | undefined,
  units: 'C' | 'F',
  condition?: string | null,
): string | null {
  if (!temp) return null;
  const head = `Feels ${temp}${units}`;
  return condition ? `${head}, ${condition}` : head;
}

/**
 * The whole label: "Thu 7 Aug · Denver · Feels 72°F, mild".
 *
 * `place` is `dayLine()`'s "Thu 7 Aug · Denver". A null weather clause leaves
 * the place standing on its own — which is exactly T-09, and exactly what the
 * refusal asks for.
 */
export function contextLabel(place: string, weather: string | null): string {
  return weather ? `${place} · ${weather}` : place;
}

/**
 * The same content at the largest supported type, where the atlas breaks it
 * over two lines rather than truncating (T-01/AX, T-09/AX, T-12/AX). Nothing
 * is dropped and nothing is ellipsised; only the arrangement changes.
 */
export function contextLines(place: string, weather: string | null): string[] {
  return weather ? [place, weather] : [place];
}

/**
 * THE LADDER — how the context line gets shorter rather than wrapping.
 *
 * TM-01/TM-02 moved the masthead's four control chips onto this row, which is
 * what gave the greeting the full gutter beneath them. It also took about
 * 170 pt off this line's measure, and at 402 pt the full label
 * ("FRI 7 AUG · DENVER · FEELS 72°F, CLEAR") wrapped to two lines beside the
 * controls. Two lines of tracked uppercase under a serif greeting is not the
 * masthead the atlas draws.
 *
 * The fix is the one TM-02 already names: "Context row gains the conditions
 * word back at this width; it is dropped first at 393 pt, never truncated
 * mid-word." So the row sheds content in a fixed order, and never sheds the
 * two facts the label exists for.
 *
 *   0. Fri 7 Aug · Denver · Feels 72°F, clear   — everything
 *   1. Fri 7 Aug · Denver · Feels 72°F          — the conditions word goes
 *   2. Fri 7 Aug · Feels 72°F                   — the place goes
 *
 * THE DATE AND THE TEMPERATURE NEVER GO. The temperature is stated exactly once
 * per screen (audit 57) and this is that once — dropping it here would take the
 * fact off the screen entirely rather than shorten a line. The place is the
 * thing a reader can work out from the window.
 *
 * Truncation is never a rung. An ellipsised "FEELS 72°F, CLE…" is a line that
 * looks broken, and the whole point of shedding a clause is that what remains
 * reads as a finished sentence.
 */
export function contextRungs(place: string, weather: string | null): string[] {
  if (!weather) return [place];

  // "Feels 72°F, clear" → "Feels 72°F". The comma is `feelsClause`'s own join,
  // so this is reading a separator that file writes rather than parsing prose.
  const bare = weather.split(',')[0];
  // "Fri 7 Aug · Denver" → "Fri 7 Aug". `dayLine` writes that separator.
  const day = place.split(' · ')[0];

  const rungs = [
    contextLabel(place, weather),
    contextLabel(place, bare),
    contextLabel(day, bare),
  ];
  // A label with no condition and no city produces duplicate rungs; collapsing
  // them keeps the step-down below from spending a frame going nowhere.
  return rungs.filter((rung, i) => rungs.indexOf(rung) === i);
}
