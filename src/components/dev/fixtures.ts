import { resolveColorName } from '@/lib/color';
import type { Garment } from '@/lib/styling';

/**
 * DEV ONLY — fixture data behind the `dev-plate` and `dev-share` routes.
 *
 * The Plate normally exists behind auth + a populated closet, which makes
 * design iteration on it absurdly slow (sign in, add ten garments, wait for
 * generation). These fixtures let the signature component render signed-out.
 */

const g = (
  id: string,
  slot: Garment['slot'],
  colorName: string,
  category: string,
  subcategory: string,
  visualWeight: number,
  purchasePrice: number | null,
  wearCount: number,
): Garment =>
  ({
    id,
    slot,
    category,
    subcategory,
    colors: [{ name: colorName, oklch: resolveColorName(colorName)! }],
    visualWeight,
    purchasePrice,
    wearCount,
    warmth: 5,
    formality: 3,
    cutoutPath: null,
  platePath: null,
    thumbPath: null,
  }) as unknown as Garment;

export const FIXTURE_ITEMS: Garment[] = [
  g('1', 'outerwear', 'navy', 'outerwear', 'overcoat', 1.35, 289, 41),
  g('2', 'base_top', 'cream', 'top', 'crew knit', 1.0, 95, 62),
  g('3', 'bottom', 'camel', 'bottom', 'pleated trousers', 1.1, 120, 38),
  g('4', 'footwear', 'charcoal', 'shoes', 'derbies', 0.85, 210, 55),
  g('5', 'accessory', 'burgundy', 'accessory', 'scarf', 0.4, 45, 12),
];

export const FIXTURE_OUTFIT = {
  name: 'Quiet authority',
  reasoning:
    'Navy and camel anchor the look while the burgundy scarf picks up the warmth of the trousers. Structured enough for the dinner, soft enough for after.',
  swapNote: null,
  source: 'engine' as const,
  candidate: { items: FIXTURE_ITEMS, score: 0.87 },
} as never;

/**
 * DEV ONLY — behind `dev-repeat`.
 *
 * The canonical ten from the free-tier contract: 3 tops, 2 bottoms, 1 dress,
 * 2 shoes, 1 outerwear, 1 bag — 14 distinct cores by the same arithmetic
 * `outfit-count.ts` computes. The four garments that make up "Linen and
 * charcoal" are named for the exact pieces The Repeat State Atlas photographs
 * (white-linen-blouse, charcoal-tailored-trousers, brown-leather-loafers,
 * cognac-leather-tote), so the dev route reads as the same outfit the atlas
 * shows rather than a stand-in.
 */
export const FIXTURE_REPEAT_WARDROBE: Garment[] = [
  g('r1', 'base_top', 'white', 'top', 'linen blouse', 1.0, 68, 5),
  g('r2', 'base_top', 'ivory', 'top', 'silk shell', 0.95, 88, 3),
  g('r3', 'mid_layer', 'cream', 'top', 'mohair jumper', 1.05, 120, 4),
  g('r4', 'bottom', 'charcoal', 'bottom', 'tailored trousers', 1.1, 140, 6),
  g('r5', 'bottom', 'denim', 'bottom', 'straight jeans', 1.1, 95, 8),
  g('r6', 'dress', 'olive', 'dress', 'wrap dress', 1.3, 160, 2),
  g('r7', 'footwear', 'brown', 'shoes', 'leather loafers', 0.85, 210, 9),
  g('r8', 'footwear', 'black', 'shoes', 'ankle boots', 0.85, 240, 3),
  g('r9', 'outerwear', 'navy', 'outerwear', 'wool coat', 1.35, 320, 4),
  g('r10', 'bag', 'cognac', 'bag', 'leather tote', 0.4, 180, 20),
];

/** "Linen and charcoal" — blouse, trousers, loafers, tote. The repeating look. */
export const FIXTURE_REPEAT_OUTFIT = {
  name: 'Linen and charcoal',
  reasoning: 'White linen and charcoal wool read clean together, and the loafers keep it easy.',
  swapNote: null,
  source: 'engine' as const,
  candidate: {
    items: FIXTURE_REPEAT_WARDROBE.filter((item) => ['r1', 'r4', 'r7', 'r10'].includes(item.id)),
    score: 0.91,
  },
} as never;
