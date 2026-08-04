import {
  generateOutfits,
  type Affinities,
  type Garment,
  type OutfitCandidate,
  type StyleContext,
  type StyleWeights,
  type WeatherContext,
} from '@/lib/styling';

export type PlannedDay = {
  date: Date;
  weather: WeatherContext | null;
  outfit: OutfitCandidate | null;
};

export type PackingResult = {
  days: PlannedDay[];
  /** Every distinct garment needed, ordered by how many days it covers. */
  items: { garment: Garment; days: number }[];
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
  forecasts,
  startDate,
  baseContext,
  weights,
  formality,
}: {
  wardrobe: Garment[];
  /** One entry per day of the trip. */
  forecasts: WeatherContext[];
  startDate: Date;
  baseContext: StyleContext;
  weights: StyleWeights;
  /** Target formality for the trip, or null to let each day decide. */
  formality: number | null;
}): PackingResult {
  const packed: Affinities = { colorPairs: {}, slotPairs: {}, items: {}, brands: {} };
  const packingWeights: StyleWeights = { ...weights, affinity: 1.6 };

  const days: PlannedDay[] = [];
  const usage = new Map<string, { garment: Garment; days: number }>();

  forecasts.forEach((weather, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const ctx: StyleContext = {
      ...baseContext,
      weather,
      events: [],
      note: null,
      targetFormality: formality,
      now: date.getTime(),
    };

    const [outfit] = generateOutfits(wardrobe, ctx, {
      weights: packingWeights,
      affinities: packed,
      count: 1,
      // Variety across days comes from the scorer, not from forcing difference
      // between candidates within a single day.
      diversity: 0,
    });

    days.push({ date, weather, outfit: outfit ?? null });

    for (const g of outfit?.items ?? []) {
      const boost = REUSE_BOOST[g.slot] ?? 0.5;
      packed.items[g.id] = Math.min(1, (packed.items[g.id] ?? 0) + boost);

      const entry = usage.get(g.id);
      if (entry) entry.days += 1;
      else usage.set(g.id, { garment: g, days: 1 });
    }
  });

  return {
    days,
    items: [...usage.values()].sort(
      (a, b) => b.days - a.days || a.garment.slot.localeCompare(b.garment.slot),
    ),
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
