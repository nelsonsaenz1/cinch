/**
 * Weighted scoring, plus the online learner that personalises the weights.
 *
 * The whole system is one linear model over named features. That is a
 * deliberate constraint rather than a simplification:
 *
 *   - It learns from the very first thumbs-down. A neural compatibility model
 *     needs thousands of labelled outfits before it beats a decent prior, and
 *     no individual user will ever label thousands of outfits.
 *   - Every judgement decomposes. "Ranked down because the palette clashed" is
 *     recoverable from the arithmetic, so the app can explain itself and the
 *     user can argue back.
 *   - Corrections are local. Disliking loud colour combinations moves the
 *     palette weight and leaves weather sensitivity untouched.
 *
 * Two things are learned, and they answer different questions:
 *   WEIGHTS    — what this person cares about  ("I don't care about weather")
 *   AFFINITIES — what this person likes        ("I always wear navy with rust")
 */

import type { GarmentColor } from '@/lib/color';

import {
  formalityRule,
  freshnessRule,
  multiEventRule,
  occasionRule,
  paletteRule,
  patternRule,
  proportionRule,
  resolveTargetFormality,
  seasonRule,
  weatherRule,
  type Rule,
} from './features';
import {
  FEATURE_KEYS,
  type FeatureKey,
  type FeatureVector,
  type Garment,
  type OutfitCandidate,
  type StyleContext,
} from './types';

export type StyleWeights = Record<FeatureKey, number>;

/**
 * Priors, tuned to what a competent stylist actually optimises for.
 *
 * Palette leads because colour is what people notice and what they blame when
 * an outfit feels wrong. `affinity` starts at zero — there is no preference
 * data on day one, and a nonzero weight on an empty table would inject noise.
 * It rises as feedback accumulates.
 */
export const DEFAULT_WEIGHTS: StyleWeights = {
  palette: 1.4,
  formality: 1.2,
  weather: 1.15,
  occasion: 0.7,
  proportion: 0.8,
  pattern: 0.6,
  season: 0.5,
  freshness: 0.65,
  affinity: 0,
};

const WEIGHT_MIN = 0.05;
const WEIGHT_MAX = 3;

/**
 * Learned preference tables. Values are -1..1, where 0 is "no opinion".
 * Sparse by construction — only pairs the user has actually reacted to appear.
 */
export type Affinities = {
  /** `"blue|orange"`, hue families sorted alphabetically. */
  colorPairs: Record<string, number>;
  /** `"base_top|bottom"`, slots sorted. */
  slotPairs: Record<string, number>;
  /** Individual items the user reaches for or refuses. */
  items: Record<string, number>;
  brands: Record<string, number>;
};

export const EMPTY_AFFINITIES: Affinities = {
  colorPairs: {},
  slotPairs: {},
  items: {},
  brands: {},
};

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const dominantFamily = (g: Garment): string | null => {
  const c: GarmentColor | undefined = g.colors[0];
  return c ? c.family : null;
};

/**
 * Learned preference for this specific combination, mapped to 0..1.
 *
 * Returns exactly 0.5 (neutral) when nothing is known, so an unseen outfit is
 * neither rewarded nor punished for its novelty.
 */
export function affinityRule(items: Garment[], aff: Affinities): Rule {
  const signals: number[] = [];

  for (let i = 0; i < items.length; i++) {
    const gi = items[i]!;

    const itemScore = aff.items[gi.id];
    if (itemScore !== undefined) signals.push(itemScore);

    if (gi.brand) {
      const brandScore = aff.brands[gi.brand.toLowerCase()];
      if (brandScore !== undefined) signals.push(brandScore * 0.6);
    }

    for (let j = i + 1; j < items.length; j++) {
      const gj = items[j]!;

      const fi = dominantFamily(gi);
      const fj = dominantFamily(gj);
      if (fi && fj) {
        const s = aff.colorPairs[pairKey(fi, fj)];
        if (s !== undefined) signals.push(s);
      }

      const sp = aff.slotPairs[pairKey(gi.slot, gj.slot)];
      if (sp !== undefined) signals.push(sp * 0.5);
    }
  }

  if (!signals.length) return { value: 0.5 };

  const mean = signals.reduce((a, b) => a + b, 0) / signals.length;
  const value = (mean + 1) / 2;

  const note =
    mean > 0.45 ? 'a combination you keep coming back to' : undefined;

  return { value, note };
}

/** Score one candidate outfit. Pure — same inputs always give the same result. */
export function scoreOutfit(
  items: Garment[],
  ctx: StyleContext,
  weights: StyleWeights = DEFAULT_WEIGHTS,
  affinities: Affinities = EMPTY_AFFINITIES,
): OutfitCandidate {
  const targetFormality = resolveTargetFormality(ctx);

  const palette = paletteRule(items);
  const formality = formalityRule(items, targetFormality);
  const weather = weatherRule(items, ctx.weather);
  const occasion = occasionRule(items, ctx.targetOccasion, ctx.lifestyleOccasions);
  const proportion = proportionRule(items);
  const pattern = patternRule(items);
  const season = seasonRule(items, ctx.season, ctx.colorSeason);
  const freshness = freshnessRule(items, ctx.now);
  const affinity = affinityRule(items, affinities);

  const rules: Record<FeatureKey, Rule> = {
    palette,
    formality,
    weather,
    occasion,
    proportion,
    pattern,
    season,
    freshness,
    affinity,
  };

  const features = {} as FeatureVector;
  const notes: OutfitCandidate['notes'] = {};
  let weighted = 0;
  let weightSum = 0;

  for (const key of FEATURE_KEYS) {
    const rule = rules[key];
    features[key] = rule.value;
    if (rule.note) notes[key] = rule.note;

    const w = weights[key];
    weighted += rule.value * w;
    weightSum += w;
  }

  let score = weightSum > 0 ? weighted / weightSum : 0.5;

  // Multi-event days gate the score rather than contributing to the average.
  // An outfit that fails the dinner is not 80% correct — it is unusable, and
  // averaging would let a great palette hide that.
  const multi = multiEventRule(items, ctx.events);
  if (ctx.events.length > 1) {
    score *= 0.55 + multi.value * 0.45;
    if (multi.note) notes.formality = multi.note;
  }

  return {
    items,
    features,
    score,
    notes,
    harmonies: palette.harmonies,
  };
}

// ---------------------------------------------------------------------------
// Learning
// ---------------------------------------------------------------------------

/**
 * Nudge weights toward what the user just endorsed.
 *
 * The update is against a BASELINE — the mean feature values across the
 * candidates that were on screen — rather than against the raw feature values.
 * That distinction is the whole trick. If every candidate scored 0.9 on weather
 * (because it is 4C and everything shown is warm), the fact that the chosen one
 * also scored 0.9 says nothing about whether this person cares about weather.
 * Only the features where the pick DIFFERED from what it was compared against
 * carry information.
 */
export function updateWeights(
  weights: StyleWeights,
  chosen: FeatureVector,
  baseline: FeatureVector,
  liked: boolean,
  learningRate = 0.12,
): StyleWeights {
  const next = { ...weights };
  const direction = liked ? 1 : -1;

  for (const key of FEATURE_KEYS) {
    const deviation = chosen[key] - baseline[key];
    const raw = next[key] + direction * learningRate * deviation * 2;
    next[key] = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, raw));
  }

  // Hold total weight constant. Without this, a run of dislikes shrinks every
  // weight toward the floor and the ranking collapses into arbitrary order.
  const targetTotal = FEATURE_KEYS.reduce((s, k) => s + DEFAULT_WEIGHTS[k], 0);
  const actualTotal = FEATURE_KEYS.reduce((s, k) => s + next[k], 0);
  if (actualTotal > 0) {
    const scale = targetTotal / actualTotal;
    for (const key of FEATURE_KEYS) {
      next[key] = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, next[key] * scale));
    }
  }

  return next;
}

/**
 * Fold a reaction into the affinity tables.
 *
 * Exponential smoothing toward +1 / -1 keeps values bounded without any clamp,
 * and gives recent opinions more say than old ones — taste moves, and an
 * unweighted average would take a hundred likes to forget a phase.
 */
export function updateAffinities(
  aff: Affinities,
  items: Garment[],
  liked: boolean,
  rate = 0.25,
): Affinities {
  const next: Affinities = {
    colorPairs: { ...aff.colorPairs },
    slotPairs: { ...aff.slotPairs },
    items: { ...aff.items },
    brands: { ...aff.brands },
  };
  const target = liked ? 1 : -1;
  const nudge = (table: Record<string, number>, key: string, r: number) => {
    const current = table[key] ?? 0;
    table[key] = current + r * (target - current);
  };

  for (let i = 0; i < items.length; i++) {
    const gi = items[i]!;

    // Items get a gentler rate: liking an outfit is weak evidence about each
    // individual garment in it, and strong evidence about the combination.
    nudge(next.items, gi.id, rate * 0.5);
    if (gi.brand) nudge(next.brands, gi.brand.toLowerCase(), rate * 0.3);

    for (let j = i + 1; j < items.length; j++) {
      const gj = items[j]!;
      const fi = dominantFamily(gi);
      const fj = dominantFamily(gj);
      // Only substantial pieces teach colour preference — a belt should not
      // convince the engine that the user loves brown with everything.
      if (fi && fj && gi.visualWeight >= 0.1 && gj.visualWeight >= 0.1) {
        nudge(next.colorPairs, pairKey(fi, fj), rate);
      }
      nudge(next.slotPairs, pairKey(gi.slot, gj.slot), rate * 0.4);
    }
  }

  return next;
}

/** Mean feature vector across a set of candidates — the learner's baseline. */
export function meanFeatures(candidates: OutfitCandidate[]): FeatureVector {
  const out = {} as FeatureVector;
  for (const key of FEATURE_KEYS) {
    out[key] = candidates.length
      ? candidates.reduce((s, c) => s + c.features[key], 0) / candidates.length
      : 0.5;
  }
  return out;
}

/**
 * Plain-language summary of what the engine has learned, for the profile screen
 * and for injection into the stylist prompt.
 *
 * Showing people their own taste profile is what makes the learning feel like a
 * relationship rather than a black box — and it gives them somewhere to push
 * back when it gets something wrong.
 */
export function describeWeights(weights: StyleWeights): string[] {
  const deltas = FEATURE_KEYS.map((key) => ({
    key,
    delta: weights[key] - DEFAULT_WEIGHTS[key],
  }))
    .filter((d) => Math.abs(d.delta) > 0.18)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const phrases: Record<FeatureKey, [string, string]> = {
    palette: ['cares a lot about colour', 'is relaxed about colour'],
    formality: ['dresses to the occasion', 'ignores dress codes'],
    weather: ['dresses for the forecast', 'does not dress for weather'],
    occasion: ['matches clothes to activities', 'wears the same things everywhere'],
    proportion: ['notices silhouette', 'is not fussy about fit balance'],
    pattern: ['is deliberate about prints', 'is easy-going about prints'],
    season: ['sticks to seasonal pieces', 'wears things year-round'],
    freshness: ['likes variety', 'happily repeats favourites'],
    affinity: ['has strong personal combinations', 'is open to new combinations'],
  };

  return deltas.slice(0, 4).map(({ key, delta }) => phrases[key][delta > 0 ? 0 : 1]);
}
