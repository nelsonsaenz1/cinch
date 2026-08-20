import {
  generateOutfits,
  type Affinities,
  type Garment,
  type OutfitCandidate,
  type StyleContext,
  type StyleWeights,
  type WeatherContext,
} from '@/lib/styling';

import type { Look } from './packing-math';
import { fromIsoDate, type DayPartKey, type IsoDate } from './trip';

export type PlannedDay = {
  date: Date;
  weather: WeatherContext | null;
  outfit: OutfitCandidate | null;
};

/** One dressed moment: a day of the trip, and a part of that day. */
export type PackedLook = {
  dayIndex: number;
  date: IsoDate;
  part: DayPartKey;
  weather: WeatherContext | null;
  outfit: OutfitCandidate | null;
};

export type PackedPiece = {
  garment: Garment;
  /** How many looks it appears in — the `×3` on the piece. */
  looks: number;
  /**
   * On your feet on the plane, so not in the bag. Exactly one piece at most,
   * and it prints `worn` where the others print a count.
   */
  worn: boolean;
};

export type PackingResult = {
  looks: PackedLook[];
  /** Every distinct garment needed, ordered by how many looks it covers. */
  items: PackedPiece[];
  /**
   * Looks the closet could not fill.
   *
   * K-06's second failure is the honest sentence built from this: "Six looks,
   * not eight — you don't own anything that works for a warm evening out."
   * Counting them is the only way that sentence can be true, so the search is
   * never quietly given a smaller target.
   */
  unfilled: number;
};

/**
 * Build a capsule for a trip.
 *
 * Packing inverts the usual objective. Every other surface in the app wants
 * variety — three visibly different outfits, nothing worn twice this week. A
 * suitcase wants the opposite: the fewest garments that still produce a
 * different-looking outfit each day.
 *
 * Rather than write a second scorer for that, this reuses the affinity table
 * the learner already owns. Each time a piece is packed its affinity is raised,
 * so the next day's search finds it more attractive, and the selection
 * naturally converges on a small set of pieces that recombine. The `affinity`
 * weight is raised for the duration, since its learned value is usually near
 * zero and would otherwise leave the bias with nothing to act through.
 *
 * Bottoms, shoes and outerwear are pushed harder than tops, which matches how
 * people actually pack: one pair of trousers across three days is normal, one
 * shirt across three days is not.
 */
const REUSE_BOOST: Partial<Record<Garment['slot'], number>> = {
  bottom: 1,
  footwear: 1,
  outerwear: 1,
  bag: 1,
  mid_layer: 0.7,
  base_top: 0.35,
  dress: 0.35,
  accessory: 0.6,
  headwear: 0.6,
};

export function buildPackingList({
  wardrobe,
  schedule,
  forecasts,
  baseContext,
  weights,
  formalityForPart,
}: {
  wardrobe: Garment[];
  /** Every look the trip needs, from `lookSchedule`. */
  schedule: readonly Look[];
  /** Indexed by `dayIndex`. A day with no weather is dressed without one. */
  forecasts: readonly (WeatherContext | null)[];
  baseContext: StyleContext;
  weights: StyleWeights;
  /**
   * Target formality for a part of the day, or null to let the day decide.
   *
   * A function rather than a number because the evening is dressier than the
   * afternoon of the same trip, and the gym is neither — see
   * `formalityForPart` in trip.ts, which is what callers pass.
   */
  formalityForPart: (part: DayPartKey) => number | null;
}): PackingResult {
  const packed: Affinities = { colorPairs: {}, slotPairs: {}, items: {}, brands: {} };
  const packingWeights: StyleWeights = { ...weights, affinity: 1.6 };

  const looks: PackedLook[] = [];

  for (const look of schedule) {
    const weather = forecasts[look.dayIndex] ?? null;

    const ctx: StyleContext = {
      ...baseContext,
      weather,
      events: [],
      note: null,
      targetFormality: formalityForPart(look.part),
      now: fromIsoDate(look.date).getTime(),
    };

    const [outfit] = generateOutfits(wardrobe, ctx, {
      weights: packingWeights,
      affinities: packed,
      count: 1,
      // Variety across looks comes from the scorer, not from forcing difference
      // between candidates within a single look.
      diversity: 0,
    });

    looks.push({ ...look, weather, outfit: outfit ?? null });

    for (const g of outfit?.items ?? []) {
      const boost = REUSE_BOOST[g.slot] ?? 0.5;
      packed.items[g.id] = Math.min(1, (packed.items[g.id] ?? 0) + boost);
    }
  }

  // The tally — including "the loafers stay on your feet on the plane", which
  // is the reason the bag is one piece smaller than the piece count suggests —
  // is shared with `swapDay` below rather than written twice.
  return tallyLooks(looks);
}

/**
 * Re-dress ONE day, and leave the rest of the trip alone.
 *
 * "Swap a day" (K-05) has to mean the day it names. Re-running
 * `buildPackingList` over the whole trip with that day's pieces removed
 * satisfies the letter of it and breaks the promise: the affinity table
 * rebuilds from nothing, so the pieces day 3 leaned on can move because day 2
 * was swapped, and a user who asked to change Saturday watches Sunday change
 * too.
 *
 * So this replays the existing result instead. Every other look keeps the
 * outfit it already had — and still contributes its affinity, in order, so the
 * one look being re-searched is biased towards what is already in the bag,
 * which is the whole point of the packing regime. Only the target day is
 * searched again, with its own current pieces excluded.
 *
 * The counts are then recomputed from the new set of looks, because a swap
 * genuinely changes them: dropping the linen blouse from Saturday makes it a
 * ×2 rather than a ×3.
 */
export function swapDay({
  previous,
  dayIndex,
  wardrobe,
  baseContext,
  weights,
  formalityForPart,
}: {
  previous: PackingResult;
  /** Which day of the trip to re-dress. Every look on it is re-searched. */
  dayIndex: number;
  wardrobe: Garment[];
  baseContext: StyleContext;
  weights: StyleWeights;
  formalityForPart: (part: DayPartKey) => number | null;
}): PackingResult {
  /** What that day is wearing now — the thing the user is asking to be rid of. */
  const excluded = new Set(
    previous.looks
      .filter((l) => l.dayIndex === dayIndex)
      .flatMap((l) => l.outfit?.items ?? [])
      .map((g) => g.id),
  );

  const pool = wardrobe.filter((g) => !excluded.has(g.id));
  const packed: Affinities = { colorPairs: {}, slotPairs: {}, items: {}, brands: {} };
  const packingWeights: StyleWeights = { ...weights, affinity: 1.6 };

  const looks: PackedLook[] = [];

  for (const look of previous.looks) {
    let outfit = look.outfit;

    if (look.dayIndex === dayIndex) {
      const ctx: StyleContext = {
        ...baseContext,
        weather: look.weather,
        events: [],
        note: null,
        targetFormality: formalityForPart(look.part),
        now: fromIsoDate(look.date).getTime(),
      };

      // No fallback to the unfiltered pool on purpose. A day that cannot be
      // re-dressed without repeating itself should come back empty and say so,
      // rather than quietly handing back the same outfit and reading as a
      // button that did nothing.
      [outfit] = generateOutfits(pool, ctx, {
        weights: packingWeights,
        affinities: packed,
        count: 1,
        diversity: 0,
      });
    }

    looks.push({ ...look, outfit: outfit ?? null });

    for (const g of outfit?.items ?? []) {
      const boost = REUSE_BOOST[g.slot] ?? 0.5;
      packed.items[g.id] = Math.min(1, (packed.items[g.id] ?? 0) + boost);
    }
  }

  return tallyLooks(looks);
}

/** Distinct pieces, how many looks each covers, and which one is worn out. */
function tallyLooks(looks: PackedLook[]): PackingResult {
  const usage = new Map<string, { garment: Garment; looks: number }>();

  for (const look of looks) {
    for (const g of look.outfit?.items ?? []) {
      const entry = usage.get(g.id);
      if (entry) entry.looks += 1;
      else usage.set(g.id, { garment: g, looks: 1 });
    }
  }

  const wornId = looks[0]?.outfit?.items.find((g) => g.slot === 'footwear')?.id ?? null;

  return {
    looks,
    items: [...usage.values()]
      .sort((a, b) => b.looks - a.looks || a.garment.slot.localeCompare(b.garment.slot))
      .map((entry) => ({ ...entry, worn: entry.garment.id === wornId })),
    unfilled: looks.filter((l) => !l.outfit).length,
  };
}

/**
 * Plan a week of outfits, avoiding repeats.
 *
 * The mirror image of packing: each day excludes everything substantial worn in
 * the previous two days, so a week reads as seven outfits rather than one
 * outfit with the shirt swapped. Accessories and bags are allowed to repeat —
 * nobody notices, and excluding them starves the search on a small closet.
 */
export function planWeek({
  wardrobe,
  forecasts,
  startDate,
  baseContext,
  weights,
  affinities,
  alreadyPlanned = new Set<string>(),
}: {
  wardrobe: Garment[];
  forecasts: WeatherContext[];
  startDate: Date;
  baseContext: StyleContext;
  weights: StyleWeights;
  affinities: Affinities;
  /** Item ids already committed elsewhere this week. */
  alreadyPlanned?: Set<string>;
}): PlannedDay[] {
  const recent: string[][] = [];
  const days: PlannedDay[] = [];

  forecasts.forEach((weather, i) => {
    days.push(planOneDay({ wardrobe, weather, startDate, index: i, baseContext, weights, affinities, alreadyPlanned, recent }));
  });

  return days;
}

/** One day of the week, sharing the running `recent` window with its siblings. */
function planOneDay({
  wardrobe,
  weather,
  startDate,
  index,
  baseContext,
  weights,
  affinities,
  alreadyPlanned,
  recent,
}: {
  wardrobe: Garment[];
  weather: WeatherContext;
  startDate: Date;
  index: number;
  baseContext: StyleContext;
  weights: StyleWeights;
  affinities: Affinities;
  alreadyPlanned: Set<string>;
  /** MUTATED: this day's structural pieces are appended for the next day. */
  recent: string[][];
}): PlannedDay {
  const date = new Date(startDate);
  date.setDate(date.getDate() + index);

  const exclude = new Set([...alreadyPlanned, ...recent.slice(-2).flat()]);

  const ctx: StyleContext = {
    ...baseContext,
    weather,
    events: [],
    note: null,
    now: date.getTime(),
  };

  let [outfit] = generateOutfits(wardrobe, ctx, {
    weights,
    affinities,
    count: 1,
    diversity: 0,
    excludeItemIds: exclude,
  });

  // A small closet can run out of eligible pieces part-way through the week.
  // Better to repeat than to show a blank day, so drop the constraint rather
  // than the outfit.
  if (!outfit) {
    [outfit] = generateOutfits(wardrobe, ctx, {
      weights,
      affinities,
      count: 1,
      diversity: 0,
    });
  }

  recent.push(
    (outfit?.items ?? [])
      .filter((g) => g.visualWeight >= 0.1)
      .map((g) => g.id),
  );

  return { date, weather, outfit: outfit ?? null };
}

/**
 * The same week, one day per macrotask.
 *
 * `planWeek` is seven full generation passes, and running them inside a render
 * memo is what froze the Plan tab: on a large closet the pass is a few hundred
 * milliseconds of arithmetic on desktop and several SECONDS of blocked JS on a
 * phone — no taps, no scroll, no tab bar, for as long as it runs. Yielding
 * between days caps any single block at one day's pass, so the skeleton
 * animates, the segment control answers, and a person who tapped Plan by
 * accident can leave.
 *
 * Same arithmetic, same order, same `recent` window — `planOneDay` is shared
 * with the synchronous version, which stays for the tests and for callers
 * (packing) that already run off-screen. A stale run resolves to `null`
 * instead of half a week: the caller keys runs and only keeps the newest.
 */
export async function planWeekAsync(
  args: {
    wardrobe: Garment[];
    forecasts: WeatherContext[];
    startDate: Date;
    baseContext: StyleContext;
    weights: StyleWeights;
    affinities: Affinities;
    alreadyPlanned?: Set<string>;
  },
  isStale?: () => boolean,
): Promise<PlannedDay[] | null> {
  const { alreadyPlanned = new Set<string>() } = args;
  const recent: string[][] = [];
  const days: PlannedDay[] = [];

  for (let i = 0; i < args.forecasts.length; i++) {
    if (isStale?.()) return null;
    // The yield. `setTimeout(0)` rather than a microtask, because a microtask
    // runs before paint and would yield nothing.
    await new Promise((r) => setTimeout(r, 0));
    if (isStale?.()) return null;
    days.push(
      planOneDay({
        wardrobe: args.wardrobe,
        weather: args.forecasts[i]!,
        startDate: args.startDate,
        index: i,
        baseContext: args.baseContext,
        weights: args.weights,
        affinities: args.affinities,
        alreadyPlanned,
        recent,
      }),
    );
  }

  return days;
}

export const dayLabel = (d: Date, today = new Date()): string => {
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'long' });
};

export const shortDate = (d: Date): string =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
