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
