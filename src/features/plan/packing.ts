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
  const usage = new Map<string, { garment: Garment; looks: number }>();

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

      const entry = usage.get(g.id);
      if (entry) entry.looks += 1;
      else usage.set(g.id, { garment: g, looks: 1 });
    }
  }

  /**
   * The shoes you leave the house in.
   *
   * "The loafers stay on your feet on the plane" is the memo's own line, and it
   * is the reason the bag is one piece smaller than the piece count suggests.
   * The departure look decides it — the first look of the trip — and only
   * footwear qualifies, because nothing else is unambiguously not in the bag.
   */
  const wornId =
    looks[0]?.outfit?.items.find((g) => g.slot === 'footwear')?.id ?? null;

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
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

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

    days.push({ date, weather, outfit: outfit ?? null });

    recent.push(
      (outfit?.items ?? [])
        .filter((g) => g.visualWeight >= 0.1)
        .map((g) => g.id),
    );
  });

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
