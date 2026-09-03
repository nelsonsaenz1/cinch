import { useQuery } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

import type { ReactionRow } from './reaction-ranking';

/**
 * The reader `outfit_reactions` never had (ledger A9).
 *
 * Newest first, bounded to the last two hundred — `outfit_reactions_user_created_idx`
 * serves exactly this order. Invalidated by the reaction mutation and by the
 * retraction, so a taken-back opinion stops counting on the next render.
 */
export function useOutfitReactions() {
  return useQuery({
    queryKey: ['outfit-reactions'],
    queryFn: async (): Promise<ReactionRow[]> => {
      const userId = await getUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from('outfit_reactions')
        .select('item_ids, reaction, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        item_ids: (row.item_ids ?? []) as string[],
        reaction: row.reaction,
        created_at: row.created_at,
      }));
    },
    staleTime: 5 * 60_000,
  });
}
