/**
 * 12-season personal colour analysis.
 *
 * The professional system rates a person on three axes — undertone (warm/cool),
 * value (light/deep), and chroma (clear/soft) — and the twelve seasons are
 * positions in that space. The classic four seasons are too coarse: they force
 * anyone with a neutral undertone into a nearest match that does not actually
 * flatter them.
 *
 * Encoding choice: seasons are stored as REGIONS in OKLCH, not as swatch lists.
 * Every commercial palette is a list of 30-40 hex chips, which cannot answer
 * "is this particular olive good for a Soft Autumn" unless that exact olive is
 * on the list. A region generalises to any colour, needs no lookup table, and
 * degrades gracefully. Since the three professional axes map almost directly
 * onto OKLCH's own axes, the translation is close to lossless.
 *
 * This is scored as a soft preference, never a filter. Nobody wants an app that
 * refuses to show them a shirt they own and like.
 */

import type { Oklch } from './oklch';

export type Season =
  | 'light_spring'
  | 'warm_spring'
  | 'clear_spring'
  | 'light_summer'
  | 'cool_summer'
  | 'soft_summer'
  | 'soft_autumn'
  | 'warm_autumn'
  | 'deep_autumn'
  | 'deep_winter'
  | 'cool_winter'
  | 'clear_winter';

/**
 * Undertone as a continuous -1 (cool) .. +1 (warm) scalar.
 *
 * A cosine centred on OKLCH hue 70 (the golden/peach axis) peaks on warm and
 * troughs at 250 (the blue/rose axis). Continuous beats bucketing because
 * undertone genuinely is a gradient — that is the entire reason the 12-season
 * system exists.
 */
export const warmth = (h: number): number => Math.cos(((h - 70) * Math.PI) / 180);

type SeasonProfile = {
  /** Target undertone, -1..1. */
  warmth: number;
  /** Target lightness band in OKLCH L. */
  L: [number, number];
  /** Target chroma band. */
  C: [number, number];
  label: string;
  /** How the season is usually described, for user-facing copy. */
  blurb: string;
};

export const SEASONS: Record<Season, SeasonProfile> = {
  light_spring: {
    warmth: 0.55, L: [0.68, 0.92], C: [0.06, 0.15],
    label: 'Light Spring',
    blurb: 'Warm and delicate — peach, coral, aqua, light camel.',
  },
  warm_spring: {
    warmth: 0.9, L: [0.55, 0.82], C: [0.11, 0.22],
    label: 'Warm Spring',
    blurb: 'Golden and lively — mustard, warm green, coral, ivory.',
  },
  clear_spring: {
    warmth: 0.35, L: [0.5, 0.82], C: [0.16, 0.3],
    label: 'Clear Spring',
    blurb: 'Bright and high-contrast — true red, turquoise, bright navy.',
  },
  light_summer: {
    warmth: -0.4, L: [0.7, 0.93], C: [0.04, 0.12],
    label: 'Light Summer',
    blurb: 'Cool and soft — powder blue, rose, soft grey, cool ivory.',
  },
  cool_summer: {
    warmth: -0.85, L: [0.5, 0.8], C: [0.07, 0.16],
    label: 'Cool Summer',
    blurb: 'Cool and gentle — slate blue, mauve, soft navy, cool pink.',
  },
  soft_summer: {
    warmth: -0.35, L: [0.45, 0.75], C: [0.03, 0.1],
    label: 'Soft Summer',
    blurb: 'Muted and blended — sage, dusty rose, taupe, denim.',
  },
  soft_autumn: {
    warmth: 0.4, L: [0.42, 0.72], C: [0.04, 0.12],
    label: 'Soft Autumn',
    blurb: 'Muted and warm — moss, camel, terracotta, soft olive.',
  },
  warm_autumn: {
    warmth: 0.92, L: [0.35, 0.65], C: [0.1, 0.2],
    label: 'Warm Autumn',
    blurb: 'Rich and earthy — rust, olive, mustard, chocolate, cream.',
  },
  deep_autumn: {
    warmth: 0.6, L: [0.2, 0.5], C: [0.08, 0.19],
    label: 'Deep Autumn',
    blurb: 'Deep and warm — espresso, forest, burgundy, burnt orange.',
  },
  deep_winter: {
    warmth: -0.5, L: [0.15, 0.45], C: [0.08, 0.2],
    label: 'Deep Winter',
    blurb: 'Deep and cool — black, charcoal, pine, wine, icy white.',
  },
  cool_winter: {
    warmth: -0.9, L: [0.25, 0.7], C: [0.1, 0.22],
    label: 'Cool Winter',
    blurb: 'Cool and striking — true blue, emerald, magenta, pure white.',
  },
  clear_winter: {
    warmth: -0.3, L: [0.2, 0.75], C: [0.17, 0.32],
    label: 'Clear Winter',
    blurb: 'Vivid and high-contrast — black, scarlet, cobalt, stark white.',
  },
};

const bandFit = (v: number, [lo, hi]: [number, number], slack: number): number => {
  if (v >= lo && v <= hi) return 1;
  const d = v < lo ? lo - v : v - hi;
  return Math.max(0, 1 - d / slack);
};

/**
 * How well a colour suits a season, 0..1.
 *
 * Near-neutrals are held close to 1 regardless. Black, white and grey are not
 * "unflattering for Warm Autumn" in any way that should stop the app from
 * suggesting a user's own black jeans — the seasonal system speaks to colours
 * worn near the face, and the engine has no idea which garment that is.
 */
export function seasonFit(color: Oklch, season: Season | null | undefined): number {
  if (!season) return 1;
  const profile = SEASONS[season];
  if (!profile) return 1;

  if (color.C < 0.045) return 0.95;

  const w = warmth(color.h);
  // Undertone is the axis a mismatch is most visible on, so it is weighted
  // hardest and given the least slack.
  const warmFit = Math.max(0, 1 - Math.abs(w - profile.warmth) / 1.6);
  const valueFit = bandFit(color.L, profile.L, 0.3);
  const chromaFit = bandFit(color.C, profile.C, 0.14);

  return warmFit * 0.45 + valueFit * 0.28 + chromaFit * 0.27;
}

/**
 * Infer a season from a small set of colours the user says they look good in.
 *
 * Available for a future colour-season prompt; no screen calls it yet, which asks the user to pick flattering shades
 * rather than to self-diagnose an undertone — people are unreliable at the
 * latter and perfectly good at the former.
 */
export function inferSeason(flattering: Oklch[]): Season | null {
  if (flattering.length < 3) return null;

  let best: Season | null = null;
  let bestScore = -Infinity;

  for (const key of Object.keys(SEASONS) as Season[]) {
    const total = flattering.reduce((sum, c) => sum + seasonFit(c, key), 0);
    if (total > bestScore) {
      bestScore = total;
      best = key;
    }
  }
  return best;
}
