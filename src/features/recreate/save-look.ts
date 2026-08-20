import { useMutation, useQueryClient } from '@tanstack/react-query';

import { track } from '@/lib/posthog';
import { getUserId, supabase } from '@/lib/supabase';

/**
 * Keep a recreated look — a plain owner-RLS insert into `outfits` then
 * `outfit_items`, the same two writes `share-look/mutations.ts` argues are
 * safe to `.select('id')` after (no STABLE function in either WITH CHECK).
 *
 * `generated_by: 'ai'` because the composition came out of the analysis
 * pipeline rather than the person's own hands; the note records the origin
 * in words since no column exists for it, and inventing one for a sentence
 * would be a migration for a caption. Nothing from the inspiration
 * PHOTOGRAPH is stored on the outfit — the look points at the person's own
 * garments and nothing else.
 */
export function useSaveRecreatedLook() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { itemIds: string[]; name: string | null }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { data, error } = await supabase
        .from('outfits')
        .insert({
          user_id: userId,
          name: vars.name,
          generated_by: 'ai',
          note: 'Recreated from an inspiration photo.',
        })
        .select('id')
        .single();
      if (error) throw error;
      const outfitId = (data as { id: string }).id;

      const rows = vars.itemIds.map((item_id, i) => ({
        outfit_id: outfitId,
        item_id,
        user_id: userId,
        position: i,
      }));
      const { error: itemsError } = await supabase.from('outfit_items').insert(rows);
      if (itemsError) throw itemsError;

      return outfitId;
    },
    onSuccess: (_id, vars) => {
      // A COUNT, never the items.
      track('recreate_saved', { pieces: vars.itemIds.length });
      void qc.invalidateQueries({ queryKey: ['outfits'] });
    },
  });
}
