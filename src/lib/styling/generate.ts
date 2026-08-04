/**
 * Candidate generation.
 *
 * A 150-item closet contains on the order of a million valid combinations once
 * layers and shoes are counted. Scoring all of them is wasteful, and handing
 * any meaningful fraction to a language model is impossible. So generation is a
 * staged beam search: build the core of the outfit, keep the best partial
 * looks, extend them, keep the best again.
 *
 * The pruning is safe because the rules that decide most of an outfit's quality
 * — palette, proportion, pattern — are already computable from the core two or
 * three pieces. A top-and-bottom pairing that clashes will not be rescued by
 * its shoes, so discarding it early costs nothing.
 *
 * Everything here runs on-device in a few milliseconds. That is what lets
 * outfit generation work offline and stay free, with the model reserved for
 * re-ranking the shortlist and writing the reasoning.
 */

import { targetWarmth } from './features';
import {
  DEFAULT_WEIGHTS,
  EMPTY_AFFINITIES,
  scoreOutfit,
  type Affinities,
  type StyleWeights,
} from './score';
import type { Garment, OutfitCandidate, Slot, StyleContext } from './types';

const BEAM_CORE = 48;
const BEAM_SHOD = 64;
const BEAM_FINAL = 40;

export type GenerateOptions = {
  weights?: StyleWeights;
  affinities?: Affinities;
  /** How many outfits to return. */
  count?: number;
  /** Items to keep out — already planned for this week, in the wash, etc. */
  excludeItemIds?: Set<string>;
  /** Force an item in. Powers "build me something around these boots". */
  pinnedItemIds?: Set<string>;
  /** 0 = maximum variety, 1 = pure score. */
  diversity?: number;
  includeAccessories?: boolean;
};

const bucket = (wardrobe: Garment[]): Record<Slot, Garment[]> => {
  const out: Record<Slot, Garment[]> = {
    base_top: [], mid_layer: [], bottom: [], dress: [],
    outerwear: [], footwear: [], bag: [], headwear: [], accessory: [],
  };
  for (const g of wardrobe) out[g.slot].push(g);
  return out;
};

/** Cheap partial score for pruning — only the rules that need no full outfit. */
function coreScore(items: Garment[], ctx: StyleContext, weights: StyleWeights): number {
  const c = scoreOutfit(items, { ...ctx, weather: null, events: [] }, weights);
  return c.features.palette * 0.45 + c.features.proportion * 0.25 + c.features.pattern * 0.2 + c.features.formality * 0.1;
}

const topBy = <T,>(arr: T[], n: number, key: (t: T) => number): T[] =>
  [...arr].sort((a, b) => key(b) - key(a)).slice(0, n);

export function generateOutfits(
  wardrobe: Garment[],
  ctx: StyleContext,
  opts: GenerateOptions = {},
): OutfitCandidate[] {
  const {
    weights = DEFAULT_WEIGHTS,
    affinities = EMPTY_AFFINITIES,
    count = 3,
    excludeItemIds,
    pinnedItemIds,
    diversity = 0.35,
    includeAccessories = true,
  } = opts;

  const usable = wardrobe.filter((g) => !excludeItemIds?.has(g.id));
  const slots = bucket(usable);
  const pinned = pinnedItemIds ? usable.filter((g) => pinnedItemIds.has(g.id)) : [];
  const pinnedSlots = new Set(pinned.map((g) => g.slot));

  // Layering policy from the forecast. Deciding this once, up front, is what
  // keeps a coat out of a 28-degree afternoon without paying to score it.
  const target = ctx.weather ? targetWarmth(ctx.weather.feelsLikeC, ctx.weather.windKph) : 8;
  const wantsOuterwear = target >= 9;
  const allowsOuterwear = target >= 6.5;
  const wantsMidLayer = target >= 8.5;
  const allowsMidLayer = target >= 6;

  // --- Stage A: cores ------------------------------------------------------
  const cores: Garment[][] = [];

  const tops = pinnedSlots.has('base_top')
    ? pinned.filter((g) => g.slot === 'base_top')
    : slots.base_top;
  const bottoms = pinnedSlots.has('bottom')
    ? pinned.filter((g) => g.slot === 'bottom')
    : slots.bottom;

  for (const top of tops) {
    for (const bottom of bottoms) cores.push([top, bottom]);
  }

  const dresses = pinnedSlots.has('dress') ? pinned.filter((g) => g.slot === 'dress') : slots.dress;
  for (const dress of dresses) cores.push([dress]);

  if (!cores.length) return [];

  const rankedCores = topBy(cores, BEAM_CORE, (c) => coreScore(c, ctx, weights));

  // --- Stage B: footwear ---------------------------------------------------
  const shoes = pinnedSlots.has('footwear')
    ? pinned.filter((g) => g.slot === 'footwear')
    : slots.footwear;

  const shod: Garment[][] = shoes.length
    ? rankedCores.flatMap((core) => shoes.map((s) => [...core, s]))
    : rankedCores;

  const rankedShod = topBy(shod, BEAM_SHOD, (c) => coreScore(c, ctx, weights));

  // --- Stage C: layers -----------------------------------------------------
  const mids = pinnedSlots.has('mid_layer')
    ? pinned.filter((g) => g.slot === 'mid_layer')
    : slots.mid_layer;
  const outers = pinnedSlots.has('outerwear')
    ? pinned.filter((g) => g.slot === 'outerwear')
    : slots.outerwear;

  const layered: Garment[][] = [];
  for (const base of rankedShod) {
    const hasDress = base.some((g) => g.slot === 'dress');

    // Unlayered is only a valid option when the forecast permits it.
    if (!wantsOuterwear) layered.push(base);

    if (allowsMidLayer && !hasDress) {
      for (const mid of mids) layered.push([...base, mid]);
    }
    if (allowsOuterwear) {
      for (const outer of outers) {
        layered.push([...base, outer]);
        if (wantsMidLayer && !hasDress) {
          for (const mid of mids) layered.push([...base, mid, outer]);
        }
      }
    }
  }

  const pool = layered.length ? layered : rankedShod;

  // --- Full scoring --------------------------------------------------------
  let scored = pool.map((items) => scoreOutfit(items, ctx, weights, affinities));
  scored = topBy(scored, BEAM_FINAL, (c) => c.score);

  if (includeAccessories) {
    scored = scored.map((c) => addAccessories(c, slots, ctx, weights, affinities));
  }

  return selectDiverse(scored, count, diversity);
}

/**
 * Greedily attach a bag and one accessory, but only when they improve the
 * score. Enumerating accessories multiplies the search space for very little
 * signal, and an accessory that hurts the outfit is worse than none.
 */
function addAccessories(
  candidate: OutfitCandidate,
  slots: Record<Slot, Garment[]>,
  ctx: StyleContext,
  weights: StyleWeights,
  affinities: Affinities,
): OutfitCandidate {
  let best = candidate;

  for (const slot of ['bag', 'accessory'] as const) {
    for (const extra of slots[slot]) {
      const next = scoreOutfit([...best.items, extra], ctx, weights, affinities);
      if (next.score > best.score + 0.004) best = next;
    }
  }
  return best;
}

/** Shared items plus shared colour families — how alike two outfits look. */
function similarity(a: OutfitCandidate, b: OutfitCandidate): number {
  const idsA = new Set(a.items.map((g) => g.id));
  const shared = b.items.filter((g) => idsA.has(g.id)).length;
  const union = new Set([...a.items, ...b.items].map((g) => g.id)).size;
  const jaccard = union > 0 ? shared / union : 0;

  const famA = new Set(a.items.map((g) => g.colors[0]?.family).filter(Boolean));
  const famB = new Set(b.items.map((g) => g.colors[0]?.family).filter(Boolean));
  const famShared = [...famA].filter((f) => famB.has(f)).length;
  const famUnion = new Set([...famA, ...famB]).size;
  const paletteSim = famUnion > 0 ? famShared / famUnion : 0;

  return jaccard * 0.7 + paletteSim * 0.3;
}

/**
 * Maximal marginal relevance.
 *
 * Pure top-N returns three near-identical outfits — the same jeans and shoes
 * with the shirt swapped — because the scorer has no notion of what it already
 * picked. Trading a little score for visible difference is what makes three
 * suggestions feel like three choices.
 */
export function selectDiverse(
  candidates: OutfitCandidate[],
  count: number,
  diversity: number,
): OutfitCandidate[] {
  if (candidates.length <= count) return [...candidates].sort((a, b) => b.score - a.score);

  const lambda = 1 - diversity;
  const remaining = [...candidates].sort((a, b) => b.score - a.score);
  const chosen: OutfitCandidate[] = [remaining.shift()!];

  while (chosen.length < count && remaining.length) {
    let bestIdx = 0;
    let bestValue = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i]!;
      const maxSim = Math.max(...chosen.map((s) => similarity(c, s)));
      const value = lambda * c.score - (1 - lambda) * maxSim;
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
      }
    }
    chosen.push(remaining.splice(bestIdx, 1)[0]!);
  }

  return chosen;
}

/**
 * Turn the scored notes into a sentence.
 *
 * Used verbatim when the model is unavailable, and passed to the model as
 * grounded facts when it is — so the AI elaborates on something true rather
 * than inventing a rationale for an outfit it cannot see.
 */
export function explain(candidate: OutfitCandidate): string {
  const order: (keyof OutfitCandidate['notes'])[] = [
    'weather', 'formality', 'palette', 'proportion', 'pattern', 'freshness', 'affinity',
  ];
  const parts = order
    .map((k) => candidate.notes[k])
    .filter((n): n is string => Boolean(n))
    .slice(0, 3);

  if (!parts.length) return 'A solid, wearable combination from your closet.';

  const [first, ...rest] = parts;
  const sentence = first!.charAt(0).toUpperCase() + first!.slice(1);
  return rest.length ? `${sentence} — ${rest.join(', ')}.` : `${sentence}.`;
}
