import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { getUserId, supabase } from '@/lib/supabase';
import { itemColor, type Item } from '@/schemas/item';
import type { Database } from '@/types/database';

type ItemRow = Database['public']['Tables']['items']['Row'];

const itemColorList = z.array(itemColor);

/**
 * Parses the `colors` JSON column.
 *
 * Every other column arrives with a real Postgres type behind it, so the
 * generated types are trustworthy. `colors` is `jsonb`: nothing in the database
 * constrains its shape, and it is written by an Edge Function whose own output
 * contract lives in a separate file and has drifted from this one before. That
 * makes it the one field worth actually validating on the way in.
 *
 * Degrades instead of throwing. A garment with an unreadable colour is still a
 * garment the user owns and should see in their closet — and the scorer already
 * treats a colourless item as merely unremarkable. Blowing up the whole query
 * over one bad row would take the entire closet down with it.
 */
function toColors(raw: ItemRow['colors'], itemId: string): Item['colors'] {
  if (raw === null || raw === undefined) return [];

  const whole = itemColorList.safeParse(raw);
  if (whole.success) return whole.data;

  // Salvage per entry rather than all-or-nothing: one malformed swatch should
  // not cost the item the colours that parsed cleanly beside it.
  const salvaged = Array.isArray(raw)
    ? raw.flatMap((entry) => {
        const one = itemColor.safeParse(entry);
        return one.success ? [one.data] : [];
      })
    : [];

  console.warn(
    `[closet] item ${itemId}: dropped ${
      (Array.isArray(raw) ? raw.length : 1) - salvaged.length
    } malformed colour entr(ies)`,
    whole.error.issues,
  );

  return salvaged;
}

/**
 * Camel-cases a row from the database into the app's `Item` shape.
 *
 * The generated types are snake_case (Postgres convention) and the app is
 * camelCase (JS convention). Rather than sprinkle mapping across every screen
 * this file is the single crossing point — swap one call site to change how
 * the entire app reads items.
 *
 * `ai_tags` is deliberately not mapped. It is the tagger's raw response kept
 * for debugging and for re-deriving columns after a prompt change; nothing in
 * the app reads it, so parsing it here would only be work that can fail.
 */
function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    userId: row.user_id,
    imagePath: row.image_path,
    cutoutPath: row.cutout_path,
    platePath: row.plate_path,
    thumbPath: row.thumb_path,
    status: row.status,
    category: row.category,
    subcategory: row.subcategory,
    colors: toColors(row.colors, row.id),
    pattern: row.pattern,
    material: row.material,
    brand: row.brand,
    formalityScore: row.formality_score,
    warmthScore: row.warmth_score,
    waterResistant: row.water_resistant,
    fit: row.fit,
    patternScale: row.pattern_scale,
    seasons: row.seasons,
    occasions: row.occasions,
    description: row.description,
    purchasePrice: row.purchase_price,
    purchaseDate: row.purchase_date,
    wearCount: row.wear_count,
    lastWornAt: row.last_worn_at,
    isArchived: row.is_archived,
    isForSale: row.is_for_sale,
    userVerified: row.user_verified,
    createdAt: row.created_at,
  };
}

/** All non-archived items for the signed-in user, most recent first. */
export function useCloset() {
  return useQuery({
    queryKey: ['closet'],
    queryFn: async (): Promise<Item[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map(toItem);
    },
  });
}

/**
 * Items awaiting user review — anything the tagger touched but the user
 * hasn't confirmed. `needs_review` (tagging failed) surfaces first because
 * those are the ones with nothing populated to swipe past.
 */
export function useReviewQueue() {
  return useQuery({
    queryKey: ['review-queue'],
    queryFn: async (): Promise<Item[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('user_verified', false)
        .in('status', ['tagged', 'needs_review'])
        // needs_review before tagged, then oldest first so a big batch is
        // consumed FIFO rather than newest-first.
        .order('status', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []).map(toItem);
    },
  });
}
