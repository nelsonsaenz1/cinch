import { useQuery } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';
import type { Item } from '@/schemas/item';
import type { Database } from '@/types/database';

type ItemRow = Database['public']['Tables']['items']['Row'];

/**
 * Camel-cases a row from the database into the app's `Item` shape.
 *
 * The generated types are snake_case (Postgres convention) and the app is
 * camelCase (JS convention). Rather than sprinkle mapping across every screen
 * this file is the single crossing point — swap one call site to change how
 * the entire app reads items.
 */
function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    userId: row.user_id,
    imagePath: row.image_path,
    cutoutPath: row.cutout_path,
    thumbPath: row.thumb_path,
    status: row.status,
    category: row.category,
    subcategory: row.subcategory,
    // `colors` and `ai_tags` are Json in the DB. Trust the schema — the tagging
    // path controls this shape end-to-end — but coerce so downstream code is
    // typed rather than `unknown`.
    colors: (row.colors as unknown as Item['colors']) ?? [],
    pattern: row.pattern,
    material: row.material,
    brand: row.brand,
    formalityScore: row.formality_score,
    warmthScore: row.warmth_score,
    waterResistant: row.water_resistant,
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
