import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useRef } from 'react';

import { eventPostsKey } from '@/features/event-outfits/queries';
import { createOperationIds, runCommand } from '@/lib/commands';
import { getUserId, supabase } from '@/lib/supabase';

/** Untyped client for tables the generated types don't know yet — matches the
 * pattern `features/event-outfits/{queries,mutations}.ts` already use. */
const social = supabase as unknown as SupabaseClient;

export type ComposeAndPostVars = {
  eventId: string;
  /** In stack order — piece one is the look's face; never re-sorted here. */
  itemIds: string[];
  title: string | null;
  caption: string | null;
  /** "Also save to Lately" — also logs a wear for every piece. Default on. */
  saveToLately: boolean;
};

export type ComposeAndPostResult = { outfitId: string; postId: string };

async function createOutfitWithoutWear(
  userId: string,
  itemIds: string[],
  title: string | null,
): Promise<string> {
  // Plain owner-RLS inserts — `outfits`/`outfit_items`'s INSERT policies check
  // only `auth.uid() = user_id`, no STABLE function in the WITH CHECK, so
  // `.select('id')` after the insert is safe here (the RETURNING trap the
  // contract warns about is specific to policies that call one).
  const { data, error } = await social
    .from('outfits')
    .insert({ user_id: userId, name: title, generated_by: 'user' })
    .select('id')
    .single();
  if (error) throw error;
  const outfitId = (data as { id: string }).id;

  const rows = itemIds.map((item_id, i) => ({
    outfit_id: outfitId,
    item_id,
    user_id: userId,
    position: i,
  }));
  const { error: itemsError } = await social.from('outfit_items').insert(rows);
  if (itemsError) throw itemsError;

  return outfitId;
}

/**
 * Turn a freshly composed stack into a posted look: create the outfit — and,
 * when the poster wants it, count a wear for every piece in the same breath —
 * then publish it to the event board.
 *
 * Two different write shapes for the first half, on purpose. `wear_outfit_tx`
 * is the one transactional path the schema offers (outfit + items + wear
 * count, atomic and idempotent), and it ALWAYS marks the outfit worn — so
 * "save to Lately" being off has to take a different door: a plain owner-RLS
 * insert into `outfits` then `outfit_items`, no wear logged. Either way the
 * caller ends up with an outfit id, and the board publish
 * (`event_outfit_posts`) is the same second step regardless of which door was
 * taken.
 *
 * Every failure here — the network dropping mid-write, the terms gate
 * intercepting the post — leaves the caller's own state (the stack, the
 * title, the caption) untouched, because none of it lives here. "It didn't
 * post" is a screen-level concern (S-05); this hook only ever resolves or
 * rejects.
 */
export function useComposeAndPostLook() {
  const qc = useQueryClient();
  const opIds = useRef(createOperationIds()).current;

  return useMutation({
    mutationFn: async (vars: ComposeAndPostVars): Promise<ComposeAndPostResult> => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');
      if (vars.itemIds.length === 0) throw new Error('A look needs at least one piece.');

      const actionKey = vars.itemIds.join('.');
      const caption = vars.caption?.trim() ? vars.caption.trim() : null;

      const outfitId = vars.saveToLately
        ? await runCommand('wear_outfit_tx', {
            p_op_id: opIds.for(actionKey),
            p_item_ids: vars.itemIds,
            p_name: vars.title,
            p_reasoning: caption,
            p_context: null,
            p_source: 'user',
          })
        : await createOutfitWithoutWear(me, vars.itemIds, vars.title);

      if (vars.saveToLately) opIds.settle(actionKey);

      const { data, error } = await social
        .from('event_outfit_posts')
        .insert({
          event_id: vars.eventId,
          user_id: me,
          outfit_id: outfitId,
          caption,
        })
        .select('id')
        .single();
      if (error) throw error;

      return { outfitId, postId: (data as { id: string }).id };
    },

    onSuccess: (_result, vars) => {
      void qc.invalidateQueries({ queryKey: eventPostsKey(vars.eventId) });
      // The outfit that was just created (or, on the Lately path, worn) is
      // now part of the closet's own count and rails.
      void qc.invalidateQueries({ queryKey: ['wardrobe'] });
      void qc.invalidateQueries({ queryKey: ['closet'] });
      if (vars.saveToLately) void qc.invalidateQueries({ queryKey: ['worn-outfits'] });
    },
  });
}

export type SwapPiecesVars = {
  eventId: string;
  outfitId: string;
  /** The full replacement stack, in order. */
  itemIds: string[];
  title: string | null;
};

/**
 * "Swapping a piece edits in place and keeps the picks, because the look is
 * the same look." Replaces the outfit's items wholesale — delete then
 * reinsert in the new order — rather than diffing which piece changed: the
 * plate only ever needs to know the current stack, never the edit that
 * produced it, and a diff is one more place order could quietly drift.
 *
 * The post itself (`event_outfit_posts`, its votes, its comments) is
 * untouched — same `post_id`, same picks, same thread. Only `outfit_items`
 * and (when the title changed) `outfits.name` move.
 */
export function useSwapLookPieces() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: SwapPiecesVars): Promise<void> => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');
      if (vars.itemIds.length === 0) throw new Error('A look needs at least one piece.');

      const del = await social.from('outfit_items').delete().eq('outfit_id', vars.outfitId);
      if (del.error) throw del.error;

      const rows = vars.itemIds.map((item_id, i) => ({
        outfit_id: vars.outfitId,
        item_id,
        user_id: me,
        position: i,
      }));
      const ins = await social.from('outfit_items').insert(rows);
      if (ins.error) throw ins.error;

      if (vars.title) {
        const upd = await social
          .from('outfits')
          .update({ name: vars.title })
          .eq('id', vars.outfitId);
        if (upd.error) throw upd.error;
      }
    },

    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: eventPostsKey(vars.eventId) });
      void qc.invalidateQueries({ queryKey: ['wardrobe'] });
    },
  });
}
