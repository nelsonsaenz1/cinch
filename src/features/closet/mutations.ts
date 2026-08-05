import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';
import type { Item } from '@/schemas/item';
import type { Database } from '@/types/database';

type ItemUpdate = Database['public']['Tables']['items']['Update'];

/**
 * The one write from the review deck — and now the one write from item detail.
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
      verify = true,
    }: {
      id: string;
      patch?: Partial<
        Pick<Item, 'category' | 'subcategory' | 'occasions' | 'seasons' | 'purchasePrice'>
      >;
      /**
       * Whether this write also means "a human confirmed the tags".
       *
       * True for the review deck, which is exactly that act. False for an edit
       * made anywhere else — typing in what a garment cost says nothing about
       * whether the tagger got its colours right, and claiming otherwise would
       * quietly promote an unreviewed item and remove it from the queue the
       * user never saw it in.
       */
      verify?: boolean;
    }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const update: ItemUpdate = verify ? { user_verified: true, status: 'verified' } : {};
      if (patch?.category !== undefined) update.category = patch.category;
      if (patch?.subcategory !== undefined) update.subcategory = patch.subcategory;
      if (patch?.occasions !== undefined) update.occasions = patch.occasions;
      if (patch?.seasons !== undefined) update.seasons = patch.seasons;
      // Null is a real value here — "I don't know what this cost" — so this
      // checks for `undefined` (field absent from the patch) rather than
      // truthiness, which would make clearing a price impossible.
      if (patch?.purchasePrice !== undefined) update.purchase_price = patch.purchasePrice;

      // Nothing to say. A `verify: false` call whose patch turned out to be
      // empty is a no-op, not an empty UPDATE for PostgREST to reject.
      if (Object.keys(update).length === 0) return { id };

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
