import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OutfitCandidate } from '@/lib/styling';
import { getUserId, supabase } from '@/lib/supabase';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Item ids already committed to a date this week, so the planner can avoid them. */
export function usePlannedWeek(startDate: Date, days: number) {
  const end = new Date(startDate);
  end.setDate(end.getDate() + days);

  return useQuery({
    queryKey: ['planned-week', isoDate(startDate), days],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const userId = await getUserId();
      if (!userId) return {};

      const { data, error } = await supabase
        .from('outfit_calendar')
        .select('planned_date, outfit_id, outfits(id, outfit_items(item_id))')
        .eq('user_id', userId)
        .gte('planned_date', isoDate(startDate))
        .lt('planned_date', isoDate(end));

      if (error) throw error;

      const map: Record<string, string[]> = {};
      for (const row of data ?? []) {
        const outfit = row.outfits as unknown as { outfit_items?: { item_id: string }[] } | null;
        map[row.planned_date] = (outfit?.outfit_items ?? []).map((i) => i.item_id);
      }
      return map;
    },
  });
}

/**
 * Commit an outfit to a date.
 *
 * Writes the outfit, its items, and the calendar entry. Unlike logging a wear,
 * this does not touch `wear_count` — a plan is an intention, and counting it as
 * a wear would corrupt both the cost-per-wear numbers and the freshness rule
 * that stops the app suggesting the same jacket three days running.
 */
export function usePlanOutfit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      candidate,
      date,
      context,
      reasoning,
    }: {
      candidate: OutfitCandidate;
      date: Date;
      context: unknown;
      reasoning: string;
    }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { data: outfit, error: outfitError } = await supabase
        .from('outfits')
        .insert({
          user_id: userId,
          generated_by: 'ai',
          reasoning,
          context_snapshot: context as never,
        })
        .select('id')
        .single();
      if (outfitError) throw outfitError;

      const { error: itemsError } = await supabase.from('outfit_items').insert(
        candidate.items.map((g, i) => ({
          outfit_id: outfit.id,
          item_id: g.id,
          user_id: userId,
          role: 'base',
          position: i,
        })),
      );
      if (itemsError) throw itemsError;

      const { error: calendarError } = await supabase.from('outfit_calendar').insert({
        user_id: userId,
        outfit_id: outfit.id,
        planned_date: isoDate(date),
      });
      if (calendarError) throw calendarError;

      return outfit.id;
    },

    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['planned-week'] });
    },
  });
}
