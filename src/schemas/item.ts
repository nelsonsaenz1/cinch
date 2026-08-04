import { z } from 'zod';

/**
 * Shared between the client and the Supabase Edge Functions.
 *
 * `aiTagSchema` is the exact shape handed to the model as
 * `output_config.format.json_schema`, so the model cannot return a shape the
 * app can't parse. Anything the model is allowed to omit must be `.nullable()`
 * here, not `.optional()` — a strict JSON schema requires every property to be
 * present in `required`.
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
export type ItemStatus = z.infer<typeof itemStatus>;

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

export const itemColor = z.object({
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a 6-digit hex colour'),
  name: z.string(),
});

/** What the vision model must return for a single garment photo. */
export const aiTagSchema = z.object({
  category: itemCategory,
  subcategory: z.string().describe('Specific garment type, e.g. "hoodie", "chinos", "loafers"'),
  colors: z.array(itemColor).min(1).max(4).describe('Dominant colours, most prominent first'),
  pattern: z.string().nullable().describe('e.g. "solid", "striped", "plaid", "floral"'),
  material: z.string().nullable().describe('Best guess, e.g. "cotton", "wool", "leather"'),
  brand: z.string().nullable().describe('Only if a logo or label is clearly legible'),
  formalityScore: z.number().int().min(1).max(5).describe('1 = loungewear, 5 = black tie'),
  warmthScore: z.number().int().min(1).max(5).describe('1 = hot weather only, 5 = deep winter'),
  waterResistant: z.boolean(),
  seasons: z.array(season).min(1),
  occasions: z.array(occasion).min(1),
  description: z
    .string()
    .max(160)
    .describe('One natural sentence, as a stylist would describe it to a client'),
});
export type AiTags = z.infer<typeof aiTagSchema>;

/** A row from `items`, as the app consumes it. */
export const item = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  imagePath: z.string().nullable(),
  cutoutPath: z.string().nullable(),
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
