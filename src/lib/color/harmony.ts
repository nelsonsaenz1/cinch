/**
 * Colour harmony scoring for garment pairs and whole outfits.
 *
 * The classical schemes (complementary / analogous / triadic) are the starting
 * point, not the whole model. Three refinements matter more in practice, and
 * they are the reason this scores real outfits better than a colour wheel does:
 *
 * 1. THE DISCORD ZONE. Hue distances around 60-100 degrees are the genuinely
 *    bad ones. They are too far apart to read as a deliberate analogous run and
 *    too close to read as deliberate contrast, so the eye files them as an
 *    accident. Red with orange is fine. Red with green is a statement. Red with
 *    yellow-green is a mistake. A naive wheel treats the third as "no scheme,
 *    neutral score" — it deserves an active penalty.
 *
 * 2. NEAR-MISS IS WORSE THAN EITHER MATCH OR CONTRAST. Two blacks that are
 *    really charcoal and navy, or two navies from different dye lots, look like
 *    a failed attempt to match. Perceptual distance has a *valley*: identical
 *    is good, clearly different is good, slightly different is the worst
 *    outcome. Only a perceptually uniform space can locate that valley
 *    reliably, which is the practical payoff of using OKLCH.
 *
 * 3. CHROMA DISCIPLINE IS A WHOLE-OUTFIT PROPERTY. Two vivid colours can work.
 *    Four cannot, regardless of their hue relationships. This is scored across
 *    the outfit rather than pairwise, because no pairwise function can see it.
 */

import { neutrality, type GarmentColor } from './families';
import { deltaE, hueDistance, type Oklch } from './oklch';

export type HarmonyLabel =
  | 'monochrome'
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triadic'
  | 'neutral-anchored'
  | 'metallic-accent'
  | 'discord'
  | 'near-miss';

export type PairHarmony = {
  /** 0..1, where 0.5 is "unremarkable but fine". */
  score: number;
  label: HarmonyLabel;
};

/** Chroma above this reads as an assertive colour rather than a muted one. */
const VIVID = 0.13;

/**
 * Harmony between two garment colours.
 *
 * Returns a score in 0..1 and the scheme that explains it. The label is not
 * decoration — it is surfaced in the outfit's reasoning ("navy and rust are
 * complementary"), so it has to be honest about which rule actually fired.
 */
export function pairHarmony(a: GarmentColor, b: GarmentColor): PairHarmony {
  // Metallics are accents. They coexist with anything, which is why gold
  // hardware and silver zips never enter the clash calculation.
  if (a.metallic || b.metallic) return { score: 0.72, label: 'metallic-accent' };

  const dh = hueDistance(a.oklch.h, b.oklch.h);
  const dE = deltaE(a.oklch, b.oklch);

  // The near-miss valley, tested FIRST and mainly on perceptual distance.
  //
  // Ordering matters: the worst offenders are navy-with-black and
  // charcoal-with-navy, and both would be waved through by the neutral rule
  // below if it ran first. Hue is deliberately not consulted — it is undefined
  // for achromatic colours, and navy against black is precisely the case that
  // needs catching. Perceptual distance separates "the same colour" (below the
  // valley) from "deliberately different" (above it).
  //
  // The chroma guard is what stops it over-firing. A near-miss is two attempts
  // at the SAME colour that landed slightly apart. When one side is vivid and
  // the other muted — mustard against sage — the difference reads as intended
  // tonal dressing, however close the two sit overall.
  const dC = Math.abs(a.oklch.C - b.oklch.C);
  if (dE > 0.04 && dE < 0.14 && dC < 0.06) return { score: 0.3, label: 'near-miss' };

  const an = a.neutrality;
  const bn = b.neutrality;
  const maxNeutral = Math.max(an, bn);

  // A neutral on either side resolves almost everything. Two neutrals together
  // are safe but unexciting; a neutral plus a colour is the single most common
  // well-dressed pairing there is, so it scores higher than two neutrals.
  if (maxNeutral > 0.72) {
    if (Math.min(an, bn) > 0.72) {
      // Two neutrals that both carry a tint are a real scheme, not merely two
      // safe choices, and scoring them as "unremarkable" is what would make the
      // engine blind to the best combinations in the language of clothes.
      const bothTinted = a.oklch.C > 0.03 && b.oklch.C > 0.03;
      if (bothTinted) {
        // Olive with camel, stone with taupe.
        if (dh < 60) return { score: 0.8, label: 'analogous' };
        // Navy with camel, charcoal with beige — the blue/orange axis muted
        // down until both sides read as neutral. Complementary logic still
        // applies underneath, and this is as reliable as clothing gets.
        if (dh > 120) return { score: 0.86, label: 'complementary' };
      }
      return { score: 0.7, label: 'neutral-anchored' };
    }
    return { score: 0.82, label: 'neutral-anchored' };
  }

  let score: number;
  let label: HarmonyLabel;

  if (dh < 12) {
    // Same hue family. Reads intentional when values separate, flat when not.
    const dL = Math.abs(a.oklch.L - b.oklch.L);
    score = dL > 0.18 ? 0.86 : 0.62;
    label = 'monochrome';
  } else if (dh < 48) {
    score = 0.8;
    label = 'analogous';
  } else if (dh < 72) {
    // Leaving analogous territory, not yet anywhere useful.
    score = 0.52;
    label = 'analogous';
  } else if (dh < 104) {
    score = 0.28;
    label = 'discord';
  } else if (dh < 136) {
    score = 0.68;
    label = 'triadic';
  } else if (dh < 160) {
    score = 0.74;
    label = 'split-complementary';
  } else {
    score = 0.8;
    label = 'complementary';
  }

  // Chroma tension. High-contrast schemes only stay wearable when at least one
  // side yields — muted, or small. Two vivid complementaries is a traffic cone.
  if (dh > 100 && a.oklch.C > VIVID && b.oklch.C > VIVID) {
    const minWeight = Math.min(a.weight, b.weight);
    // A small accent is allowed to be loud; a full panel is not.
    const relief = minWeight < 0.2 ? 0.9 : 0.62;
    score *= relief;
  }

  // Value contrast rescue: even a discordant hue pair reads as deliberate when
  // the values are far apart, because the eye reads it as light-vs-dark first.
  const dL = Math.abs(a.oklch.L - b.oklch.L);
  if (label === 'discord' && dL > 0.35) score = Math.min(1, score + 0.18);

  return { score: Math.max(0, Math.min(1, score)), label };
}

export type PaletteAnalysis = {
  /** Mean pairwise harmony, weighted by how much of the outfit each colour covers. */
  cohesion: number;
  /** Value spread across the outfit. Flat outfits read as pyjamas. */
  valueContrast: number;
  /** Penalty in 0..1 (1 = disciplined) for how many loud colours are present. */
  chromaDiscipline: number;
  /** True when at least one substantial piece anchors the look. */
  hasNeutralAnchor: boolean;
  /** Schemes that fired, most significant first — used to explain the outfit. */
  labels: HarmonyLabel[];
  /** Combined 0..1. */
  score: number;
};

/**
 * Score the palette of a whole outfit.
 *
 * `pieces` is one entry per garment: its dominant colours plus how visually
 * large that garment is (a coat dominates a look; a belt does not).
 */
export function analyzePalette(
  pieces: { colors: GarmentColor[]; visualWeight: number }[],
): PaletteAnalysis {
  // Collapse each garment to its dominant colour, scaled by garment size. Using
  // every trim colour pairwise explodes the comparison count and drowns the
  // signal in noise from piping and logos.
  const dominant = pieces
    .map((p) => ({ color: p.colors[0], weight: p.visualWeight }))
    .filter((p): p is { color: GarmentColor; weight: number } => Boolean(p.color));

  if (dominant.length < 2) {
    return {
      cohesion: 0.6,
      valueContrast: 0.5,
      chromaDiscipline: 1,
      hasNeutralAnchor: dominant.some((d) => d.color.neutrality > 0.7),
      labels: [],
      score: 0.6,
    };
  }

  let weighted = 0;
  let weightSum = 0;
  const labelCounts = new Map<HarmonyLabel, number>();

  for (let i = 0; i < dominant.length; i++) {
    for (let j = i + 1; j < dominant.length; j++) {
      const a = dominant[i]!;
      const b = dominant[j]!;
      const { score, label } = pairHarmony(
        { ...a.color, weight: a.weight },
        { ...b.color, weight: b.weight },
      );
      const w = a.weight * b.weight;
      weighted += score * w;
      weightSum += w;
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
  }

  const cohesion = weightSum > 0 ? weighted / weightSum : 0.6;

  // Value contrast. Mapped to a preference curve rather than "more is better":
  // no contrast is flat, extreme contrast is harsh, the middle is tailored.
  const Ls = dominant.map((d) => d.color.oklch.L);
  const spread = Math.max(...Ls) - Math.min(...Ls);
  const valueContrast =
    spread < 0.1
      ? 0.35 + spread * 2 // flat
      : spread < 0.5
        ? 1 - Math.abs(spread - 0.32) * 0.6 // the good band
        : Math.max(0.55, 1 - (spread - 0.5) * 0.5); // stark but deliberate

  // Chroma discipline. One statement colour is a focal point; two is a scheme;
  // three or more is noise.
  const loud = dominant.filter(
    (d) => d.color.oklch.C > VIVID && d.color.neutrality < 0.5 && d.weight > 0.15,
  ).length;
  const chromaDiscipline = loud <= 1 ? 1 : loud === 2 ? 0.82 : Math.max(0.3, 1 - (loud - 1) * 0.28);

  const hasNeutralAnchor = dominant.some((d) => d.color.neutrality > 0.7 && d.weight > 0.2);

  const labels = [...labelCounts.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([label]) => label);

  const score =
    cohesion * 0.5 + valueContrast * 0.24 + chromaDiscipline * 0.2 + (hasNeutralAnchor ? 0.06 : 0);

  return {
    cohesion,
    valueContrast,
    chromaDiscipline,
    hasNeutralAnchor,
    labels,
    score: Math.max(0, Math.min(1, score)),
  };
}

/** Convenience for the shopping engine: how well a candidate colour joins a palette. */
export function fitToPalette(candidate: Oklch, existing: GarmentColor[]): number {
  if (!existing.length) return 0.6;
  const c: GarmentColor = {
    oklch: candidate,
    name: '',
    family: 'neutral',
    neutrality: neutrality(candidate),
    metallic: false,
    weight: 0.5,
  };
  const scores = existing.map((e) => pairHarmony(c, e).score);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
