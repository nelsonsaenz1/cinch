import { z } from 'zod';

/**
 * The client's view of a garment.
 *
 * NOT shared with the Edge Functions, despite what this header used to claim.
 * Supabase bundles only `supabase/functions/` on deploy, so the tagger cannot
 * import from `src/` even in principle; the model's own output contract lives
 * in `supabase/functions/_shared/tag-schema.ts` and is a genuinely different
 * shape (it returns `colorNames: string[]`, which the function reshapes into
 * `colors` on write). The two are kept in step by hand, so the rule for
 * anything below is: describe what the DATABASE actually holds, not what the
 * model was asked for. Where they disagree the database wins, because that is
 * what this app has to read back.
 */

export const itemCategory = z.enum([
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
]);
export type ItemCategory = z.infer<typeof itemCategory>;

export const itemStatus = z.enum([
  'pending_upload',
  'pending_tag',
  'tagged',
  'needs_review',
  'verified',
]);

/**
 * The vocabularies the tagger is constrained to (`SEASONS` / `OCCASIONS` in
 * `supabase/functions/_shared/tag-schema.ts`). The columns themselves are plain
 * `text[]`, not Postgres enums, so `item` below stays permissive and these are
 * used for building UI choices rather than for rejecting rows — a value that
 * drifted out of this list is still a usable tag.
 */
export const season = z.enum(['spring', 'summer', 'fall', 'winter']);
export const occasion = z.enum([
  'casual',
  'office',
  'date',
  'gym',
  'event',
  'streetwear',
  'formal',
  'outdoor',
]);

/** The fit and print vocabularies are real Postgres enums — see `src/types/database.ts`. */
export const garmentFit = z.enum(['fitted', 'regular', 'relaxed', 'oversized']);

export const patternScale = z.enum(['none', 'micro', 'small', 'medium', 'large']);
export type PatternScale = z.infer<typeof patternScale>;

/**
 * One entry in the `colors` JSON column.
 *
 * `hex` is optional because the tagger does not produce it. `tag-item` writes
 * `colorNames.map((name) => ({ name }))`, so every freshly tagged row arrives
 * name-only; hex appears only on rows a human or a fixture supplied it for.
 * This used to be a required 6-digit hex, which meant the schema rejected the
 * exact shape the app writes for itself.
 */
export const itemColor = z.object({
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'expected a 6-digit hex colour')
    .nullish(),
  name: z.string(),
});

/** A row from `items`, as the app consumes it. */
export const item = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  imagePath: z.string().nullable(),
  cutoutPath: z.string().nullable(),
  /**
   * The plate-ready render: the cutout scale-normalized onto a fixed square
   * canvas at ingest, so stacked garments share a scale. Null until the
   * native pipeline has produced one — display falls back cutout → thumb.
   */
  platePath: z.string().nullable(),
  thumbPath: z.string().nullable(),
  status: itemStatus,
  category: itemCategory,
  subcategory: z.string().nullable(),
  colors: z.array(itemColor),
  pattern: z.string().nullable(),
  material: z.string().nullable(),
  brand: z.string().nullable(),
  formalityScore: z.number().int().min(1).max(5).nullable(),
  warmthScore: z.number().int().min(1).max(5).nullable(),
  waterResistant: z.boolean(),
  // Written by the tagger and read by the styling engine's silhouette and
  // print-mixing rules. Optional rather than merely nullable: the columns were
  // added after the first tagging model shipped, so rows and fixtures that
  // predate them legitimately carry neither.
  fit: garmentFit.nullish(),
  patternScale: patternScale.nullish(),
  seasons: z.array(z.string()),
  occasions: z.array(z.string()),
  description: z.string().nullable(),
  purchasePrice: z.number().nullable(),
  purchaseDate: z.string().nullable(),
  wearCount: z.number().int().min(0),
  lastWornAt: z.string().nullable(),
  isArchived: z.boolean(),
  isForSale: z.boolean(),
  userVerified: z.boolean(),
  createdAt: z.string(),
});
export type Item = z.infer<typeof item>;

/** Cost per wear, with "never worn" as a real state rather than a division by zero. */
export function costPerWear(it: Pick<Item, 'purchasePrice' | 'wearCount'>): number | null {
  if (it.purchasePrice === null) return null;
  if (it.wearCount === 0) return null;
  return it.purchasePrice / it.wearCount;
}
