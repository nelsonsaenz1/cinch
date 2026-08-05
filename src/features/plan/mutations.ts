import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { track } from '@/lib/posthog';
import { createOperationIds, runCommand } from '@/lib/commands';
import { dateKey } from '@/lib/date';
import type { OutfitCandidate } from '@/lib/styling';
import { getUserId, supabase } from '@/lib/supabase';

/** Item ids already committed to a date this week, so the planner can avoid them. */
export function usePlannedWeek(startDate: Date, days: number) {
  const end = new Date(startDate);
  end.setDate(end.getDate() + days);

  return useQuery({
    queryKey: ['planned-week', dateKey(startDate), days],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const userId = await getUserId();
      if (!userId) return {};

      const { data, error } = await supabase
        .from('outfit_calendar')
        .select('planned_date, outfit_id, outfits(id, outfit_items(item_id))')
        .eq('user_id', userId)
        .gte('planned_date', dateKey(startDate))
        .lt('planned_date', dateKey(end));

      if (error) throw error;

      // A date can carry more than one outfit — nothing stops a user planning
      // twice for Saturday, and the calendar's unique key is per outfit, not
      // per day. Assigning `map[date] = …` per row kept whichever row came back
      // last and silently dropped the rest, so half a planned day's garments
      // stayed invisible to the planner and got suggested again for Sunday.
      // Union them instead: every consumer wants "what is spoken for that day".
      const map: Record<string, string[]> = {};
      for (const row of data ?? []) {
        const outfit = row.outfits as unknown as { outfit_items?: { item_id: string }[] } | null;
        const ids = (outfit?.outfit_items ?? []).map((i) => i.item_id);
        const existing = map[row.planned_date];
        map[row.planned_date] = existing ? [...new Set([...existing, ...ids])] : ids;
      }
      return map;
    },
  });
}

/**
 * Commit an outfit to a date.
 *
 * Writes the outfit, its items, and the calendar entry — as one transaction.
 * Three sequential client writes could fail between any two of them, leaving an
 * outfit with no garments or a plan with no calendar row, and the natural retry
 * made a second orphan rather than completing the first. `plan_outfit_tx` is
 * keyed by an operation id so replaying it returns the original outfit.
 *
 * Unlike logging a wear this does not touch `wear_count` — a plan is an
 * intention, and counting it as a wear would corrupt both the cost-per-wear
 * numbers and the freshness rule that stops the app suggesting the same jacket
 * three days running.
 *
 * The command takes a name and a note but no `context_snapshot`, so the weather
 * a plan was generated against is no longer stored. That is a real loss against
 * the previous direct insert; it is accepted here because atomicity matters more
 * than a debugging aid, and the snapshot can be added back to the SQL function
 * without touching this call site.
 */
export function usePlanOutfit() {
  const qc = useQueryClient();

  // Survives across renders so a retried tap replays the same operation.
  const opIds = useRef(createOperationIds()).current;

  return useMutation({
    mutationFn: async ({
      candidate,
      date,
      note,
    }: {
      candidate: OutfitCandidate;
      date: Date;
      /** Optional free text shown against the day in the calendar. */
      note?: string;
    }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const itemIds = candidate.items.map((g) => g.id);
      const planned = dateKey(date);
      // Same clothes, same day = the same intention being retried.
      const actionKey = `${planned}|${itemIds.join('.')}`;

      const outfitId = await runCommand('plan_outfit_tx', {
        p_op_id: opIds.for(actionKey),
        p_item_ids: itemIds,
        p_planned_date: planned,
        p_name: null,
        p_note: note ?? null,
      });

      opIds.settle(actionKey);
      return outfitId;
    },

    onSuccess: () => {
      // The date and note are user data; the event is the fact alone.
      track('outfit_planned');
      void qc.invalidateQueries({ queryKey: ['planned-week'] });
    },
  });
}
