import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useRef } from 'react';

import { createOperationIds, runCommand } from '@/lib/commands';
import { track } from '@/lib/posthog';
import { getUserId, supabase } from '@/lib/supabase';

/**
 * Composing an outfit BY HAND — the write half of /compose.
 *
 * Exists because a user wrote in (2026-08-30, the app's first support email)
 * asking how to put her OWN outfit on her day: she was already dressed, the
 * suggestions were not what she wore, and the app had no door. The machinery
 * was all here — the event board's composer creates user outfits and
 * `wear_outfit_tx` logs the wear atomically — but every door to it belonged
 * to an event. This module is those same two writes with no event attached.
 *
 * Two doors, deliberately distinct:
 *
 *   wearNow  — `wear_outfit_tx`, the one transactional path the schema
 *              offers: outfit + items + today's wear, atomic, idempotent by
 *              operation id, `p_source: 'user'` because the composition is
 *              the person's own.
 *   saveOnly — the plain owner-RLS pair of inserts share-look's no-Lately
 *              path uses: an outfit for later, no wear counted, because
 *              saving an idea is not wearing it.
 */

const social = supabase as unknown as SupabaseClient;

export type ComposeOwnVars = {
  /** In stack order — piece one is the look's face; never re-sorted here. */
  itemIds: string[];
  name: string | null;
  /** True = wear it today (logs a wear); false = keep it for later. */
  wearNow: boolean;
};

export function useComposeOwnOutfit() {
  const qc = useQueryClient();
  const opIds = useRef(createOperationIds()).current;

  return useMutation({
    mutationFn: async (vars: ComposeOwnVars): Promise<string> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');
      if (vars.itemIds.length === 0) throw new Error('A look needs at least one piece.');

      if (vars.wearNow) {
        const actionKey = vars.itemIds.join('.');
        const outfitId = await runCommand('wear_outfit_tx', {
          p_op_id: opIds.for(actionKey),
          p_item_ids: vars.itemIds,
          p_name: vars.name ?? undefined,
          p_reasoning: undefined,
          p_context: undefined,
          p_source: 'user',
        });
        opIds.settle(actionKey);
        return outfitId as string;
      }

      const { data, error } = await social
        .from('outfits')
        .insert({ user_id: userId, name: vars.name, generated_by: 'user' })
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
      const { error: itemsError } = await social.from('outfit_items').insert(rows);
      if (itemsError) throw itemsError;
      return outfitId;
    },

    onSuccess: (_id, vars) => {
      // COUNTS AND A FLAG ONLY — which door and how many pieces, never the
      // pieces. The same line every outfit event in this file's neighbours
      // draws.
      track('own_outfit_composed', { pieces: vars.itemIds.length, worn: vars.wearNow });
      void qc.invalidateQueries({ queryKey: ['wardrobe'] });
      void qc.invalidateQueries({ queryKey: ['closet'] });
      void qc.invalidateQueries({ queryKey: ['outfits'] });
      void qc.invalidateQueries({ queryKey: ['diary'] });
    },
  });
}
