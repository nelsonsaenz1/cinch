/**
 * The recreate unit's shared vocabulary.
 *
 * `InspirationPiece` is the analyze-inspiration Edge Function's response
 * shape, kept in step BY HAND with `supabase/functions/_shared/
 * inspiration-schema.ts` — the same arrangement, for the same bundling
 * reason, as `schemas/item.ts` and `tag-schema.ts`: Supabase bundles only
 * `supabase/functions/` on deploy, so nothing here can be imported there.
 * Where the two drift, the FUNCTION wins; this file describes what actually
 * comes down the wire.
 *
 * No runtime dependency below the type layer — the node test suite imports
 * this alongside `match.ts`.
 */

import type { Garment, Slot } from '@/lib/styling';

/** One piece the model read out of the photograph. */
export type InspirationPiece = {
  category: string;
  subcategory: string;
  colorNames: string[];
  pattern: string | null;
  patternScale: string;
  formalityScore: number;
  description: string;
};

/**
 * One piece of the inspiration, answered from the closet.
 *
 * `item` is null when nothing in the closet clears the threshold — the
 * honest gap the feature promises instead of a forced recommendation. The
 * confidence rides along so the screen can grade its own language ("your
 * version" vs "closest you own") without re-deriving the number.
 */
export type PieceMatch = {
  piece: InspirationPiece;
  /** Where the piece sits in a look — derived once, reused by the screen. */
  slot: Slot;
  item: Garment | null;
  /** 0..1. Meaningful only when `item` is present. */
  confidence: number;
};

export type RecreateResult = {
  matches: PieceMatch[];
  /** Matched garments in piece order — what a save writes to outfit_items. */
  matchedItems: Garment[];
  gapCount: number;
};
