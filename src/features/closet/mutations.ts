import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';
import type { Item } from '@/schemas/item';
import type { Database } from '@/types/database';

type ItemUpdate = Database['public']['Tables']['items']['Update'];

/**
 * The one write from the review deck.
 *
 * Every accepted or edited item flips `user_verified = true` — that's the
 * signal downstream: the outfit engine trusts verified tags more, and the
 * review queue query filters on it. Corrections (patch fields) go in the same
 * write to avoid a two-round-trip flicker.
 */
export function useVerifyItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch?: Partial<Pick<Item, 'category' | 'subcategory' | 'occasions' | 'seasons'>>;
    }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const update: ItemUpdate = {
        user_verified: true,
        status: 'verified',
      };
      if (patch?.category !== undefined) update.category = patch.category;
      if (patch?.subcategory !== undefined) update.subcategory = patch.subcategory;
      if (patch?.occasions !== undefined) update.occasions = patch.occasions;
      if (patch?.seasons !== undefined) update.seasons = patch.seasons;

      const { error } = await supabase.from('items').update(update).eq('id', id);
      if (error) throw error;

      // TODO(OUT-22): if `patch` was set, log a row to `style_feedback` for the
      // personalization flywheel — the model was wrong in a specific direction
      // and that's the signal we want to distill.
      return { id };
    },
    onSuccess: () => {
      // The user just changed both queues. Invalidate rather than optimistic-
      // update: the swipe deck sequencing is easier to reason about when the
      // list is the source of truth.
      void qc.invalidateQueries({ queryKey: ['review-queue'] });
      void qc.invalidateQueries({ queryKey: ['closet'] });
    },
  });
}
