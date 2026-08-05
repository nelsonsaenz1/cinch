/**
 * Shared fixtures for the unit tests.
 *
 * Deliberately hand-built rather than reusing `src/features/closet/fixtures.ts`
 * — those exist to make the closet grid look right in the simulator and will be
 * edited for design reasons. A test that fails because someone changed a
 * fixture's brand name is a test nobody trusts.
 */

import { toGarmentColors } from '../src/lib/color';
import type { Garment, Slot, StyleContext } from '../src/lib/styling';

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

let seq = 0;

/** Reset the id counter so ids are stable within a test file. */
export function resetIds() {
  seq = 0;
}

export function garment(
  slot: Slot,
  color: string,
  overrides: Partial<Garment> = {},
): Garment {
  return {
    id: `g${++seq}`,
    slot,
    category: 'other',
    subcategory: null,
    colors: toGarmentColors([{ name: color }]),
    visualWeight: VISUAL_WEIGHT[slot],
    fit: 'regular',
    pattern: null,
    patternScale: 'none',
    material: null,
    brand: null,
    formality: 3,
    warmth: 3,
    waterResistant: false,
    seasons: [],
    occasions: [],
    wearCount: 4,
    lastWornAt: null,
    purchasePrice: null,
    thumbPath: null,
    cutoutPath: null,
    platePath: null,
    ...overrides,
  };
}

/** A closet with every slot populated at least twice. */
export function smallCloset(): Garment[] {
  resetIds();
  return [
    garment('base_top', 'white', { warmth: 2, formality: 3 }),
    garment('base_top', 'navy', { warmth: 2, formality: 3 }),
    garment('bottom', 'charcoal', { warmth: 3, formality: 4 }),
    garment('bottom', 'denim', { warmth: 3, formality: 2 }),
    garment('footwear', 'black', { warmth: 2, formality: 4 }),
    garment('footwear', 'white', { warmth: 2, formality: 2 }),
    garment('mid_layer', 'camel', { warmth: 3 }),
    garment('mid_layer', 'grey', { warmth: 3 }),
    garment('outerwear', 'navy', { warmth: 5, waterResistant: true }),
    garment('outerwear', 'olive', { warmth: 4 }),
    garment('dress', 'burgundy', { warmth: 2, formality: 4 }),
    garment('bag', 'tan'),
    garment('accessory', 'grey', { warmth: 3 }),
  ];
}

/** Enough items that the beam search actually has to prune. */
export function largeCloset(perSlot = 24): Garment[] {
  resetIds();
  const palette = ['navy', 'white', 'charcoal', 'camel', 'olive', 'burgundy', 'grey', 'rust'];
  const slots: Slot[] = [
    'base_top', 'bottom', 'footwear', 'mid_layer', 'outerwear', 'dress', 'bag', 'accessory',
  ];
  const out: Garment[] = [];
  for (const slot of slots) {
    for (let i = 0; i < perSlot; i++) {
      out.push(
        garment(slot, palette[i % palette.length]!, {
          formality: (i % 5) + 1,
          warmth: (i % 5) + 1,
          wearCount: i,
        }),
      );
    }
  }
  return out;
}

export function context(overrides: Partial<StyleContext> = {}): StyleContext {
  return {
    weather: null,
    events: [],
    note: null,
    targetFormality: null,
    targetOccasion: null,
    season: null,
    colorSeason: null,
    now: Date.UTC(2026, 7, 4, 12, 0, 0),
    ...overrides,
  };
}

export const weather = (
  feelsLikeC: number,
  overrides: Partial<NonNullable<StyleContext['weather']>> = {},
): NonNullable<StyleContext['weather']> => ({
  feelsLikeC,
  highC: feelsLikeC + 3,
  lowC: feelsLikeC - 3,
  precipitationChance: 0,
  windKph: 0,
  swing: false,
  ...overrides,
});
