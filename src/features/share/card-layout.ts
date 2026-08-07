import type { Garment } from '@/lib/styling';

/**
 * THE SHARE CARD'S COMPOSITION, AS DATA.
 *
 * This module is deliberately pure — no React, no react-native — for one
 * reason: it is the only part of the card that can be unit-tested. The card
 * itself is a captured image, so its geometry has no assertions available to
 * it beyond "does the PNG look right", and the numbers below are transcribed
 * from a design atlas by hand. Transcription is exactly the kind of work that
 * goes wrong silently, so the fractions live here where a test can check that
 * every tile stays inside the box and every composition's declared height is
 * honest.
 *
 * It also does NOT reuse the in-app stack (`stackLayout` in garment-cell.tsx).
 * That composition is the body-ordered overlap of transparent cutouts — a look
 * as worn. The atlas prints something else: a staggered collage of role-sized
 * photographs, no two edges aligned, which is what survives being seen at
 * thumbnail size in a share sheet. Two different pictures for two different
 * purposes, so two different tables.
 */

/** One tile's box, as fractions of the stack box's WIDTH — including `y`. */
export type CardSlot = { x: number; y: number; size: number };

/**
 * A whole composition. `height` is also a fraction of the box WIDTH, so the
 * caller can scale the block uniformly into whatever height the type above it
 * happens to leave — the composition never needs to know the canvas.
 */
export type CardComposition = { slots: CardSlot[]; height: number };

/** "Five garments at most" — the atlas's rule, and the reason for the cap. */
const MAX_TILES = 5;

/**
 * The five-piece composition, transcribed VERBATIM from the atlas.
 *
 * Its stack box is 920 design px wide (the 1080 canvas less its 80px margins)
 * and the tiles occupy 1034px of height, so every number here is the atlas's
 * own pixel divided by 920:
 *
 *   left:0   top:24  480x480
 *   left:40  top:544 440x440
 *   left:520 top:0   400x400
 *   left:480 top:372 330x330
 *   left:560 top:734 300x300
 *
 * The order is SIZE-DESCENDING on purpose: slot i receives the i-th most
 * significant garment, so the coat is always the biggest photograph on the
 * card and the belt is always the smallest.
 */
const FIVE: CardComposition = {
  slots: [
    { x: 0, y: 0.02609, size: 0.52174 },
    { x: 0.04348, y: 0.5913, size: 0.47826 },
    { x: 0.56522, y: 0, size: 0.43478 },
    { x: 0.52174, y: 0.40435, size: 0.3587 },
    { x: 0.6087, y: 0.79783, size: 0.32609 },
  ],
  height: 1.12391,
};

/**
 * Compositions for fewer pieces.
 *
 * The atlas draws only the five-garment case. These four are EXTRAPOLATED from
 * it rather than transcribed, and they are written out longhand rather than
 * derived by dropping tiles because "drop the last slot" leaves a hole in the
 * lower right and the box stops reading as a composition. Each one keeps the
 * atlas's language: staggered, size-ranked, no two edges aligned, and the full
 * measure used — a two-piece look must still fill the card's width or the
 * paper around it reads as a mistake rather than as margin.
 */
const COMPOSITIONS: Record<number, CardComposition> = {
  1: { slots: [{ x: 0.14, y: 0, size: 0.72 }], height: 0.72 },
  2: {
    slots: [
      { x: 0, y: 0.06, size: 0.56 },
      { x: 0.46, y: 0.5, size: 0.54 },
    ],
    height: 1.04,
  },
  3: {
    slots: [
      { x: 0, y: 0.04, size: 0.52 },
      { x: 0.06, y: 0.6, size: 0.46 },
      { x: 0.56, y: 0.2, size: 0.44 },
    ],
    height: 1.06,
  },
  4: {
    // The five-piece case with its smallest tile removed, and nothing else
    // moved — the four that remain already stagger, so re-tuning them would
    // only drift away from the transcription for no gain.
    slots: FIVE.slots.slice(0, 4),
    height: 1.06957,
  },
  5: FIVE,
};

/**
 * Significance order, most significant first — which is also SIZE order, per
 * the atlas: "outerwear largest, accessories smallest". A dress outranks a
 * bottom because it is the look; a bag outranks nothing much, and when a
 * six-piece outfit has to lose a tile this is the order it loses them in.
 */
export const ROLE_RANK: Record<Garment['slot'], number> = {
  outerwear: 0,
  dress: 1,
  bottom: 2,
  mid_layer: 3,
  base_top: 4,
  footwear: 5,
  headwear: 6,
  bag: 7,
  accessory: 8,
};

/** Order pieces the way a look is read aloud: outer layers, then core, then feet. */
const LAYOUT_ORDER: Garment['slot'][] = [
  'outerwear',
  'mid_layer',
  'base_top',
  'dress',
  'bottom',
  'footwear',
  'bag',
  'accessory',
  'headwear',
];

/**
 * The tiles, zipped to their garments.
 *
 * Ties break on `id` rather than on input order because the card is captured
 * off-screen and shared: the same outfit must produce the same picture every
 * time it is rendered, and the pieces arrive from a query whose order is not
 * guaranteed. A card that reshuffles between two shares of the same look would
 * be a bug nobody could reproduce.
 */
export function cardStack(pieces: Garment[]): { garment: Garment; slot: CardSlot }[] {
  const ranked = [...pieces].sort(
    (a, b) => ROLE_RANK[a.slot] - ROLE_RANK[b.slot] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const kept = ranked.slice(0, MAX_TILES);
  const composition = COMPOSITIONS[kept.length];
  if (!composition) return [];
  return kept.map((garment, i) => ({ garment, slot: composition.slots[i] }));
}

/**
 * How tall the block is, as a fraction of its width. The renderer needs this
 * BEFORE it lays anything out, to scale the composition into the height the
 * name and description left behind.
 */
export function cardStackHeight(count: number): number {
  return COMPOSITIONS[Math.min(count, MAX_TILES)]?.height ?? 0;
}

/**
 * The one sentence the card prints under the name.
 *
 * The stylist's reasoning runs to two or three sentences; the atlas prints
 * one. Taking the first SENTENCE rather than truncating to a character budget
 * is the whole point: this artifact leaves the phone and is seen by people who
 * have never heard of Cinch, and an ellipsis mid-thought reads as a broken
 * export. A shorter complete sentence never does.
 */
export function cardDescription(reasoning: string | null | undefined): string | null {
  const text = reasoning?.trim();
  if (!text) return null;
  return text.split(/(?<=[.!?])\s+/)[0]?.trim() || null;
}

/**
 * The piece list's order — the same body order the in-app plate reads its
 * garments in, so the card and the app can never disagree about a look.
 *
 * NOTE this is deliberately NOT the order the tiles are stacked in. Tiles are
 * ranked by role SIZE (the collage is composed), the list is ranked by where a
 * garment sits on the body (prose is read). They only look inconsistent if you
 * expect a lookbook page to be a table.
 */
export function cardPieceOrder(pieces: Garment[]): Garment[] {
  return [...pieces].sort((a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot));
}
