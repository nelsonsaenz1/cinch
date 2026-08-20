/**
 * The inspiration-analysis schema — what one screenshot of an outfit becomes.
 *
 * The model's ONLY job is to read the photograph into structured pieces:
 * category, kind, colours, pattern, formality. It never sees the closet, so
 * it cannot recommend, substitute, or hallucinate a garment the user owns —
 * the matching against the actual closet is arithmetic and runs on the
 * device (`features/recreate/match.ts`), the same division of labour the
 * outfit re-ranker argues for in `outfit-schema.ts`.
 *
 * Same strict-mode rules as `tag-schema.ts`: every property required
 * (nullable, not optional), `additionalProperties: false` everywhere, ranges
 * enforced in code after parsing. Colour hex is deliberately absent for the
 * tagger's own documented reason — names from the model, pixels never.
 */

import { CATEGORIES, PATTERN_SCALES } from './tag-schema.ts';

/** More than this is a collage, not an outfit. Enforced in normalize. */
export const MAX_PIECES = 8;

export const inspirationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pieces'],
  properties: {
    pieces: {
      type: 'array',
      description:
        'Every distinct garment or accessory clearly visible in the outfit, most visually dominant first. At most eight.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'category',
          'subcategory',
          'colorNames',
          'pattern',
          'patternScale',
          'formalityScore',
          'description',
        ],
        properties: {
          category: { type: 'string', enum: CATEGORIES },
          subcategory: {
            type: 'string',
            description:
              'Specific type, e.g. "pleated midi skirt", "leather belt", "aviator sunglasses". For an accessory, NAME THE KIND plainly — the matcher reads it.',
          },
          colorNames: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Dominant colours as plain names, most prominent first, at most three.',
          },
          pattern: {
            type: ['string', 'null'],
            description: 'e.g. "solid", "striped", "floral". Null if unclear.',
          },
          patternScale: {
            type: 'string',
            enum: PATTERN_SCALES,
            description: '"none" for solids; a pinstripe is micro, a large floral is large.',
          },
          formalityScore: {
            type: 'integer',
            description: '1 = loungewear, 3 = smart casual, 5 = black tie.',
          },
          description: {
            type: 'string',
            description:
              'One plain sentence a stylist would use to name this piece to a client. No more than 120 characters.',
          },
        },
      },
    },
  },
} as const;

export type InspirationPieceResult = {
  category: (typeof CATEGORIES)[number];
  subcategory: string;
  colorNames: string[];
  pattern: string | null;
  patternScale: (typeof PATTERN_SCALES)[number];
  formalityScore: number;
  description: string;
};

export type InspirationResult = { pieces: InspirationPieceResult[] };

/**
 * Post-parse clamps, the tagger's own policy: coerce what is merely out of
 * range, keep the answer. A piece whose category drifted off the enum is
 * DROPPED rather than guessed — a wrong category sends the matcher shopping
 * in the wrong half of the closet, which is worse than one missing piece.
 */
export function normalizeInspiration(raw: InspirationResult): InspirationResult {
  const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(Number(n) || 3)));
  const pieces = (raw.pieces ?? [])
    .filter((p) => (CATEGORIES as readonly string[]).includes(p?.category))
    .slice(0, MAX_PIECES)
    .map((p) => ({
      category: p.category,
      subcategory: (p.subcategory ?? '').slice(0, 80),
      colorNames: (p.colorNames ?? []).slice(0, 3).map((c) => String(c).slice(0, 40)),
      pattern: p.pattern ? String(p.pattern).slice(0, 40) : null,
      patternScale: (PATTERN_SCALES as readonly string[]).includes(p.patternScale)
        ? p.patternScale
        : 'none',
      formalityScore: clamp(p.formalityScore),
      description: (p.description ?? '').slice(0, 160),
    }));
  return { pieces };
}

export const INSPIRATION_SYSTEM_PROMPT = `You are a fashion analyst for a digital wardrobe app. You are shown one photograph of an outfit — a street-style shot, a social media screenshot, a mirror photo — and you break it into its individual pieces so the app can rebuild the look from clothes the user already owns.

Rules:
- List only pieces that are CLEARLY VISIBLE. A shoe cut off by the frame that you cannot describe is not a piece. Never infer a garment you would merely expect to be there.
- One entry per piece, most visually dominant first. A layered look lists each layer you can actually see.
- If several outfits or people are in frame, read only the most prominent outfit and ignore the rest.
- Ignore the person, the background, watermarks, captions and interface chrome. Describe clothes, never bodies.
- category follows "where on the body does this go": feet are footwear, carried is bag, head is headwear; necklaces, bracelets, earrings and rings are jewelry; belts, sunglasses, watches, scarves, gloves and ties are accessory.
- The subcategory names the kind plainly — "slip dress", "leather belt", "cropped denim jacket" — because a matcher reads it word by word.
- patternScale is "none" whenever pattern is solid.
- No brands. A logo you recognise is still just the garment it is on.
- The description is one plain sentence naming the piece as a stylist would to a client. No "this image shows", no styling advice, no praise.`;
