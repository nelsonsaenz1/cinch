import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { closetUserId } from '@/features/closet/session';
import { createOperationIds, runCommand } from '@/lib/commands';
import { track } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';

import { DIARY_KEY } from './queries';
import type { DiaryEntry } from './types';

/**
 * Everything the diary can write.
 *
 * Three of the four are the atlas's own rules made real, and all three are
 * narrower than they look:
 *
 *   * **The correction is a transaction, not a delete.** `unwear_outfit_tx`
 *     decrements `items.wear_count` as it removes the row, because that column
 *     is read by the closet grid, the item page, cost per wear, The Repeat's
 *     exhaustion maths and the friend-closet view. A mis-tap that silently
 *     inflated five surfaces would be worse than no undo at all.
 *   * **The 24-hour window is the server's.** The function raises `22023` past
 *     it, and this module lets that error travel rather than swallowing it.
 *   * **Keeping a plate is one column.** `saved_at` on the wear row. The look
 *     that was worn IS the plate being kept; there is nothing to copy.
 */

/** Everything that reads a wear count or a wear list, so a write cannot leave one stale. */
function invalidateWearSurfaces(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: DIARY_KEY });
  void qc.invalidateQueries({ queryKey: ['closet'] });
  void qc.invalidateQueries({ queryKey: ['wardrobe'] });
  void qc.invalidateQueries({ queryKey: ['worn-outfits'] });
}

/**
 * WD-03's first action — wear this look again, today.
 *
 * A fresh row, exactly like every other confirm: two wearings of the same
 * clothes are two events, and rewriting the old row's `worn_at` would erase the
 * first one from the record it is sitting in.
 *
 * `p_origin` carries the lineage forward rather than inventing one. If the
 * entry is itself a kept plate it becomes the origin; otherwise the entry's own
 * origin is passed through, so a plate worn five times still counts five and
 * not one. `p_source` is the ORIGINAL row's — a repeat of a look the stylist
 * proposed is still the stylist's look, and relabelling it 'user' would let the
 * model take credit for nothing or lose credit for something.
 */
export function useWearAgain() {
  const qc = useQueryClient();
  const opIds = useRef(createOperationIds()).current;

  return useMutation({
    mutationFn: async ({ entry }: { entry: DiaryEntry }): Promise<string> => {
      const itemIds = entry.pieces.map((p) => p.id);
      if (itemIds.length === 0) throw new Error('That entry has no pieces left to wear.');

      // Keyed on the entry, not the clothes: repeating the same entry twice in
      // a row is one tap being retried.
      const actionKey = `again.${entry.id}`;

      const outfitId = await runCommand('wear_outfit_tx', {
        p_op_id: opIds.for(actionKey),
        p_item_ids: itemIds,
        p_name: entry.name,
        p_reasoning: null,
        p_context: null,
        p_source: entry.source,
        p_origin: entry.savedAt ? entry.id : entry.originOutfitId,
      });

      opIds.settle(actionKey);
      return outfitId;
    },
    onSuccess: () => {
      track('outfit_worn');
      invalidateWearSurfaces(qc);
    },
  });
}

/**
 * The note — the one thing that stays editable after the day has passed.
 *
 * A plain update to `outfits.note`, bounded at 500 characters by a check
 * constraint on the column. An emptied note is stored as null rather than as an
 * empty string, so "has a note" stays a single question everywhere it is asked
 * — including the "· Noted" on the row this entry came from.
 */
export function useSetEntryNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, note }: { entryId: string; note: string }): Promise<void> => {
      const userId = await closetUserId();
      if (!userId) throw new Error("Couldn't confirm your session.");

      const trimmed = note.trim();
      const { error } = await supabase
        .from('outfits')
        .update({ note: trimmed === '' ? null : trimmed })
        .eq('id', entryId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DIARY_KEY });
    },
  });
}

/**
 * The one-day correction.
 *
 * Not `runCommand`: that helper insists on a returned uuid and this function
 * returns void, so it would throw on every successful correction.
 *
 * The operation id is HELD across retries, exactly as the wear is. Without that
 * the failure mode is nastier than a double write: a connection lost after the
 * server committed would, on retry, find the row already gone and raise "no
 * such wear" — an error message for an action that worked. Replaying the same
 * id returns quietly instead, which is what `claim_command` is for.
 *
 * The PostgREST error otherwise travels untouched. `22023` is the refusal past
 * the window, and `entry.ts`'s `unwearRefusal` turns it into a sentence.
 */
export function useUnwearEntry() {
  const qc = useQueryClient();
  const opIds = useRef(createOperationIds()).current;

  return useMutation({
    mutationFn: async ({ entryId }: { entryId: string }): Promise<void> => {
      const { error } = await supabase.rpc('unwear_outfit_tx', {
        p_op_id: opIds.for(`unwear.${entryId}`),
        p_outfit_id: entryId,
      });
      if (error) throw error;
      opIds.settle(`unwear.${entryId}`);
    },
    onSuccess: () => {
      invalidateWearSurfaces(qc);
    },
  });
}
