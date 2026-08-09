import type { WeatherContext, Garment } from '@/lib/styling';
import { describeWeather, formatTemp } from '@/features/context/weather';

import type { PackedLook, PackedPiece, PackingResult } from './packing';
import { isTravelDay } from './packing-math';
import { dayPartOf, type DayPartKey, type IsoDate } from './trip';

/**
 * Pure display logic for K-04 (research), K-05 (the memo) and K-06's second
 * failure (the honest shortfall).
 *
 * KEPT OUT OF `packing-trip.tsx` FOR THE SAME REASON `packing-math.ts` IS ITS
 * OWN FILE: none of this needs React, and every sentence the memo prints is a
 * fact composed from real data, never a template with a blank filled by a
 * guess. A `.ts`, not a `.tsx` — the test bundler cannot parse React Native's
 * Flow source, so anything worth testing here must not reach a component file.
 */

// ---------------------------------------------------------------------------
// Number words — the memo's own voice, matching packing-math.ts's choice to
// spell out small counts ("Two day parts…"). Not imported from there: that
// list is deliberately private to one sentence, and this is a different one.
// ---------------------------------------------------------------------------

const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
];

const word = (n: number): string => WORDS[n] ?? String(n);
const cap = (s: string): string => (s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------------------
// The bag
// ---------------------------------------------------------------------------

/** "Linen blouse" — capitalised subcategory, falling back to the category. */
export function garmentLabel(g: Garment): string {
  const s = g.subcategory ?? g.category;
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * "11 pieces · $2.40 per wear", or just "11 pieces".
 *
 * §2.5 of the contract: the fragment appears ONLY when every packed piece
 * carries a `purchasePrice`, and the figure is real arithmetic over the pieces
 * actually packed — total spend on this bag over total wears these exact
 * pieces have — never an estimate and never per-piece-averaged-then-summed.
 */
export function bagHeaderLine(items: readonly PackedPiece[]): string {
  const n = items.length;
  const base = `${n} ${n === 1 ? 'piece' : 'pieces'}`;
  if (!n) return base;

  const allPriced = items.every((p) => p.garment.purchasePrice !== null);
  if (!allPriced) return base;

  const totalPrice = items.reduce((s, p) => s + (p.garment.purchasePrice ?? 0), 0);
  const totalWears = items.reduce((s, p) => s + p.garment.wearCount, 0);
  if (totalWears === 0) return base;

  return `${base} · $${(totalPrice / totalWears).toFixed(2)} per wear`;
}

// ---------------------------------------------------------------------------
// The headline — "Eleven pieces, eight looks, one bag."
// ---------------------------------------------------------------------------

export function memoHeadline(pieceCount: number, lookCount: number): string {
  const pieces = `${cap(word(pieceCount))} ${pieceCount === 1 ? 'piece' : 'pieces'}`;
  const looks = `${word(lookCount)} ${lookCount === 1 ? 'look' : 'looks'}`;
  return `${pieces}, ${looks}, one bag.`;
}

// ---------------------------------------------------------------------------
// K-04 — the research lines
// ---------------------------------------------------------------------------

/** "19–27°C, one wet day." — the real range, and how many days need a coat for rain. */
export function forecastSummaryLine(forecasts: readonly WeatherContext[]): string {
  const lowC = Math.round(Math.min(...forecasts.map((f) => f.lowC)));
  const highC = Math.round(Math.max(...forecasts.map((f) => f.highC)));
  const wet = forecasts.filter((f) => f.precipitationChance >= 0.4).length;
  const wetPhrase = wet === 0 ? 'no wet days' : wet === 1 ? 'one wet day' : `${word(wet)} wet days`;
  return `${lowC}–${highC}°C, ${wetPhrase}.`;
}

/**
 * "No real forecast yet — this is what Lisbon is normally like in September:
 * 18–27°C." Stated as normals, never presented as a forecast — the K-06
 * failure-1 rule extended to the research line that leads into it.
 */
export function normalsSummaryLine(
  placeName: string,
  monthName: string,
  lowC: number,
  highC: number,
): string {
  return `No real forecast yet — this is what ${placeName} is normally like in ${monthName}: ${Math.round(lowC)}–${Math.round(highC)}°C.`;
}

const warmthForTemp = (c: number): number => {
  if (c <= 5) return 5;
  if (c <= 12) return 4;
  if (c <= 18) return 3;
  if (c <= 24) return 2;
  return 1;
};

/**
 * How much of the closet is even in the running for this weather.
 *
 * A heuristic, not the packing engine's own scorer — it exists only to print
 * a real number on K-04's "Closet read" line ("148 pieces, 61 of them right
 * for this weather"), and it is computed from the actual wardrobe and the
 * actual forecast, never invented.
 */
export function closetWeatherFit(
  wardrobe: readonly Garment[],
  forecasts: readonly WeatherContext[],
): { total: number; suitable: number } {
  if (!forecasts.length) return { total: wardrobe.length, suitable: 0 };

  const lowC = Math.min(...forecasts.map((f) => f.lowC));
  const highC = Math.max(...forecasts.map((f) => f.highC));
  const minWarmth = warmthForTemp(highC);
  const maxWarmth = warmthForTemp(lowC);

  const suitable = wardrobe.filter(
    (g) => g.warmth >= minWarmth - 1 && g.warmth <= maxWarmth + 1,
  ).length;

  return { total: wardrobe.length, suitable };
}

export function closetSummaryLine(fit: { total: number; suitable: number }): string {
  return `${fit.total} ${fit.total === 1 ? 'piece' : 'pieces'}, ${fit.suitable} of them right for this weather.`;
}

export function buildingLooksTitle(lookCount: number): string {
  return `Building ${word(lookCount)} ${lookCount === 1 ? 'look' : 'looks'}`;
}

export function buildingLooksDetail(items: readonly PackedPiece[]): string {
  const n = items.length;
  return `${n} ${n === 1 ? 'piece carries' : 'pieces carry'} every look, repeats counted so the bag stays small.`;
}

// ---------------------------------------------------------------------------
// K-05 — day by day
// ---------------------------------------------------------------------------

export type DayGroup = { dayIndex: number; date: IsoDate; looks: PackedLook[] };

/** Group the schedule's flat look list back into days, in the order it was built. */
export function groupLooksByDay(looks: readonly PackedLook[]): DayGroup[] {
  const byDay = new Map<number, DayGroup>();
  for (const look of looks) {
    let entry = byDay.get(look.dayIndex);
    if (!entry) {
      entry = { dayIndex: look.dayIndex, date: look.date, looks: [] };
      byDay.set(look.dayIndex, entry);
    }
    entry.looks.push(look);
  }
  return [...byDay.values()].sort((a, b) => a.dayIndex - b.dayIndex);
}

/** "Linen blouse, cord skirt, loafers" — a look's pieces, body order as generated. */
export function lookGarmentNames(look: PackedLook): string {
  if (!look.outfit) return '';
  return look.outfit.items.map(garmentLabel).join(', ');
}

/** "24°" — the day's representative feel, or null when no weather reached it. */
export function dayTempLabel(weather: WeatherContext | null): string | null {
  return weather ? formatTemp(weather.feelsLikeC, 'C') : null;
}

/**
 * "travel day" for the first and last day, whatever was tapped; the real
 * weather phrase otherwise. Never an invented activity ("walking", "rain
 * after 3") the app has no data for — `describeWeather` already exists for
 * exactly this and is reused rather than duplicated.
 */
export function dayCaption(
  dayIndex: number,
  days: number,
  weather: WeatherContext | null,
): string | null {
  if (isTravelDay(dayIndex, days)) return 'travel day';
  if (!weather) return null;
  return describeWeather(weather, 'C');
}

// ---------------------------------------------------------------------------
// K-06's second failure — the honest shortfall
// ---------------------------------------------------------------------------

/** The first look the closet couldn't fill, so the shortfall names a real gap. */
export function firstUnfilledPart(looks: readonly PackedLook[]): DayPartKey | null {
  return looks.find((l) => !l.outfit)?.part ?? null;
}

/**
 * "Six looks, not eight — you don't own anything that works for the gym."
 *
 * Computed from `PackingResult.unfilled`, never rounded to a nicer number —
 * the contract's own rule, restated here so the sentence can only ever be
 * built the honest way.
 */
export function shortfallSentence(
  requestedLooks: number,
  unfilled: number,
  missingPart: DayPartKey | null,
): string {
  const achieved = Math.max(0, requestedLooks - unfilled);
  const lead = `${cap(word(achieved))} ${achieved === 1 ? 'look' : 'looks'}, not ${word(requestedLooks)} —`;
  if (!missingPart) {
    return `${lead} your closet doesn't have enough pieces for every look this trip needs.`;
  }
  return `${lead} you don't own anything that works for ${dayPartOf(missingPart).phrase}.`;
}

// ---------------------------------------------------------------------------
// Persistence — the shape `use-trips.ts`'s `memo` jsonb column holds
// ---------------------------------------------------------------------------

/** One packed piece, by id — what survives a round trip through Postgres. */
export type SavedBagPiece = { itemId: string; looks: number; worn: boolean };

export type SavedMemoDay = {
  dayIndex: number;
  date: IsoDate;
  travelDay: boolean;
  tempC: number | null;
  rows: { part: DayPartKey; itemIds: string[] }[];
};

/**
 * The whole memo, serialisable. `headline` and `prose` are frozen at save
 * time — K-06's "Open last list" reopens exactly what was shown, not a
 * re-run, because the closet or the weather may have moved on since.
 */
export type SavedMemo = {
  headline: string;
  prose: string | null;
  weatherSource: 'forecast' | 'normals';
  bag: SavedBagPiece[];
  days: SavedMemoDay[];
};

export function buildSavedMemo({
  headline,
  prose,
  weatherSource,
  packing,
  tripDays,
}: {
  headline: string;
  prose: string | null;
  weatherSource: 'forecast' | 'normals';
  packing: PackingResult;
  /** The trip's own day count — NOT `groupLooksByDay(...).length`, which can
   *  undercount when every selected day part is `travel` and the middle days
   *  produce no look at all. */
  tripDays: number;
}): SavedMemo {
  const groups = groupLooksByDay(packing.looks);
  const days = groups.map((group) => ({
    dayIndex: group.dayIndex,
    date: group.date,
    travelDay: isTravelDay(group.dayIndex, tripDays),
    tempC: group.looks.find((l) => l.weather)?.weather?.feelsLikeC ?? null,
    rows: group.looks
      .filter((l) => l.outfit)
      .map((l) => ({ part: l.part, itemIds: l.outfit!.items.map((g) => g.id) })),
  }));

  return {
    headline,
    prose,
    weatherSource,
    bag: packing.items.map((p) => ({ itemId: p.garment.id, looks: p.looks, worn: p.worn })),
    days,
  };
}
