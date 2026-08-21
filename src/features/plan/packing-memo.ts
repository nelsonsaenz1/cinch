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

/**
 * "66–81°, one wet day." — the real range, and how many days need a coat.
 *
 * FAHRENHEIT, like every other temperature in this app, not the atlas's °C.
 * The atlas is a mock rendered in the designer's own units; the app shows
 * Today's weather, the week planner and the stylist in `'F'`, and a user who
 * reads 72° on Today and 22° on Packing is being shown two scales in one app.
 * Same precedent as every other atlas-versus-design-system conflict: the
 * running app wins. `formatTemp` already appends the degree sign.
 */
export function forecastSummaryLine(
  forecasts: readonly WeatherContext[],
  units: 'C' | 'F' = 'F',
): string {
  const lowC = Math.min(...forecasts.map((f) => f.lowC));
  const highC = Math.max(...forecasts.map((f) => f.highC));
  const wet = forecasts.filter((f) => f.precipitationChance >= 0.4).length;
  const wetPhrase = wet === 0 ? 'no wet days' : wet === 1 ? 'one wet day' : `${word(wet)} wet days`;
  return `${formatTemp(lowC, units).replace('°', '')}–${formatTemp(highC, units)}, ${wetPhrase}.`;
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
  units: 'C' | 'F' = 'F',
): string {
  const range = `${formatTemp(lowC, units).replace('°', '')}–${formatTemp(highC, units)}`;
  return `No real forecast yet — this is what ${placeName} is normally like in ${monthName}: ${range}.`;
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

/** "75°" — the day's representative feel, or null when no weather reached it. */
export function dayTempLabel(
  weather: WeatherContext | null,
  units: 'C' | 'F' = 'F',
): string | null {
  return weather ? formatTemp(weather.feelsLikeC, units) : null;
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
    return `${lead} your closet doesn’t have enough pieces for every look this trip needs.`;
  }
  return `${lead} you don’t own anything that works for ${dayPartOf(missingPart).phrase}.`;
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

// ---------------------------------------------------------------------------
// PK-03 — the bag as garments, not as a list
// ---------------------------------------------------------------------------

/** Which looks a piece is actually in, read off the schedule that produced it. */
export function pieceCoverage(
  looks: readonly PackedLook[],
  piece: PackedPiece,
): { parts: DayPartKey[]; count: number; worn: boolean } {
  const parts = looks
    .filter((l) => l.outfit?.items.some((g) => g.id === piece.garment.id))
    .map((l) => l.part);
  // `piece.looks` is the engine's own count and stays authoritative; the parts
  // are what the unit is derived from. They agree, and where they somehow do
  // not, the engine's number is the one that gets printed.
  return { parts, count: piece.looks, worn: piece.worn };
}

/**
 * "Plus the black jeans, the crossbody bag and the crochet poncho."
 *
 * PK-03's rule: the pieces that need no count are NAMED IN PROSE rather than
 * padding the grid with a chip that says "1". Null when every packed piece
 * repeats, so the memo does not print a sentence introducing nothing.
 */
export function bagProseLine(singles: readonly PackedPiece[]): string | null {
  if (singles.length === 0) return null;
  const names = singles.map((p) => garmentLabel(p.garment).toLowerCase());
  const list =
    names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(', ')} and the ${names[names.length - 1]}`;
  return names.length === 1 ? `Plus the ${list}.` : `Plus the ${list}.`;
}

// ---------------------------------------------------------------------------
// The memo itself — Workstream 3
// ---------------------------------------------------------------------------

/**
 * The memo, built from the bag rather than written about the place.
 *
 * ── What changed, and why it is not a downgrade ─────────────────────────────
 *
 * This used to be a model call. `packing-brief` was asked what a destination is
 * like in a given month — how warm, how dressed-up, what people there wear —
 * and it answered from its own memory of the place. Three things were wrong
 * with that, and only the third is about cost:
 *
 *   IT WAS THE ONLY PART OF PACKING THAT COULD BE WRONG. The forecast is real,
 *   the closet is real, the capsule is `buildPackingList`'s arithmetic. The
 *   prose on top was the one element with no source, and it was the element
 *   printed largest.
 *
 *   IT MADE A LOCAL FEATURE NEED A NETWORK, A CONSENT AND AN ALLOWANCE. A
 *   person packing on a plane got a failure card over a bag their phone had
 *   already computed. It spent the STYLIST's allowance, so a heavy month of
 *   chat could take the memo away from a trip.
 *
 *   AND IT INVENTED THE ONE THING NOBODY CAN CHECK. "Lisbon is smart-casual in
 *   September, and people there dress up for dinner" is unfalsifiable, arrived
 *   with the same confidence as the temperature, and this app has no source for
 *   it. The plan says to remove those claims rather than guess them, so there
 *   is no destination sentence here at all — not a hedged one.
 *
 * WHAT IS LEFT IS EVERYTHING THAT WAS EVER TRUE: the range the forecast gives,
 * the wet days it counts, the formality the tapped vibes ask for, the pieces
 * that actually got packed and how often each repeats, and the looks the closet
 * could not fill. Every sentence below is composed from a field, and a field
 * that is absent removes its sentence rather than softening it.
 *
 * PURE, AND BYTE-IDENTICAL FOR THE SAME INPUT. No clock, no randomness, no
 * locale lookup: the month name is taken from the trip and the temperatures go
 * through `formatTemp`, so the same trip and the same bag produce the same
 * string every time. `tests/packing-memo.test.ts` asserts that directly,
 * because "deterministic" is the property the whole workstream turns on.
 */
export type PackingMemo = {
  headline: string;
  spec: string[];
  observation: string;
  gaps: string | null;
  parts: { part: DayPartKey; note: string; itemIds: string[] }[];
};

export type MemoInput = {
  /** The tapped vibes, in `VIBES` order, with their formality. */
  vibes: readonly { label: string; formality: number }[];
  /** Day parts asked for, in order. */
  parts: readonly DayPartKey[];
  /** Nights away, as the questionnaire counted them. */
  days: number;
  /** The real forecast, or the seasonal normals standing in for it. */
  forecasts: readonly WeatherContext[] | undefined;
  /** Which of those two the numbers came from. Printed, never implied. */
  weatherSource: 'forecast' | 'normals';
  packing: PackingResult;
  /** How many looks were asked for, so a shortfall can be named honestly. */
  requestedLooks: number;
  units?: 'C' | 'F';
};

/** The dressiest tapped vibe — the same rule the capsule targets. */
function topVibe(
  vibes: readonly { label: string; formality: number }[],
): { label: string; formality: number } | null {
  if (!vibes.length) return null;
  return [...vibes].sort((a, b) => b.formality - a.formality)[0]!;
}

const FORMALITY_WORDS: Record<number, string> = {
  1: 'nothing you have to think about',
  2: 'relaxed',
  3: 'smart-casual',
  4: 'dressed',
  5: 'formal at least once',
};

/**
 * The spec line: `·`-separated fragments, each one a fact.
 *
 * Ordered coldest-fact-first — temperature, then what the days ask of you,
 * then the shape of the bag — because that is the order somebody reads a
 * caption under a photograph, and it is the order the field guide sets.
 */
function specFragments(input: MemoInput): string[] {
  const units = input.units ?? 'F';
  const out: string[] = [];

  if (input.forecasts?.length) {
    const lowC = Math.min(...input.forecasts.map((f) => f.lowC));
    const highC = Math.max(...input.forecasts.map((f) => f.highC));
    const range = `${formatTemp(lowC, units).replace('°', '')}–${formatTemp(highC, units)}`;
    // The source is part of the fact. Normals are not a forecast, and a memo
    // that prints them as one is the failure K-06 exists to prevent.
    out.push(input.weatherSource === 'forecast' ? range : `${range} typical`);

    const wet = input.forecasts.filter((f) => f.precipitationChance >= 0.4).length;
    if (wet > 0) out.push(wet === 1 ? 'one wet day' : `${word(wet)} wet days`);
  }

  const vibe = topVibe(input.vibes);
  if (vibe) out.push(FORMALITY_WORDS[vibe.formality] ?? vibe.label.toLowerCase());

  const pieces = input.packing.items.length;
  if (pieces > 0) out.push(`${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`);

  return out;
}

/**
 * The observation: one paragraph, and every clause of it countable.
 *
 * The old model wrote this in the stylist's voice about the destination. This
 * writes it about the bag, which is the thing the app actually knows.
 */
function observationSentence(input: MemoInput): string {
  const items = input.packing.items;
  const filled = input.packing.looks.filter((l) => l.outfit).length;
  const pieces = items.length;

  if (pieces === 0) {
    return 'Nothing is packed yet — there was not enough in your closet to build a look for this trip.';
  }

  const sentences: string[] = [];

  const nights = `${word(input.days)} ${input.days === 1 ? 'night' : 'nights'}`;
  sentences.push(
    `${cap(word(pieces))} ${pieces === 1 ? 'piece' : 'pieces'} covering ${word(filled)} ${
      filled === 1 ? 'look' : 'looks'
    } over ${nights}.`,
  );

  // The hardest-working piece, named, because that is the one decision in the
  // bag somebody might want to overrule.
  const hardest = [...items].sort((a, b) => b.looks - a.looks)[0];
  if (hardest && hardest.looks > 1) {
    sentences.push(
      `${garmentLabel(hardest.garment)} does the most work at ${word(hardest.looks)} of them.`,
    );
  }

  const worn = items.find((p) => p.worn);
  if (worn) {
    sentences.push(`${garmentLabel(worn.garment)} travels on you, so it is not in the bag.`);
  }

  return sentences.join(' ');
}

/**
 * The honest sentence, or nothing.
 *
 * Only two gaps can be stated from evidence: looks the closet could not fill,
 * and rain the bag has no outerwear for. Anything else — "you will want
 * something smarter for dinner" — is the invented claim this rewrite removes.
 */
function gapSentence(input: MemoInput): string | null {
  if (input.packing.unfilled > 0) {
    return shortfallSentence(
      input.requestedLooks,
      input.packing.unfilled,
      firstUnfilledPart(input.packing.looks),
    );
  }

  const wet = (input.forecasts ?? []).filter((f) => f.precipitationChance >= 0.4).length;
  const hasOuterwear = input.packing.items.some((p) => p.garment.slot === 'outerwear');
  if (wet > 0 && !hasOuterwear) {
    return `${cap(word(wet))} ${wet === 1 ? 'day' : 'days'} of rain, and nothing in the bag is outerwear.`;
  }

  return null;
}

/** One note per day part asked for, built from the looks that part actually got. */
function partNotes(input: MemoInput): PackingMemo['parts'] {
  return input.parts.map((part) => {
    const looks = input.packing.looks.filter((l) => l.part === part);
    const dressed = looks.filter((l) => l.outfit);
    const title = dayPartOf(part).title.toLowerCase();

    if (!looks.length) {
      return { part, note: `No ${title} on this trip.`, itemIds: [] };
    }
    if (!dressed.length) {
      return {
        part,
        note: `${cap(title)} is unfilled — your closet has nothing that works for it.`,
        itemIds: [],
      };
    }

    // The pieces this part leans on, most-used first, deduplicated. Ids rather
    // than names so the screen can link to the real garments.
    const counts = new Map<string, number>();
    for (const look of dressed) {
      for (const g of look.outfit!.items) counts.set(g.id, (counts.get(g.id) ?? 0) + 1);
    }
    const itemIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id]) => id);

    const n = dressed.length;
    return {
      part,
      note: `${cap(word(n))} ${n === 1 ? 'look' : 'looks'} for ${title}, from ${word(itemIds.length)} ${
        itemIds.length === 1 ? 'piece' : 'pieces'
      }.`,
      itemIds,
    };
  });
}

export function buildPackingMemo(input: MemoInput): PackingMemo {
  const filled = input.packing.looks.filter((l) => l.outfit).length;
  return {
    headline: memoHeadline(input.packing.items.length, filled),
    spec: specFragments(input),
    observation: observationSentence(input),
    gaps: gapSentence(input),
    parts: partNotes(input),
  };
}
