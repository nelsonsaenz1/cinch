import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { track } from '@/lib/posthog';
import { getUserId } from '@/lib/supabase';

import { DAILY_SOCIAL_EVENTS, dailySocialReactedProps } from './analytics';
import { dailySocialDb, rowsOf } from './client';
import type { DailySocialReactionRow } from './db-rows';
import { isDailyReaction, type DailyReaction } from './types';

/**
 * The three reactions, read and written.
 *
 * ── THERE IS NO COUNT, AND THERE IS NOWHERE TO PUT ONE ────────────────────
 *
 * Nothing in this file aggregates, tallies or exposes how many people reacted
 * to anything, and the shape below is why it cannot start to by accident. A
 * reaction is read as `outfitId -> the one reaction I gave`, which is a map
 * with exactly one entry per look and no room for a second opinion. The table
 * underneath agrees: `(outfit_id, reactor_id)` is the primary key, there is no
 * count column, and there is no aggregate view. "No public aggregation" is
 * enforced by there being nothing to aggregate.
 *
 * ── CHANGING YOUR MIND IS ONE ROW, NOT TWO ────────────────────────────────
 *
 * `upsert` with `on conflict (outfit_id, reactor_id)`, so switching from cozy
 * to sharp rewrites the row that already exists. An insert-only writer would
 * be refused by the primary key, and a delete-then-insert would lose the
 * reaction for the width of a network round trip on a surface where the whole
 * interaction is one tap.
 *
 * ── WHY THE WRITE NEEDS NO PERMISSION CHECK ───────────────────────────────
 *
 * The insert policy routes its `with check` through `friend_worn_outfits`, so
 * you can only react to something you can CURRENTLY see. Sharing switched off,
 * a block, an expiry or a hidden closet all refuse the write server-side, with
 * no second rule here to keep in sync. A client-side check would be a courtesy
 * — the house rule from `unwear_outfit_tx` — and this is the rule.
 */

export const DAILY_REACTIONS_KEY = ['daily-social-reactions'] as const;

/** Which of the three the signed-in user gave, per outfit. Absent means none. */
export type DailyReactionsByOutfit = Record<string, DailyReaction>;

/**
 * The reader's own reactions.
 *
 * Scoped to `reactor_id` even though RLS already scopes the table, and the
 * `eq` is load-bearing rather than defensive: the owner-select policy means an
 * unfiltered read also returns reactions OTHER people gave to the reader's own
 * looks, and folding those into this map would draw somebody else's choice on
 * the reader's own control.
 */
export function useMyDailyReactions() {
  return useQuery({
    queryKey: DAILY_REACTIONS_KEY,
    queryFn: async (): Promise<DailyReactionsByOutfit> => {
      const userId = await getUserId();
      if (!userId) return {};

      const { data, error } = await dailySocialDb()
        .from('daily_social_reactions')
        .select('outfit_id, reactor_id, owner_id, reaction, created_at')
        .eq('reactor_id', userId);

      if (error) throw new Error(error.message);

      const map: DailyReactionsByOutfit = {};
      for (const row of rowsOf<DailySocialReactionRow>(data)) {
        // A value outside the three would mean the check constraint and this
        // union have drifted. Dropping it draws no reaction rather than
        // drawing a fourth one the interface has no room for.
        if (isDailyReaction(row.reaction)) map[row.outfit_id] = row.reaction;
      }
      return map;
    },
  });
}

/**
 * Give a reaction, change it, or take it back.
 *
 * `null` is taking it back, and it is a delete rather than a fourth stored
 * value: a "none" reaction would be a row that exists to say nothing, and the
 * owner's side of the select would have to learn to ignore it.
 *
 * The optimistic shape is `useSetClosetVisibility`'s, deliberately — snapshot
 * in `onMutate`, roll back in `onError`, invalidate in `onSettled`. A reaction
 * that waits for the network before it moves reads as a tap that did not land,
 * and this is a surface whose entire interaction is that one tap.
 */
export function useSetDailyReaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      outfitId,
      ownerId,
      reaction,
    }: {
      outfitId: string;
      /** The friend whose look it is. Denormalised so their own select needs no join. */
      ownerId: string;
      reaction: DailyReaction | null;
    }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const table = dailySocialDb().from('daily_social_reactions');

      if (reaction === null) {
        const { error } = await table.delete().eq('outfit_id', outfitId).eq('reactor_id', userId);
        if (error) throw new Error(error.message);
        return;
      }

      const { error } = await table.upsert(
        { outfit_id: outfitId, reactor_id: userId, owner_id: ownerId, reaction },
        { onConflict: 'outfit_id,reactor_id' },
      );
      if (error) throw new Error(error.message);
    },

    // The chosen state moves under the finger and is put back if the write
    // fails. Same three hooks, same order, as the visibility switch.
    onMutate: async ({ outfitId, reaction }) => {
      await qc.cancelQueries({ queryKey: DAILY_REACTIONS_KEY });
      const previous = qc.getQueryData<DailyReactionsByOutfit>(DAILY_REACTIONS_KEY);
      if (previous) {
        const next = { ...previous };
        if (reaction === null) delete next[outfitId];
        else next[outfitId] = reaction;
        qc.setQueryData(DAILY_REACTIONS_KEY, next);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(DAILY_REACTIONS_KEY, context.previous);
    },
    onSuccess: (_data, { reaction }) => {
      // Which of the three, and nothing else. Not who reacted, not whose look
      // it was, not which look — and there is no count to send even if
      // somebody wanted one. Taking a reaction back is silent: a retraction
      // measured as an event would be a record of a person changing their mind
      // about another person.
      if (reaction) track(DAILY_SOCIAL_EVENTS.reacted, dailySocialReactedProps(reaction));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: DAILY_REACTIONS_KEY });
    },
  });
}
