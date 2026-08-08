import { useQuery } from '@tanstack/react-query';

import { closetUserId } from '@/features/closet/session';
import { supabase } from '@/lib/supabase';

/**
 * How many saved outfits each garment appears in — the swap picker's "IN 4
 * OUTFITS" line (Directive 4, W-04).
 *
 * One batched read over `outfit_items`, the same table `co-wear.ts` reads,
 * but counting EVERY saved outfit rather than only worn ones: the swap picker
 * is warning "storing this breaks up a look you built", which is true the
 * moment the outfit exists, not only once it has been worn. `co-wear.ts`'s
 * narrower worn-only rule answers a different question ("what does this
 * actually go out with") and stays as it is.
 *
 * Batched over every id the screen needs rather than one query per row, for
 * the same reason `use-image-urls.ts` batches signed URLs — a swap picker
 * with a dozen candidates is a dozen round trips otherwise.
 */
export function useOutfitMembership(itemIds: readonly string[]) {
  const unique = [...new Set(itemIds)].sort();

  return useQuery({
    queryKey: ['outfit-membership', unique],
    enabled: unique.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const userId = await closetUserId();
      if (!userId) return {};

      const { data, error } = await supabase
        .from('outfit_items')
        .select('item_id')
        .eq('user_id', userId)
        .in('item_id', unique);

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.item_id] = (counts[row.item_id] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 60_000,
  });
}
