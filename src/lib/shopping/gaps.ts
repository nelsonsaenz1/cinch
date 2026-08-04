/**
 * Wardrobe gap analysis — what to buy next.
 *
 * The definition of a "gap" is the whole product here. Every shopping feature
 * in this category answers "you own no yellow" or "people like you bought this
 * jacket", and both are really advertising wearing a recommendation's clothes.
 *
 * Cinch answers a different and much harder question: which single garment,
 * added to THIS closet, would unlock the most new outfits that score well
 * against THIS person's learned preferences — priced in the band they actually
 * shop in.
 *
 * The method is counterfactual simulation. Construct a hypothetical garment,
 * drop it into the closet, re-run generation, and measure the lift. It is
 * honest by construction: a recommendation can only rank highly if it genuinely
 * combines with clothes already owned, and the reasoning ("this unlocks nine
 * new outfits with things you already wear") is a fact rather than a pitch.
 *
 * The same machinery answers the inverse question — which owned items are dead
 * weight — which is what keeps this from being a pure consumption engine.
 */

import { resolveColorName, toGarmentColors } from '@/lib/color';
import {
  generateOutfits,
  scoreOutfit,
  type Affinities,
  type Garment,
  type PatternScale,
  type Slot,
  type StyleContext,
  type StyleWeights,
} from '@/lib/styling';

export type GapCandidate = {
  slot: Slot;
  categoryLabel: string;
  colorName: string;
  formality: number;
  warmth: number;
  /** New outfits above threshold that include this piece. */
  outfitsUnlocked: number;
  /** Mean score of those outfits. */
  meanScore: number;
  /** Score lift over the closet's current best, 0..1. */
  lift: number;
  priceLow: number | null;
  priceHigh: number | null;
  rationale: string;
};

/**
 * The palette a gap is allowed to propose from.
 *
 * Restricted to colours that combine broadly on purpose. A recommendation
 * engine that suggests a lime green jacket because it technically unlocks
 * combinations has misread what "unlock" is worth — versatile pieces are what
 * make a wardrobe work, and the scoring already rewards them.
 */
const CANDIDATE_COLORS = [
  'navy', 'charcoal', 'black', 'white', 'cream', 'grey',
  'camel', 'olive', 'brown', 'stone', 'burgundy', 'forest green',
];

const SLOT_LABELS: Record<Slot, string> = {
  base_top: 'top',
  mid_layer: 'knit or sweatshirt',
  bottom: 'trousers or jeans',
  dress: 'dress',
  outerwear: 'jacket or coat',
  footwear: 'shoes',
  bag: 'bag',
  headwear: 'hat',
  accessory: 'accessory',
};

const SLOT_VISUAL_WEIGHT: Record<Slot, number> = {
  dress: 0.42, outerwear: 0.34, bottom: 0.26, base_top: 0.22, mid_layer: 0.24,
  footwear: 0.12, bag: 0.06, headwear: 0.05, accessory: 0.04,
};

/** Slots worth proposing. Accessories rarely unlock outfits on their own. */
const SHOPPABLE: Slot[] = ['base_top', 'mid_layer', 'bottom', 'outerwear', 'footwear'];

function hypothetical(
  slot: Slot,
  colorName: string,
  formality: number,
  warmth: number,
): Garment {
  return {
    id: `__gap_${slot}_${colorName}_${formality}`,
    slot,
    category: 'other',
    subcategory: SLOT_LABELS[slot],
    colors: toGarmentColors([{ name: colorName }]),
    visualWeight: SLOT_VISUAL_WEIGHT[slot],
    fit: 'regular',
    pattern: null,
    patternScale: 'none' as PatternScale,
    material: null,
    brand: null,
    formality,
    warmth,
    waterResistant: false,
    seasons: [],
    occasions: [],
    wearCount: 0,
    // Never-worn rather than neglected, so the freshness rule does not hand a
    // hypothetical an advantage no real garment could match.
    lastWornAt: null,
    purchasePrice: null,
    thumbPath: null,
    cutoutPath: null,
  };
}

/** Interquartile price band for a slot, from what the user has actually paid. */
function priceBand(wardrobe: Garment[], slot: Slot): [number | null, number | null] {
  const prices = wardrobe
    .filter((g) => g.slot === slot && g.purchasePrice !== null && g.purchasePrice > 0)
    .map((g) => g.purchasePrice!)
    .sort((a, b) => a - b);

  // Fall back to the whole closet — better a rough band than none, and a user
  // who priced ten items has told us plenty about how they shop.
  const source =
    prices.length >= 3
      ? prices
      : wardrobe
          .filter((g) => g.purchasePrice !== null && g.purchasePrice > 0)
          .map((g) => g.purchasePrice!)
          .sort((a, b) => a - b);

  if (source.length < 3) return [null, null];

  const at = (q: number) => source[Math.min(source.length - 1, Math.floor(source.length * q))]!;
  return [Math.round(at(0.25)), Math.round(at(0.75))];
}

export type GapOptions = {
  weights?: StyleWeights;
  affinities?: Affinities;
  /** Contexts to evaluate against — typically a warm day and a cold day. */
  contexts: StyleContext[];
  /** Score above which an outfit counts as "good". */
  threshold?: number;
  maxResults?: number;
};

/**
 * Rank hypothetical purchases by how much they improve the closet.
 *
 * Cost is roughly `slots x colours x formality-bands x contexts` generations.
 * Generation is ~10ms, so the default grid lands near a second — fine as an
 * occasional background pass, and far too slow to run per frame. Call it on a
 * schedule and cache into `wardrobe_gaps`.
 */
export function findGaps(wardrobe: Garment[], opts: GapOptions): GapCandidate[] {
  const { weights, affinities, contexts, threshold = 0.72, maxResults = 6 } = opts;
  if (!contexts.length || wardrobe.length < 6) return [];

  // Baseline: how good the closet already is, per context.
  const baseline = contexts.map((ctx) => {
    const outfits = generateOutfits(wardrobe, ctx, {
      weights, affinities, count: 8, diversity: 0.2,
    });
    return outfits.length ? outfits.reduce((s, o) => s + o.score, 0) / outfits.length : 0;
  });

  // Formality bands the closet is thin on. Buying a fourth pair of casual jeans
  // does not unlock anything; a first pair of smart trousers unlocks a lot.
  const counts = [0, 0, 0, 0, 0];
  for (const g of wardrobe) counts[Math.round(g.formality) - 1]!++;
  const total = wardrobe.length || 1;
  const formalityBands = [2, 3, 4].filter((f) => counts[f - 1]! / total < 0.4);
  if (!formalityBands.length) formalityBands.push(3);

  const results: GapCandidate[] = [];

  for (const slot of SHOPPABLE) {
    const owned = wardrobe.filter((g) => g.slot === slot).length;
    // A slot already ten pieces deep will not be transformed by an eleventh.
    if (owned > 10) continue;

    const [priceLow, priceHigh] = priceBand(wardrobe, slot);

    for (const colorName of CANDIDATE_COLORS) {
      for (const formality of formalityBands) {
        const warmth = slot === 'outerwear' ? 4 : slot === 'mid_layer' ? 3 : 2;
        const candidate = hypothetical(slot, colorName, formality, warmth);
        const augmented = [...wardrobe, candidate];

        let unlocked = 0;
        let scoreSum = 0;
        let liftSum = 0;

        contexts.forEach((ctx, i) => {
          const outfits = generateOutfits(augmented, ctx, {
            weights, affinities, count: 8, diversity: 0.2,
          });
          const withCandidate = outfits.filter(
            (o) => o.items.some((g) => g.id === candidate.id) && o.score >= threshold,
          );
          unlocked += withCandidate.length;
          scoreSum += withCandidate.reduce((s, o) => s + o.score, 0);

          const mean = outfits.length
            ? outfits.reduce((s, o) => s + o.score, 0) / outfits.length
            : 0;
          liftSum += mean - baseline[i]!;
        });

        if (unlocked === 0) continue;

        results.push({
          slot,
          categoryLabel: SLOT_LABELS[slot],
          colorName,
          formality,
          warmth,
          outfitsUnlocked: unlocked,
          meanScore: scoreSum / unlocked,
          lift: liftSum / contexts.length,
          priceLow,
          priceHigh,
          rationale: '',
        });
      }
    }
  }

  // Rank on unlock count first, then on how much it raises the closet overall.
  // Deduplicate to one suggestion per slot: five variations on "buy a jacket"
  // is a worse list than five genuinely different ideas.
  const bySlot = new Map<Slot, GapCandidate>();
  for (const r of results.sort(
    (a, b) => b.outfitsUnlocked - a.outfitsUnlocked || b.lift - a.lift,
  )) {
    if (!bySlot.has(r.slot)) bySlot.set(r.slot, r);
  }

  return [...bySlot.values()]
    .sort((a, b) => b.outfitsUnlocked - a.outfitsUnlocked || b.lift - a.lift)
    .slice(0, maxResults)
    .map((g) => ({ ...g, rationale: describeGap(g) }));
}

function describeGap(g: GapCandidate): string {
  const price =
    g.priceLow !== null && g.priceHigh !== null
      ? ` You usually spend $${g.priceLow}–$${g.priceHigh} here.`
      : '';
  const register =
    g.formality >= 4 ? 'smart' : g.formality <= 2 ? 'casual' : 'smart-casual';

  return `A ${register} ${g.colorName} ${g.categoryLabel} would unlock ${g.outfitsUnlocked} new outfit${g.outfitsUnlocked === 1 ? '' : 's'} from clothes you already own.${price}`;
}

/**
 * The inverse: items that combine with almost nothing.
 *
 * Surfacing these is what stops the shopping feature from being pure
 * consumption — and it is also the honest input to a future resale flow, since
 * a piece that has not earned a place in an outfit in months is exactly what
 * someone would list.
 */
export function findDeadWeight(
  wardrobe: Garment[],
  contexts: StyleContext[],
  weights?: StyleWeights,
  affinities?: Affinities,
): { item: Garment; bestScore: number }[] {
  const best = new Map<string, number>();

  for (const ctx of contexts) {
    for (const g of wardrobe) {
      const outfits = generateOutfits(wardrobe, ctx, {
        weights, affinities, count: 1, diversity: 0,
        pinnedItemIds: new Set([g.id]),
      });
      const score = outfits[0]?.score ?? 0;
      best.set(g.id, Math.max(best.get(g.id) ?? 0, score));
    }
  }

  return wardrobe
    .map((item) => ({ item, bestScore: best.get(item.id) ?? 0 }))
    .filter((r) => r.bestScore < 0.6)
    .sort((a, b) => a.bestScore - b.bestScore);
}

/** Score a real product against the closet — the "should I buy this?" check. */
export function scoreProspect(
  wardrobe: Garment[],
  prospect: {
    slot: Slot;
    colorName: string;
    formality: number;
    warmth: number;
  },
  contexts: StyleContext[],
  weights?: StyleWeights,
  affinities?: Affinities,
): { fitScore: number; outfitsUnlocked: number; rationale: string } {
  const color = resolveColorName(prospect.colorName);
  if (!color) return { fitScore: 0, outfitsUnlocked: 0, rationale: 'Colour not recognised.' };

  const candidate = hypothetical(
    prospect.slot, prospect.colorName, prospect.formality, prospect.warmth,
  );
  const augmented = [...wardrobe, candidate];

  let unlocked = 0;
  let bestScore = 0;

  for (const ctx of contexts) {
    const outfits = generateOutfits(augmented, ctx, {
      weights, affinities, count: 8, diversity: 0.2,
      pinnedItemIds: new Set([candidate.id]),
    });
    for (const o of outfits) {
      if (o.score >= 0.72) unlocked++;
      bestScore = Math.max(bestScore, o.score);
    }
  }

  // Best pairing found, for the "it goes with your X" line.
  let partner: Garment | null = null;
  for (const ctx of contexts) {
    const [top] = generateOutfits(augmented, ctx, {
      weights, affinities, count: 1, diversity: 0,
      pinnedItemIds: new Set([candidate.id]),
    });
    const other = top?.items.find((g) => g.id !== candidate.id && g.visualWeight >= 0.2);
    if (other) {
      partner = other;
      break;
    }
  }

  const rationale = unlocked
    ? `Works in ${unlocked} outfit${unlocked === 1 ? '' : 's'} with what you own${
        partner ? `, starting with your ${partner.colors[0]?.name ?? ''} ${partner.subcategory ?? ''}`.trimEnd() : ''
      }.`
    : 'This does not combine well with what you already own.';

  return { fitScore: bestScore, outfitsUnlocked: unlocked, rationale };
}

/** Fallback price band used before any purchase prices exist. */
export function inferPriceTier(wardrobe: Garment[]): 'budget' | 'mid' | 'premium' | null {
  const prices = wardrobe.map((g) => g.purchasePrice).filter((p): p is number => p !== null && p > 0);
  if (prices.length < 4) return null;
  const median = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]!;
  return median < 60 ? 'budget' : median < 180 ? 'mid' : 'premium';
}

/** Convenience re-export so callers do not reach past this module. */
export { scoreOutfit };
