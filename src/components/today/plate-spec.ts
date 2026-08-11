import { oklchToHex } from '@/lib/color/oklch';
import { motion } from '@/theme/metrics';

import type { Garment } from '@/lib/styling/types';

/**
 * The plate's drawing decisions, as data. Audit item 49.
 *
 * `plate.tsx` is 800 lines of Skia, Reanimated and gesture handling, almost
 * none of which is testable outside a device. These three are the exceptions:
 * they decide what the plate SAYS rather than how it animates, and each is a
 * pure function of the look.
 *
 * `paletteDots` is the one that matters. The footer prints the real garment
 * colours the engine actually scored — so a bug here does not misdraw a
 * decoration, it misreports the outfit. Two of its rules are easy to lose in a
 * refactor and impossible to see in a screenshot:
 *
 *   - a piece under 0.1 visual weight claims no colour slot (a belt does not
 *     take the coat's dot);
 *   - duplicates collapse, so a navy-on-navy look prints one dot, not two.
 */

/** Tile corner radius, for the non-cutout regime. */
export const TILE_RADIUS = 12;

/**
 * The warm contact shadow, one definition for both regimes. On a plate Skia
 * derives it from the cutout's ALPHA, so a coat casts a coat-shaped shadow; on
 * a tile iOS derives it from the rounded rect. Same light either way.
 */
export const CONTACT = { dx: 0, dy: 5, blur: 11, color: 'rgba(28,26,22,0.16)' } as const;

/** How many colour dots the footer will ever print. */
export const MAX_PALETTE_DOTS = 5;

/** Below this, a piece is furniture and claims no colour slot. */
export const PALETTE_WEIGHT_FLOOR = 0.1;

/** The stagger — piece n lands one `motion.stagger` after piece n-1. */
export const landingDelay = (index: number) => 120 + index * motion.stagger;

/**
 * The look's palette, as the swatch dots the footer prints: the real garment
 * colours the engine scored, deduplicated, weighted, and capped.
 */
export function paletteDots(pieces: Garment[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of pieces) {
    if (g.visualWeight < PALETTE_WEIGHT_FLOOR) continue;
    const c = g.colors[0];
    if (!c) continue;
    const hex = oklchToHex(c.oklch);
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
    if (out.length >= MAX_PALETTE_DOTS) break;
  }
  return out;
}
