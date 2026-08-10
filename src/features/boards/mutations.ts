import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

import { boardsKey, savedPlatesKey } from './queries';
import type { IsoDay } from './types';

/**
 * Every write atlas 35 asks for: keeping a look, moving it, letting it go, and
 * the four things you can do to a board.
 *
 * All of them are plain owner-RLS statements. There is no `_tx` here and none
 * is needed: keeping a plate is one `update`, and the board writes are one
 * statement each. The single exception is keeping a look that is not yet an
 * `outfits` row at all — see `createOutfit` below, which follows the precedent
 * `share-look/mutations.ts` already set for exactly this shape.
 *
 * WHAT IS NOT HERE. Nothing in this file writes `origin_outfit_id`. The
 * lineage that makes "worn 6×" true is set at the moment of a CONFIRM, by
 * `wear_outfit_tx`'s `p_origin`, and the confirm lives in
 * `features/styling/mutations.ts` — another unit's file. Until a "wear this
 * again" passes the plate's id, every kept plate honestly reads "never worn",
 * which is what it is. Filed in `.redesign/primitive-requests/k.md`.
 */

/** Every cache a boards write can age out, in one place. */
function invalidate(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: savedPlatesKey });
  void qc.invalidateQueries({ queryKey: boardsKey });
}

// ---------------------------------------------------------------------------
// Keeping a look
// ---------------------------------------------------------------------------

/**
 * What the Keep sheet was raised over.
 *
 * `outfit` is a look that already exists as a row — a plate that was planned,
 * worn, posted, or is being moved between boards. `look` is a set of garments
 * that has never been persisted: Today's proposal, which lives only in memory
 * until somebody decides it is worth keeping.
 */
export type KeepTarget =
  | { kind: 'outfit'; outfitId: string }
  | { kind: 'look'; itemIds: string[] };

export type KeepVars = {
  target: KeepTarget;
  /**
   * The board it lands on. `null` is All, which is what "Keep it with nothing
   * selected" means — a plate always has somewhere to be, and All is not a
   * board, it is the absence of one.
   */
  boardId: string | null;
  /**
   * The name it is kept under. Never assembled from the garment list here.
   * Null is allowed and the card then falls back to the occasion, or to no
   * title at all.
   */
  name?: string | null;
};

/**
 * A look that has never been a row, made into one.
 *
 * Two statements, not a transaction, and the honest reason is that the schema
 * offers no command for it: `wear_outfit_tx` always marks the outfit worn, and
 * `plan_outfit_tx` always writes a calendar entry. Keeping is neither. The
 * precedent is `createOutfitWithoutWear` in `share-look/mutations.ts`, which
 * took the same door for the same reason.
 *
 * The exposure is a look with no pieces if the connection drops between the
 * two writes — visible as an empty tile, correctable by keeping again. That is
 * a worse failure mode than a transaction would have, and it is recorded in
 * the primitive request rather than papered over: a `keep_outfit_tx` is one
 * migration, and it belongs to whoever owns migrations.
 *
 * `.select('id')` after the insert is safe here: `outfits`'s INSERT and SELECT
 * policies check `(select auth.uid()) = user_id` and call no STABLE function,
 * so this is not the RETURNING trap the social tables hit.
 */
async function createOutfit(
  userId: string,
  itemIds: string[],
  name: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from('outfits')
    .insert({ user_id: userId, name, generated_by: 'user' })
    .select('id')
    .single();
  if (error) throw error;

  const outfitId = data.id;

  const { error: itemsError } = await supabase.from('outfit_items').insert(
    itemIds.map((item_id, position) => ({
      outfit_id: outfitId,
      item_id,
      user_id: userId,
      position,
    })),
  );
  if (itemsError) throw itemsError;

  return outfitId;
}

/**
 * Keep a look, or move a kept one.
 *
 * ONE MUTATION FOR BOTH, because the atlas says they are one action: "a plate
 * sits on one board at a time; moving it is one tap in the same sheet that
 * saved it". Two hooks would let the two paths drift, and the sheet would then
 * have to decide which it was looking at — which is exactly the decision the
 * design removed.
 *
 * `saved_at` is set unconditionally rather than only when null. Re-keeping a
 * plate is not a thing a user can express, and moving one to another board is
 * not a re-keeping — but a row whose `saved_at` was somehow cleared and is now
 * being kept again should carry the moment it was kept, not the moment it was
 * first generated.
 */
export function useKeepPlate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ target, boardId, name = null }: KeepVars): Promise<string> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const outfitId =
        target.kind === 'outfit'
          ? target.outfitId
          : await createOutfit(userId, target.itemIds, name);

      const patch: { saved_at: string; board_id: string | null; name?: string | null } = {
        saved_at: new Date().toISOString(),
        board_id: boardId,
      };
      // A move must not rename. The name only travels when the caller had one
      // to give — otherwise a plate moved between boards would quietly lose
      // the title it was kept under.
      if (name != null) patch.name = name;

      const { error } = await supabase
        .from('outfits')
        .update(patch)
        .eq('id', outfitId)
        .eq('user_id', userId);
      if (error) throw error;

      return outfitId;
    },

    // NOT TRACKED. `AppEvent` in `lib/posthog.tsx` is a closed union in the
    // shared layer, and this unit does not edit shared files to add a member
    // to it. The events worth having — a plate kept, a board created, whether
    // it was dated — are named in `.redesign/primitive-requests/k.md` rather
    // than smuggled in as a string cast.
    onSuccess: () => invalidate(qc),
  });
}

/**
 * Take a plate out of the lookbook.
 *
 * DELETES THE OUTFIT ROW, which takes `outfit_items` with it on cascade and
 * touches `items` not at all — KP-05's "deleting a plate is confirmed once,
 * and never cascades to the pieces". The confirm is the caller's; this is only
 * the write.
 *
 * A plate that has wears hanging off it keeps them: `origin_outfit_id` is
 * `on delete set null`, so the history of having worn a look survives the look
 * being un-kept. It is the same reasoning as the board's own `set null`.
 */
export function useDeletePlate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (outfitId: string) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { error } = await supabase
        .from('outfits')
        .delete()
        .eq('id', outfitId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export type BoardWrite = {
  name: string;
  /** Both or neither. `boardDraftProblem` refuses a half-range before this. */
  startsOn?: IsoDay | null;
  endsOn?: IsoDay | null;
};

export function useCreateBoard() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, startsOn = null, endsOn = null }: BoardWrite): Promise<string> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { data, error } = await supabase
        .from('boards')
        .insert({ user_id: userId, name: name.trim(), starts_on: startsOn, ends_on: endsOn })
        .select('id')
        .single();
      if (error) throw error;

      return data.id;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...write }: BoardWrite & { id: string }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { error } = await supabase
        .from('boards')
        .update({
          name: write.name.trim(),
          starts_on: write.startsOn ?? null,
          ends_on: write.endsOn ?? null,
        })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

/**
 * Delete the board and keep the plates.
 *
 * There is nothing to do here beyond the one statement, and that is the point:
 * `outfits.board_id` is declared `on delete set null`, so "deleting a board
 * keeps the plates — they return to All" is enforced by the schema rather than
 * by a client that remembers to reassign them. A loop here would be a second,
 * weaker copy of a rule the database already holds.
 */
export function useDeleteBoard() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (boardId: string) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { error } = await supabase
        .from('boards')
        .delete()
        .eq('id', boardId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}
