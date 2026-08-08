import { useQuery } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

import type { WornRecord } from './repeat';

/**
 * Every outfit this account has actually marked worn, oldest first.
 *
 * The Repeat's whole honesty rule rests on this query: `worn_at` is set in
 * exactly one place, `wear_outfit_tx` (an explicit "I wore this" tap), so a row
 * here is a real marked wear and never an inference from what was merely
 * suggested. `outfit_calendar` is deliberately NOT read for this — that table
 * is the forward-looking week planner, and a planned outfit that was never
 * actually worn would let the mark claim a day that never happened.
 */
export function useWornOutfits() {
  return useQuery({
    queryKey: ['worn-outfits'],
    queryFn: async (): Promise<WornRecord[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('outfits')
        .select('worn_at, outfit_items(item_id)')
        .eq('user_id', userId)
        .not('worn_at', 'is', null)
        .order('worn_at', { ascending: true });

      if (error) throw error;

      return (data ?? [])
        .filter((row): row is typeof row & { worn_at: string } => row.worn_at != null)
        .map((row) => ({
          date: new Date(row.worn_at),
          itemIds: ((row.outfit_items ?? []) as unknown as { item_id: string }[]).map(
            (i) => i.item_id,
          ),
        }));
    },
    // Wear history changes on exactly one action — logging a wear — and that
    // mutation invalidates this key directly, so a longer stale time here just
    // avoids a redundant refetch on every screen focus.
    staleTime: 5 * 60_000,
  });
}
