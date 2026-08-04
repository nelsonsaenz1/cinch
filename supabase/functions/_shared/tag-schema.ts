/**
 * The garment-tagging schema, in the exact shape sent to the model as
 * `response_format.json_schema`.
 *
 * Rules that matter for strict mode:
 *  - every property must appear in `required` (nullable, not optional)
 *  - `additionalProperties: false` on every object
 *  - numeric ranges and string lengths are NOT enforced by JSON Schema here,
 *    so they are validated in code after parsing
 *
 * Deliberately absent: hex colour codes. Colour hex is a documented weak spot
 * even for fine-tuned fashion models (~11% exact match), so hex is extracted
 * on-device from the actual pixels and only the human-readable colour *name*
 * comes from the model.
 */

export const CATEGORIES = [
  'top',
  'bottom',
  'outerwear',
  'footwear',
  'dress',
  'accessory',
  'bag',
  'headwear',
  'jewelry',
  'other',
] as const;

export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;

export const FITS = ['fitted', 'regular', 'relaxed', 'oversized'] as const;

export const PATTERN_SCALES = ['none', 'micro', 'small', 'medium', 'large'] as const;

export const OCCASIONS = [
  'casual',
  'office',
  'date',
  'gym',
  'event',
  'streetwear',
  'formal',
  'outdoor',
] as const;

export const tagSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'category',
    'subcategory',
    'colorNames',
    'pattern',
    'material',
    'brand',
    'formalityScore',
    'warmthScore',
    'waterResistant',
    'fit',
    'patternScale',
    'seasons',
    'occasions',
    'description',
  ],
  properties: {
    category: { type: 'string', enum: CATEGORIES },
    subcategory: {
      type: 'string',
      description: 'Specific garment type, e.g. "hoodie", "chinos", "penny loafers"',
    },
    colorNames: {
      type: 'array',
      items: { type: 'string' },
      description: 'Dominant colours as plain names, most prominent first, at most three',
    },
    pattern: {
      type: ['string', 'null'],
      description: 'e.g. "solid", "striped", "plaid", "floral". Null if unclear.',
    },
    material: {
      type: ['string', 'null'],
      description:
        'Best guess at primary fabric. Null if genuinely uncertain — do not guess wildly, this field is known to be unreliable and a null is more useful than a wrong answer.',
    },
    brand: {
      type: ['string', 'null'],
      description: 'Only if a logo or wordmark is clearly legible. Null otherwise.',
    },
    formalityScore: {
      type: 'integer',
      description: '1 = loungewear, 3 = smart casual, 5 = black tie',
    },
    warmthScore: {
      type: 'integer',
      description: '1 = hot weather only, 3 = mild, 5 = deep winter',
    },
    waterResistant: { type: 'boolean' },
    fit: {
      type: 'string',
      enum: FITS,
      description:
        'How close to the body the garment is cut. "regular" when it is an ordinary cut or you cannot tell.',
    },
    patternScale: {
      type: 'string',
      enum: PATTERN_SCALES,
      description:
        'Visual size of the print relative to the garment. "none" for solids. A pinstripe is micro; a large floral is large.',
    },
    seasons: {
      type: 'array',
      items: { type: 'string', enum: SEASONS },
      description: 'Every season this could reasonably be worn in',
    },
    occasions: {
      type: 'array',
      items: { type: 'string', enum: OCCASIONS },
      description: 'Every occasion this fits',
    },
    description: {
      type: 'string',
      description:
        'One natural sentence, as a stylist would describe it to a client. No more than 160 characters.',
    },
  },
} as const;

export type TagResult = {
  category: (typeof CATEGORIES)[number];
  subcategory: string;
  colorNames: string[];
  pattern: string | null;
  material: string | null;
  brand: string | null;
  formalityScore: number;
  warmthScore: number;
  waterResistant: boolean;
  fit: (typeof FITS)[number];
  patternScale: (typeof PATTERN_SCALES)[number];
  seasons: string[];
  occasions: string[];
  description: string;
};

/**
 * Post-parse validation for the constraints JSON Schema can't express in strict
 * mode. Clamps rather than rejects — a formality of 7 is a usable signal that
 * the garment is formal, and failing the whole item over it would be worse.
 */
export function normalizeTags(raw: TagResult): TagResult {
  const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(Number(n) || 3)));
  return {
    ...raw,
    formalityScore: clamp(raw.formalityScore),
    warmthScore: clamp(raw.warmthScore),
    colorNames: (raw.colorNames ?? []).slice(0, 3),
    fit: (FITS as readonly string[]).includes(raw.fit) ? raw.fit : 'regular',
    patternScale: (PATTERN_SCALES as readonly string[]).includes(raw.patternScale)
      ? raw.patternScale
      : 'none',
    seasons: (raw.seasons ?? []).filter((s) => (SEASONS as readonly string[]).includes(s)),
    occasions: (raw.occasions ?? []).filter((o) => (OCCASIONS as readonly string[]).includes(o)),
    description: (raw.description ?? '').slice(0, 200),
  };
}

export const TAG_SYSTEM_PROMPT = `You are a fashion cataloguer for a digital wardrobe app. You are shown one photograph of a single item of clothing and you return structured attributes about it.

Rules:
- Describe only the garment. Ignore hangers, mannequins, hands, furniture, and background.
- If the photo contains more than one garment, describe the most prominent one.
- formalityScore and warmthScore are integers 1 to 5. Use the full range; not everything is a 3.
- Return null for material or brand when you are genuinely unsure. A null is more useful than a confident wrong answer, because the user reviews these and a wrong guess costs them a correction.
- Seasons and occasions should be generous rather than narrow: list every one where the piece would genuinely work.
- fit and patternScale drive silhouette and print-mixing rules, so judge them from the garment's cut and print rather than from how it happens to be laid out or folded in the photo.
- The description is one sentence a stylist would say to a client. No preamble, no "this image shows".`;
