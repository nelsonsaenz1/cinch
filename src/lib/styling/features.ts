/**
 * The individual scoring rules.
 *
 * Every function returns 0..1 plus an optional note. The notes are not debug
 * output — they are what the outfit card shows the user ("light layers, it
 * hits 24 degrees") and what gets handed to the model as grounded facts so it
 * writes reasoning about the real outfit instead of inventing some.
 *
 * Rules are kept deliberately legible. A neural compatibility model would score
 * marginally better on benchmark datasets and would be impossible to explain,
 * impossible to correct when a user disagrees, and would need thousands of
 * labelled outfits per user before it beat a sensible prior.
 */

import { analyzePalette, seasonFit, type Season } from '@/lib/color';

import { isRainHostile, normalizedWeights } from './garment';
import type { EventContext, Garment, StyleContext, WeatherContext } from './types';

export type Rule = { value: number; note?: string };

const clamp = (n: number, lo = 0, hi = 1) => (n < lo ? lo : n > hi ? hi : n);

/** Slots that cover the body and therefore contribute insulation. */
const INSULATING = new Set(['base_top', 'mid_layer', 'bottom', 'dress', 'outerwear', 'footwear']);

/**
 * Accessories that can still be warm. Counted at `warmth - 1` so a belt or a
 * watch contributes nothing while a wool scarf contributes properly — without
 * this the accessory pass will happily staple a scarf onto a 27-degree outfit,
 * because it improves the palette and costs nothing.
 */
const TRIM_INSULATING = new Set(['accessory', 'headwear']);

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

export function paletteRule(items: Garment[]): Rule & { harmonies: string[] } {
  const weights = normalizedWeights(items);
  const analysis = analyzePalette(
    items.map((g, i) => ({ colors: g.colors, visualWeight: weights[i]! })),
  );

  const named = analysis.labels.filter(
    (l) => l !== 'neutral-anchored' && l !== 'metallic-accent',
  );

  let note: string | undefined;
  if (analysis.labels.includes('discord') || analysis.labels.includes('near-miss')) {
    note = undefined; // Never explain a weakness as if it were a feature.
  } else if (named.length) {
    note = `${named[0]!.replace('-', ' ')} palette`;
  } else if (analysis.hasNeutralAnchor) {
    note = 'neutral base';
  }

  return { value: analysis.score, note, harmonies: analysis.labels };
}

// ---------------------------------------------------------------------------
// Formality
// ---------------------------------------------------------------------------

/**
 * Shoes set the register of an outfit more than anything else — the same jeans
 * read completely differently under loafers and under running shoes. So
 * footwear carries extra weight in the mean, which is a real styling fact and
 * not a tuning fudge.
 */
const FORMALITY_EMPHASIS: Partial<Record<Garment['slot'], number>> = {
  footwear: 1.6,
  outerwear: 1.2,
  accessory: 0.4,
  bag: 0.5,
  headwear: 0.5,
};

export function formalityRule(items: Garment[], target: number | null): Rule {
  const substantial = items.filter((g) => g.visualWeight >= 0.1);
  if (!substantial.length) return { value: 0.5 };

  let sum = 0;
  let wsum = 0;
  for (const g of items) {
    const w = (FORMALITY_EMPHASIS[g.slot] ?? 1) * g.visualWeight;
    sum += g.formality * w;
    wsum += w;
  }
  const mean = sum / wsum;

  // Internal coherence: the spread across substantial pieces. A blazer over a
  // hoodie can work; a tuxedo jacket with board shorts cannot, and the gap is
  // what tells them apart.
  const scores = substantial.map((g) => g.formality);
  const spread = Math.max(...scores) - Math.min(...scores);
  const coherence = spread <= 1 ? 1 : spread === 2 ? 0.78 : spread === 3 ? 0.42 : 0.16;

  if (target === null) return { value: coherence };

  const miss = Math.abs(mean - target);
  const targetFit = clamp(1 - miss / 2.4);

  let note: string | undefined;
  if (targetFit > 0.8 && target >= 4) note = 'dressed up without overshooting';
  else if (targetFit > 0.8 && target <= 2) note = 'casual but considered';
  else if (mean < target - 1) note = 'reads casual for this';

  return { value: coherence * 0.45 + targetFit * 0.55, note };
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

/**
 * Insulation an outfit needs at a given apparent temperature, on the same 1-5
 * per-garment scale the tagger uses.
 *
 * Calibrated against real outfits rather than derived: tee + jeans + sneakers
 * sums to 7 and is right at about 20C; add a light jacket for 10 at about 12C;
 * a heavy coat and knit reaches 14 near freezing. The linear fit through those
 * anchors is what the constants encode.
 */
export function targetWarmth(feelsLikeC: number, windKph = 0): number {
  const windChillBump = windKph > 20 ? (windKph - 20) * 0.045 : 0;
  return clamp(4 + (30 - feelsLikeC) * 0.37 + windChillBump, 3, 20);
}

export function weatherRule(items: Garment[], weather: WeatherContext | null): Rule {
  if (!weather) return { value: 0.6 };

  const actual = items.reduce((sum, g) => {
    if (INSULATING.has(g.slot)) return sum + g.warmth;
    if (TRIM_INSULATING.has(g.slot)) return sum + Math.max(0, g.warmth - 1);
    return sum;
  }, 0);

  const target = targetWarmth(weather.feelsLikeC, weather.windKph);
  const miss = actual - target;

  // Asymmetric on purpose. Being over-dressed is recoverable — you take the
  // jacket off. Being under-dressed is not, so the penalty is steeper.
  const tolerance = miss < 0 ? 3.6 : 5.2;
  let value = clamp(1 - Math.abs(miss) / tolerance);

  let note: string | undefined;
  if (value > 0.75) {
    note =
      weather.feelsLikeC >= 24
        ? `light enough for ${Math.round(weather.feelsLikeC)}°`
        : weather.feelsLikeC <= 8
          ? `warm enough for ${Math.round(weather.feelsLikeC)}°`
          : `right weight for ${Math.round(weather.feelsLikeC)}°`;
  } else if (miss < -2) {
    note = 'might be cold';
  }

  // Rain. A water-resistant outer layer is what matters; suede shoes in a
  // downpour is the failure everyone has actually lived through.
  if (weather.precipitationChance > 0.4) {
    const outer = items.find((g) => g.slot === 'outerwear');
    const shoes = items.find((g) => g.slot === 'footwear');

    if (outer?.waterResistant) {
      value = clamp(value + 0.08);
      note = 'rain-ready';
    } else if (weather.precipitationChance > 0.6 && !outer) {
      value *= 0.82;
    }
    if (shoes && isRainHostile(shoes.material)) {
      value *= 0.72;
      note = 'those shoes will not survive the rain';
    }
  }

  // A big daily swing rewards a removable layer rather than one heavy piece.
  if (weather.swing) {
    const layers = items.filter((g) => g.slot === 'mid_layer' || g.slot === 'outerwear').length;
    if (layers >= 1) value = clamp(value + 0.06);
    else value *= 0.9;
  }

  return { value, note };
}

// ---------------------------------------------------------------------------
// Occasion
// ---------------------------------------------------------------------------

export function occasionRule(items: Garment[], target: string | null): Rule {
  if (!target) return { value: 0.7 };
  const wanted = target.toLowerCase();

  const relevant = items.filter((g) => g.visualWeight >= 0.1 && g.occasions.length > 0);
  if (!relevant.length) return { value: 0.6 };

  const hits = relevant.filter((g) =>
    g.occasions.some((o) => o.toLowerCase() === wanted || o.toLowerCase().includes(wanted)),
  ).length;

  return { value: clamp(0.4 + (hits / relevant.length) * 0.6) };
}

// ---------------------------------------------------------------------------
// Proportion
// ---------------------------------------------------------------------------

const VOLUME: Record<Garment['fit'], number> = {
  fitted: 0,
  regular: 1,
  relaxed: 2,
  oversized: 3,
};

/**
 * Volume balance — the single most useful silhouette rule there is.
 *
 * Volume on top wants restraint below, and vice versa. Volume everywhere
 * erases the body; restraint everywhere can read severe but is rarely wrong.
 * This is the working half of the rule-of-thirds advice, and unlike garment
 * lengths it is recoverable from tags we actually have.
 */
export function proportionRule(items: Garment[]): Rule {
  const dress = items.find((g) => g.slot === 'dress');
  const bottom = items.find((g) => g.slot === 'bottom');

  const upper = items.filter((g) => g.slot === 'base_top' || g.slot === 'mid_layer');
  const upperVolume = upper.length ? Math.max(...upper.map((g) => VOLUME[g.fit])) : null;

  if (dress) {
    const outer = items.find((g) => g.slot === 'outerwear');
    // An oversized coat over a fitted dress is a classic; over a voluminous
    // dress it becomes a tent.
    if (outer && VOLUME[dress.fit] >= 2 && VOLUME[outer.fit] >= 2) {
      return { value: 0.42, note: undefined };
    }
    return { value: 0.8 };
  }

  if (upperVolume === null || !bottom) return { value: 0.6 };
  const lowerVolume = VOLUME[bottom.fit];

  const gap = Math.abs(upperVolume - lowerVolume);
  const both = upperVolume + lowerVolume;

  if (both >= 4) return { value: 0.34, note: undefined }; // volume everywhere
  if (gap >= 2) return { value: 1, note: 'balanced proportions' };
  if (gap === 1) return { value: 0.86 };
  if (both === 0) return { value: 0.7 }; // fitted head to toe
  return { value: 0.74 };
}

// ---------------------------------------------------------------------------
// Pattern
// ---------------------------------------------------------------------------

const SCALE_RANK: Record<Garment['patternScale'], number> = {
  none: 0,
  micro: 1,
  small: 2,
  medium: 3,
  large: 4,
};

/**
 * Pattern mixing works when the scales are clearly different — a wide stripe
 * next to a pinstripe reads as intentional, two mid-scale prints read as
 * getting dressed in the dark.
 */
export function patternRule(items: Garment[]): Rule {
  const patterned = items.filter((g) => g.patternScale !== 'none' && g.visualWeight >= 0.08);

  if (patterned.length === 0) return { value: 0.76 };
  if (patterned.length === 1) return { value: 1, note: `${patterned[0]!.pattern} as the focal point` };

  if (patterned.length === 2) {
    const [a, b] = patterned as [Garment, Garment];
    const separation = Math.abs(SCALE_RANK[a.patternScale] - SCALE_RANK[b.patternScale]);
    if (separation >= 2) return { value: 0.84, note: 'patterns mixed at different scales' };
    return { value: 0.36 };
  }

  return { value: 0.2 };
}

// ---------------------------------------------------------------------------
// Season
// ---------------------------------------------------------------------------

export function seasonRule(
  items: Garment[],
  currentSeason: string | null,
  colorSeason: string | null,
): Rule {
  const substantial = items.filter((g) => g.visualWeight >= 0.1);

  let tagFit = 0.7;
  if (currentSeason) {
    const tagged = substantial.filter((g) => g.seasons.length > 0);
    if (tagged.length) {
      const hits = tagged.filter((g) => g.seasons.includes(currentSeason)).length;
      tagFit = clamp(0.35 + (hits / tagged.length) * 0.65);
    }
  }

  // Personal palette, applied gently. It is a preference, never a filter — an
  // app that hides clothes the user owns and likes has misunderstood its job.
  let paletteFit = 1;
  if (colorSeason) {
    const dominant = substantial
      .map((g) => g.colors[0])
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    if (dominant.length) {
      const fits = dominant.map((c) => seasonFit(c.oklch, colorSeason as Season));
      paletteFit = fits.reduce((a, b) => a + b, 0) / fits.length;
    }
  }

  return { value: tagFit * 0.55 + paletteFit * 0.45 };
}

// ---------------------------------------------------------------------------
// Freshness
// ---------------------------------------------------------------------------

const DAY = 86_400_000;

/**
 * Discourage repeats and surface neglected pieces.
 *
 * The second half matters commercially: "you have not worn this in four months"
 * is the moment the app justifies its existence, and it is the same signal the
 * shopping engine later uses to avoid recommending more of what already sits
 * unworn.
 */
export function freshnessRule(items: Garment[], now: number): Rule {
  const substantial = items.filter((g) => g.visualWeight >= 0.1);
  if (!substantial.length) return { value: 0.6 };

  let total = 0;
  let neglected = 0;

  for (const g of substantial) {
    // Never-worn is not the same as neglected. A brand-new closet is entirely
    // never-worn, and telling someone they have not reached for a shirt they
    // have owned for a day is the kind of detail that makes an app feel fake.
    if (g.lastWornAt === null) {
      total += 0.9;
      continue;
    }
    const days = (now - g.lastWornAt) / DAY;
    if (days < 1.5) total += 0.05;
    else if (days < 4) total += 0.35;
    else if (days < 8) total += 0.7;
    else if (days < 30) total += 0.95;
    else {
      total += 1;
      neglected++;
    }
  }

  const value = total / substantial.length;
  const note =
    neglected >= 2 ? 'pieces you have not reached for in a while' : undefined;

  return { value, note };
}

// ---------------------------------------------------------------------------
// Multi-event days
// ---------------------------------------------------------------------------

/**
 * The differentiator: one outfit that survives every event on the day.
 *
 * Scored as the WORST event fit rather than the average, because an outfit that
 * is perfect for brunch and unacceptable at the client dinner has failed. An
 * average would happily hand back exactly that and call it a 0.7.
 */
export function multiEventRule(items: Garment[], events: EventContext[]): Rule {
  if (events.length < 2) return { value: 1 };

  const fits = events.map((e) => formalityRule(items, e.formality).value);
  const worst = Math.min(...fits);
  const spread = Math.max(...events.map((e) => e.formality)) - Math.min(...events.map((e) => e.formality));

  const note =
    worst > 0.7 && spread >= 2
      ? `works from ${events[0]!.title.toLowerCase()} through to ${events[events.length - 1]!.title.toLowerCase()}`
      : undefined;

  return { value: worst, note };
}

/**
 * Which single piece, added or removed, best bridges a formality gap.
 *
 * This is what turns "here is one compromise outfit" into "wear this, then swap
 * the jacket" — the answer people actually want on a multi-event day.
 */
export function suggestSwap(
  base: Garment[],
  wardrobe: Garment[],
  events: EventContext[],
): { item: Garment; forEvent: EventContext } | null {
  if (events.length < 2) return null;

  const formalities = events.map((e) => e.formality);
  const spread = Math.max(...formalities) - Math.min(...formalities);
  if (spread < 1.5) return null;

  const dressiest = events.reduce((a, b) => (b.formality > a.formality ? b : a));
  const baseIds = new Set(base.map((g) => g.id));

  // Layers and shoes are what people realistically carry and change.
  const swappable = wardrobe.filter(
    (g) => !baseIds.has(g.id) && (g.slot === 'outerwear' || g.slot === 'mid_layer' || g.slot === 'footwear'),
  );

  let best: { item: Garment; gain: number } | null = null;
  const without = (slot: Garment['slot']) => base.filter((g) => g.slot !== slot);

  for (const candidate of swappable) {
    const swapped = [...without(candidate.slot), candidate];
    const gain =
      formalityRule(swapped, dressiest.formality).value -
      formalityRule(base, dressiest.formality).value;
    if (gain > 0.12 && (!best || gain > best.gain)) best = { item: candidate, gain };
  }

  return best ? { item: best.item, forEvent: dressiest } : null;
}

/** Convenience: derive the target formality when the caller did not supply one. */
export function resolveTargetFormality(ctx: StyleContext): number | null {
  if (ctx.targetFormality !== null) return ctx.targetFormality;
  if (!ctx.events.length) return null;
  // The dressiest commitment sets the floor for a single-outfit day.
  return Math.max(...ctx.events.map((e) => e.formality));
}
