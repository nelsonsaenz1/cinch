/**
 * Accessory kinds — the vocabulary that lets two accessories share an outfit.
 *
 * The `accessory` SLOT is deliberately one bucket: the beam search does not
 * enumerate over accessories at all (see `addAccessories`), so slotting is
 * about search shape, not about what a person wears. But "one accessory,
 * ever" is the wrong rule at the attach stage — a watch and sunglasses are
 * not rivals, while two belts are. The rivalry runs along a finer line than
 * the slot: the KIND, recovered from the subcategory text the tagger already
 * writes.
 *
 * Same pattern, and the same fallback discipline, as `toSlot` in
 * `./garment.ts`: everything inferred from text lives here so the attach
 * logic stays arithmetic, and an unrecognised subcategory degrades to
 * `'other'` — which keeps the old one-accessory behaviour for exactly the
 * pieces we cannot tell apart.
 */

import type { Garment } from './types';

export type AccessoryKind =
  | 'jewelry'
  | 'belt'
  | 'sunglasses'
  | 'watch'
  | 'scarf'
  | 'gloves'
  | 'tie'
  | 'other';

/**
 * Longest-and-most-specific first, the lexicon's own rule: "watch cap" is
 * headwear and never reaches this function, but "watch strap" must not read
 * as a scarf because "strap" is nowhere in the list.
 */
const KIND_PATTERNS: [RegExp, AccessoryKind][] = [
  [/\b(sunglass(es)?|shades|eyewear|glasses)\b/i, 'sunglasses'],
  [/\b(watch(es)?|timepiece)\b/i, 'watch'],
  [/\b(belts?)\b/i, 'belt'],
  [/\b(scar(f|ves)|shawls?|wraps?|stoles?|bandanas?)\b/i, 'scarf'],
  [/\b(gloves?|mittens?)\b/i, 'gloves'],
  [/\b(ties?|bow.?ties?|neckties?|cravats?)\b/i, 'tie'],
  [
    /\b(necklaces?|pendants?|chains?|chokers?|lockets?|bracelets?|bangles?|earrings?|rings?|brooch(es)?|jewell?ery)\b/i,
    'jewelry',
  ],
];

/**
 * Which kind of accessory this is.
 *
 * The `jewelry` CATEGORY answers without reading text — it is a real database
 * enum value and the tagger's own decision. Everything filed under
 * `accessory` (and anything an unknown category degraded to the accessory
 * slot) is read from its subcategory.
 */
export function accessoryKind(g: Pick<Garment, 'category' | 'subcategory'>): AccessoryKind {
  if (g.category === 'jewelry') return 'jewelry';
  const sub = g.subcategory ?? '';
  for (const [re, kind] of KIND_PATTERNS) if (re.test(sub)) return kind;
  return 'other';
}

/**
 * The order kinds are OFFERED to an outfit, and the cap on how many land.
 *
 * Two, not "as many as improve the score": every accessory clears the same
 * improvement bar, so on a closet with six good ones an uncapped loop dresses
 * a Christmas tree one ornament at a time — each step defensible, the sum
 * absurd. Jewelry leads because it is the kind people most consistently mean
 * when they say "accessorise"; the rest is a stable order, not a ranking.
 */
export const ACCESSORY_KIND_ORDER: readonly AccessoryKind[] = [
  'jewelry',
  'belt',
  'watch',
  'sunglasses',
  'scarf',
  'tie',
  'gloves',
  'other',
];

export const MAX_ACCESSORIES_PER_OUTFIT = 2;
