/**
 * Item row -> Garment projection.
 *
 * All the string-keyword inference lives here so that scoring stays arithmetic.
 * Anything inferred from text is a fallback: once the tagging model returns an
 * explicit `fit` and `pattern_scale` those columns win, and these heuristics
 * only cover items tagged before that shipped.
 */

import { toGarmentColors } from '@/lib/color';

import type { Fit, Garment, ItemRow, PatternScale, Slot } from './types';

/**
 * Share of the visual field, by slot. These are the numbers that make a coat
 * dominate a look and a bracelet not affect it — without them, palette scoring
 * lets one loud sock veto an otherwise excellent outfit.
 */
const VISUAL_WEIGHT: Record<Slot, number> = {
  dress: 0.42,
  outerwear: 0.34,
  bottom: 0.26,
  base_top: 0.22,
  mid_layer: 0.24,
  footwear: 0.12,
  bag: 0.06,
  headwear: 0.05,
  accessory: 0.04,
};

const MID_LAYER =
  /\b(sweater|jumper|cardigan|hoodie|sweatshirt|fleece|vest|gilet|overshirt|shacket|pullover|knit|turtleneck)\b/i;

const OUTERWEAR_TOP = /\b(blazer|sport coat|suit jacket)\b/i;

/**
 * Category alone cannot separate a t-shirt from a cardigan — both are `top`.
 * The layering distinction drives both the warmth sum and the volume rule, so
 * it has to be recovered from the subcategory text.
 */
export function toSlot(item: Pick<ItemRow, 'category' | 'subcategory'>): Slot {
  const sub = item.subcategory ?? '';

  switch (item.category) {
    case 'dress':
      return 'dress';
    case 'bottom':
      return 'bottom';
    case 'footwear':
      return 'footwear';
    case 'bag':
      return 'bag';
    case 'headwear':
      return 'headwear';
    case 'jewelry':
    case 'accessory':
      return 'accessory';
    case 'outerwear':
      return 'outerwear';
    case 'top':
      if (OUTERWEAR_TOP.test(sub)) return 'outerwear';
      return MID_LAYER.test(sub) ? 'mid_layer' : 'base_top';
    default:
      return 'accessory';
  }
}

const FIT_PATTERNS: [RegExp, Fit][] = [
  [/\b(oversized|baggy|balloon|extra wide|boxy)\b/i, 'oversized'],
  [/\b(relaxed|loose|wide[- ]?leg|wide|straight[- ]?leg|flowy|palazzo|barrel)\b/i, 'relaxed'],
  [/\b(slim|skinny|fitted|tapered|bodycon|cropped|slender|tailored)\b/i, 'fitted'],
];

export function inferFit(text: string): Fit {
  for (const [re, fit] of FIT_PATTERNS) if (re.test(text)) return fit;
  return 'regular';
}

const SCALE_PATTERNS: [RegExp, PatternScale][] = [
  [/\b(pinstripe|micro|hairline|birdseye|houndstooth)\b/i, 'micro'],
  [/\b(small|ditsy|polka|pin dot|fine)\b/i, 'small'],
  [/\b(large|bold|oversized|graphic|placement|statement)\b/i, 'large'],
];

const SOLID = /^(solid|plain|none|null)?$/i;

export function inferPatternScale(pattern: string | null, text: string): PatternScale {
  if (!pattern || SOLID.test(pattern.trim())) return 'none';
  const haystack = `${pattern} ${text}`;
  for (const [re, scale] of SCALE_PATTERNS) if (re.test(haystack)) return scale;
  // Stripes and checks read mid-scale by default; florals read large.
  if (/\b(floral|paisley|tie[- ]?dye|camo|abstract)\b/i.test(haystack)) return 'large';
  return 'medium';
}

/**
 * Materials that fail in rain regardless of the `water_resistant` flag, which
 * the model sets from appearance and gets wrong on exactly these.
 */
const RAIN_HOSTILE = /\b(suede|nubuck|silk|linen|velvet|satin|canvas|straw)\b/i;
export const isRainHostile = (material: string | null) => Boolean(material && RAIN_HOSTILE.test(material));

/** Optional columns added after the initial tagging model shipped. */
type ExtendedItem = ItemRow & {
  fit?: string | null;
  pattern_scale?: string | null;
};

export function toGarment(item: ItemRow): Garment {
  const slot = toSlot(item);
  const extended = item as ExtendedItem;
  const text = `${item.subcategory ?? ''} ${item.description ?? ''}`;

  const rawColors = Array.isArray(item.colors)
    ? (item.colors as { hex?: string | null; name?: string | null }[])
    : [];

  const fit = (extended.fit as Fit | null) ?? inferFit(text);
  const patternScale =
    (extended.pattern_scale as PatternScale | null) ?? inferPatternScale(item.pattern, text);

  return {
    id: item.id,
    slot,
    category: item.category,
    subcategory: item.subcategory,
    colors: toGarmentColors(rawColors),
    visualWeight: VISUAL_WEIGHT[slot],
    fit,
    pattern: item.pattern,
    patternScale,
    material: item.material,
    brand: item.brand,
    // Midpoints, not zeros: an untagged item should be treated as unremarkable,
    // not as maximally casual and freezing, which would distort every outfit
    // it appears in.
    formality: item.formality_score ?? 3,
    warmth: item.warmth_score ?? 2,
    waterResistant: item.water_resistant,
    seasons: item.seasons ?? [],
    occasions: item.occasions ?? [],
    wearCount: item.wear_count,
    lastWornAt: item.last_worn_at ? Date.parse(item.last_worn_at) : null,
    purchasePrice: item.purchase_price === null ? null : Number(item.purchase_price),
    thumbPath: item.thumb_path,
    cutoutPath: item.cutout_path,
    platePath: item.plate_path ?? null,
  };
}

/** Normalised visual weights for one candidate outfit. */
export function normalizedWeights(items: Garment[]): number[] {
  const total = items.reduce((sum, g) => sum + g.visualWeight, 0);
  return total > 0 ? items.map((g) => g.visualWeight / total) : items.map(() => 1 / items.length);
}
