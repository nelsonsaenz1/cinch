import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { createOperationIds, runCommand } from '@/lib/commands';
import { dateKey } from '@/lib/date';
import { track } from '@/lib/posthog';
import { getUserId } from '@/lib/supabase';

import {
  SAVED_EVENTS,
  collectionCreatedProps,
  collectionDeletedProps,
  collectionRenamedProps,
  confirmationUndoProps,
  planCreatedProps,
  saveCreatedProps,
  saveRemovedProps,
  type RemoveVia,
} from './analytics';
import { savedLooksDb, type SavedPostgrestError } from './client';
import type { SavedCollectionRow, SavedLookRow } from './db-rows';
import { classifySavedError } from './errors';
import {
  SAVED_COLLECTIONS_KEY,
  SAVED_LOOKS_KEY,
  savedLookKey,
  toSavedLook,
} from './queries';
import type { SavedCollection, SavedLook, SavedLookSource } from './types';

/**
 * Every verb a saved look has.
 *
 * ── THE DUPLICATE IS THE DATABASE'S ANSWER, NOT THE INTERFACE'S ───────────
 *
 * `useCreateSave` does not check whether the look is already saved. It writes,
 * and if `saved_looks_once` refuses it, it fetches the row that already exists
 * and reports `wasDuplicate`. That order is deliberate: a client-side check is a
 * race with itself the moment the same person has two devices, and the whole
 * reason OS-02c is a drawn state rather than a disabled button is that the
 * answer arrives from the server.
 *
 * ── AN INSERT THAT IS REFUSED IS NOT AN ERROR TO APOLOGISE FOR ────────────
 *
 * `saved_looks: owner can insert a source they can see` refuses a look that
 * expired or was un-shared between the screen being drawn and the tap landing.
 * That is `no_access`, `savedFailureIsInline` says to print it beside the
 * control, and NOTHING IS WRITTEN — §10's `blocked(inline error, no write)`. The
 * error is thrown whole so `errors.ts` can classify on the SQLSTATE; wrapping it
 * in `new Error(message)` would flatten the duplicate and the refusal into one
 * unknown failure at the exact moment the interface has something useful to say.
 *
 * ── OPTIMISM, IN THE `useCircles` SHAPE ───────────────────────────────────
 *
 * Snapshot in `onMutate`, roll back in `onError`, invalidate in `onSettled`.
 * Removal, the note and the collection are painted immediately: a Remove that
 * waits for the network reads as a tap that did not land, and OS-07's confirm
 * has already been through a sheet.
 *
 * CREATION IS THE EXCEPTION and is not painted. A save's id is the server's to
 * mint, and a provisional card in the grid is a card that cannot be opened —
 * worse than one that appears a beat later, because the tap that opens it fails.
 * The toast is what confirms the save; the grid catches up.
 */

/** What a rollback needs. */
interface SavedSnapshot {
  saves?: SavedLook[];
  collections?: SavedCollection[];
  detail?: SavedLook | null;
  detailId?: string;
}

function snapshotLists(qc: QueryClient): SavedSnapshot {
  return {
    saves: qc.getQueryData<SavedLook[]>(SAVED_LOOKS_KEY),
    collections: qc.getQueryData<SavedCollection[]>(SAVED_COLLECTIONS_KEY),
  };
}

function restore(qc: QueryClient, snapshot: SavedSnapshot | undefined): void {
  if (!snapshot) return;
  if (snapshot.saves) qc.setQueryData(SAVED_LOOKS_KEY, snapshot.saves);
  if (snapshot.collections) qc.setQueryData(SAVED_COLLECTIONS_KEY, snapshot.collections);
  if (snapshot.detailId && snapshot.detail !== undefined) {
    qc.setQueryData(savedLookKey(snapshot.detailId), snapshot.detail);
  }
}

/**
 * Everything a save or a collection change can invalidate.
 *
 * Both lists every time, rather than a per-verb subset. Moving a save between
 * collections changes two chip counts and the grid; deleting a collection
 * changes every save that pointed at it. A verb that invalidated one of the two
 * would leave a chip showing yesterday for as long as its screen stayed mounted.
 */
function invalidateAll(qc: QueryClient, saveId?: string): void {
  void qc.invalidateQueries({ queryKey: SAVED_LOOKS_KEY });
  void qc.invalidateQueries({ queryKey: SAVED_COLLECTIONS_KEY });
  if (saveId) void qc.invalidateQueries({ queryKey: savedLookKey(saveId) });
}

function throwIf(error: SavedPostgrestError | null): void {
  // The object, not its message: `errors.ts` classifies on `code`.
  if (error) throw error;
}

/** Paint a save's new shape into both the list and its own detail entry. */
function patchSave(qc: QueryClient, saveId: string, patch: Partial<SavedLook>): SavedSnapshot {
  const saves = qc.getQueryData<SavedLook[]>(SAVED_LOOKS_KEY);
  const detail = qc.getQueryData<SavedLook | null>(savedLookKey(saveId));

  if (saves) {
    qc.setQueryData(
      SAVED_LOOKS_KEY,
      saves.map((save) => (save.id === saveId ? { ...save, ...patch } : save)),
    );
  }
  if (detail) qc.setQueryData(savedLookKey(saveId), { ...detail, ...patch });

  return { saves, detail, detailId: saveId };
}

// ---------------------------------------------------------------------------
// Keeping one, and letting it go
// ---------------------------------------------------------------------------

/**
 * What the source surface knows about the look it is offering to save.
 *
 * Everything here was on the reader's screen a moment ago, which is the whole
 * definition of what a snapshot may contain. No garment, no item id, no size, no
 * link — and the schema has no column for any of them, so this shape and the
 * table's promise are the same promise.
 */
export interface SaveLookInput {
  sourceType: SavedLookSource;
  sourceId: string;
  sourceOwnerId: string | null;
  title: string | null;
  imageUrl: string | null;
  /** "Maya's Daily look", "Your outfit", "Jordan's event". */
  sourceLabel: string;
  /** "Visible to your Circle", "Event look", "Private" — as it is right now. */
  sourceVisibility: string;
  /** When the source look was worn or posted. ISO. */
  sourceAt: string;
}

/** What the caller gets back: the row, and whether it was already there. */
export interface SaveLookResult {
  save: SavedLook;
  wasDuplicate: boolean;
}

const SAVED_COLUMNS_RETURNING =
  'id, owner_id, source_type, source_id, source_owner_id, collection_id, ' +
  'snap_title, snap_image_url, snap_source_label, snap_source_visibility, ' +
  'snap_saved_at, note, created_at, updated_at';

/**
 * Save a look — OS-02.
 *
 * The insert returns the row it wrote, so the toast can offer Undo against a
 * real id rather than waiting for a refetch. It returns it from the TABLE, which
 * has no `availability` column, so the value is filled in as `available` here —
 * and it is not a guess: the insert only landed because `can_save_source`
 * answered true inside the same statement.
 *
 * On 23505 the row already exists and is fetched instead. That read goes through
 * the VIEW, because a duplicate may well be a save whose source has since gone —
 * somebody tapping the bookmark on a look they kept weeks ago — and "Already in
 * your looks" leading to a detail that is honestly unavailable is the correct
 * pair of screens.
 */
export function useCreateSave() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveLookInput): Promise<SaveLookResult> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { data, error } = await savedLooksDb()
        .from('saved_looks')
        .insert({
          owner_id: userId,
          source_type: input.sourceType,
          source_id: input.sourceId,
          source_owner_id: input.sourceOwnerId,
          snap_title: input.title,
          snap_image_url: input.imageUrl,
          snap_source_label: input.sourceLabel,
          snap_source_visibility: input.sourceVisibility,
          snap_saved_at: input.sourceAt,
        })
        .select(SAVED_COLUMNS_RETURNING)
        .single();

      if (!error) {
        const row = data as SavedLookRow;
        return {
          // Available by construction: the insert policy called
          // `can_save_source` in this very statement and it answered true.
          save: toSavedLook({ ...row, availability: 'available' }),
          wasDuplicate: false,
        };
      }

      if (classifySavedError(error).kind !== 'duplicate') throw error;

      const existing = await savedLooksDb()
        .from('saved_looks_resolved')
        .select(`${SAVED_COLUMNS_RETURNING}, availability`)
        .eq('source_id', input.sourceId)
        .maybeSingle();

      throwIf(existing.error);
      // A duplicate whose row cannot then be read is a genuine failure, not a
      // second duplicate: the unique constraint fired, so a row exists and it is
      // this caller's. Re-throwing the original keeps the classification honest.
      if (!existing.data) throw error;

      return { save: toSavedLook(existing.data as SavedLookRow), wasDuplicate: true };
    },

    onSuccess: (result, input) => {
      track(
        SAVED_EVENTS.saveCreated,
        saveCreatedProps({
          sourceType: input.sourceType,
          hadImage: Boolean(input.imageUrl),
          wasDuplicate: result.wasDuplicate,
        }),
      );
    },
    onSettled: () => invalidateAll(qc),
  });
}

/**
 * Remove a save — OS-07, and Undo inside the five-second window.
 *
 * ONE VERB FOR BOTH, and `via` is what tells them apart. An Undo is a removal of
 * a save made a moment ago; making it a second mutation would be a second place
 * for the delete to be written and a second cache path to keep in step. What
 * differs is the analytics, and that is one branch rather than one function.
 *
 * `via` also measures OS-07's own claim. The atlas requires every gesture to
 * have a visible control; if `swipe` dominates in the field, the visible control
 * is not discoverable, whatever the component tree says.
 */
export function useDeleteSave() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ saveId }: { saveId: string; sourceType: SavedLookSource; via: RemoveVia | 'undo' }) => {
      const { error } = await savedLooksDb().from('saved_looks').delete().eq('id', saveId);
      throwIf(error);
    },

    onMutate: async ({ saveId }) => {
      await qc.cancelQueries({ queryKey: SAVED_LOOKS_KEY });
      const snapshot = snapshotLists(qc);
      if (snapshot.saves) {
        qc.setQueryData(
          SAVED_LOOKS_KEY,
          snapshot.saves.filter((save) => save.id !== saveId),
        );
      }
      return { ...snapshot, detailId: saveId, detail: qc.getQueryData<SavedLook | null>(savedLookKey(saveId)) };
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: (_data, { sourceType, via }) => {
      if (via === 'undo') {
        track(SAVED_EVENTS.confirmationUndo, confirmationUndoProps());
        return;
      }
      track(SAVED_EVENTS.saveRemoved, saveRemovedProps({ sourceType, via }));
    },
    onSettled: (_data, _error, { saveId }) => {
      invalidateAll(qc);
      // The save is gone; its cached detail is not a thing to refetch.
      qc.removeQueries({ queryKey: savedLookKey(saveId) });
    },
  });
}

/**
 * Write the reader's own note.
 *
 * NO ANALYTICS EVENT. A note is the most private thing in this feature and
 * "somebody wrote a note" is measured where it is useful and harmless —
 * `saved_detail_viewed`'s `has_note` — rather than as an event that fires on
 * every keystroke's commit and correlates a moment with a person.
 *
 * An empty note is stored as null rather than as `''`, so "no note" is one value
 * everywhere and `has_note` cannot disagree with the card that draws it.
 */
export function useUpdateSaveNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ saveId, note }: { saveId: string; note: string }) => {
      const trimmed = note.trim();
      const { error } = await savedLooksDb()
        .from('saved_looks')
        .update({ note: trimmed === '' ? null : trimmed })
        .eq('id', saveId);
      throwIf(error);
    },

    onMutate: async ({ saveId, note }) => {
      await qc.cancelQueries({ queryKey: savedLookKey(saveId) });
      const trimmed = note.trim();
      return patchSave(qc, saveId, { note: trimmed === '' ? null : trimmed });
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSettled: (_data, _error, { saveId }) => invalidateAll(qc, saveId),
  });
}

/**
 * Move a save onto a collection, or off every collection.
 *
 * `null` is a real argument and not an absence: OS-05's "All" and the detail's
 * "Move to…" both need a way to say "no shelf", and an optional parameter would
 * make "leave it where it is" and "take it off" the same call.
 */
export function useMoveSave() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ saveId, collectionId }: { saveId: string; collectionId: string | null }) => {
      const { error } = await savedLooksDb()
        .from('saved_looks')
        .update({ collection_id: collectionId })
        .eq('id', saveId);
      throwIf(error);
    },

    onMutate: async ({ saveId, collectionId }) => {
      await qc.cancelQueries({ queryKey: SAVED_LOOKS_KEY });
      return patchSave(qc, saveId, { collectionId });
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSettled: (_data, _error, { saveId }) => invalidateAll(qc, saveId),
  });
}

// ---------------------------------------------------------------------------
// Collections — which are boards. See `types.ts`.
// ---------------------------------------------------------------------------

/**
 * Make a collection.
 *
 * Writes `name` and NOTHING ELSE. `boards` may also carry a paired
 * `starts_on`/`ends_on` — "dates make it a trip" — and a collection made from
 * the Saved surface is not a trip. Leaving them null is what keeps the two
 * readings of one table distinguishable without a discriminator column nobody
 * asked for.
 *
 * Not painted optimistically, for `useCreateCircle`'s reason: the id is the
 * server's to mint, and OS-02b's sheet selects the collection it just created,
 * which a provisional id cannot survive.
 */
export function useCreateCollection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: { name: string }): Promise<SavedCollection> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { data, error } = await savedLooksDb()
        .from('boards')
        .insert({ user_id: userId, name: name.trim() })
        .select('id, user_id, name')
        .single();

      throwIf(error);
      const row = data as SavedCollectionRow;
      return { id: row.id, name: row.name, savedCount: 0 };
    },

    onSuccess: (_created) => {
      const collections = qc.getQueryData<SavedCollection[]>(SAVED_COLLECTIONS_KEY) ?? [];
      // The bucket is of the count AFTER this one lands, which the cache does
      // not yet show — hence the `+ 1` rather than a read of a stale list.
      track(SAVED_EVENTS.collectionCreated, collectionCreatedProps(collections.length + 1));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: SAVED_COLLECTIONS_KEY });
    },
  });
}

/** Rename a collection. Owner only — the UPDATE policy refuses everyone else's row. */
export function useRenameCollection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ collectionId, name }: { collectionId: string; name: string }) => {
      const { error } = await savedLooksDb()
        .from('boards')
        .update({ name: name.trim() })
        .eq('id', collectionId);
      throwIf(error);
    },

    onMutate: async ({ collectionId, name }) => {
      await qc.cancelQueries({ queryKey: SAVED_COLLECTIONS_KEY });
      const snapshot = snapshotLists(qc);
      if (snapshot.collections) {
        qc.setQueryData(
          SAVED_COLLECTIONS_KEY,
          snapshot.collections.map((collection) =>
            collection.id === collectionId ? { ...collection, name: name.trim() } : collection,
          ),
        );
      }
      return snapshot;
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: () => {
      track(SAVED_EVENTS.collectionRenamed, collectionRenamedProps());
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: SAVED_COLLECTIONS_KEY });
    },
  });
}

/**
 * Delete a collection. THE LOOKS INSIDE STAY.
 *
 * That is `saved_looks.collection_id`'s `on delete set null`, asserted in
 * 21_saved_looks.sql at 23 — not something this function does, and not something
 * it could get wrong. What it does do is paint the detachment, so the grid does
 * not briefly show cards belonging to a shelf that no longer exists.
 *
 * `memberCount` is passed in rather than counted here: the caller has the loaded
 * saves and `collectionCounts` already, and a second count taken at a different
 * moment is a second number that can disagree with the sentence the reader just
 * read in the confirm sheet.
 */
export function useDeleteCollection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ collectionId }: { collectionId: string; memberCount: number }) => {
      const { error } = await savedLooksDb().from('boards').delete().eq('id', collectionId);
      throwIf(error);
    },

    onMutate: async ({ collectionId }) => {
      await qc.cancelQueries({ queryKey: SAVED_COLLECTIONS_KEY });
      await qc.cancelQueries({ queryKey: SAVED_LOOKS_KEY });
      const snapshot = snapshotLists(qc);

      if (snapshot.collections) {
        qc.setQueryData(
          SAVED_COLLECTIONS_KEY,
          snapshot.collections.filter((collection) => collection.id !== collectionId),
        );
      }
      if (snapshot.saves) {
        qc.setQueryData(
          SAVED_LOOKS_KEY,
          snapshot.saves.map((save) =>
            save.collectionId === collectionId ? { ...save, collectionId: null } : save,
          ),
        );
      }
      return snapshot;
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: (_data, { memberCount }) => {
      track(SAVED_EVENTS.collectionDeleted, collectionDeletedProps(memberCount));
    },
    onSettled: () => invalidateAll(qc),
  });
}

// ---------------------------------------------------------------------------
// Turning a save into a plan — OS-08
// ---------------------------------------------------------------------------

/**
 * Create a plan from the matched half of a saved look.
 *
 * ── THE ONLY THING THAT REACHES THE PLAN IS THE READER'S OWN GARMENTS ─────
 *
 * `itemIds` comes from `planItemIds`, which returns closet item ids and nothing
 * else. `plan_outfit_tx` verifies ownership again on the server ("one or more of
 * those items is not yours"), so the claim is kept twice: once by the matcher's
 * shape and once by the transaction.
 *
 * NOTHING ABOUT THE SAVE IS WRITTEN INTO THE PLAN except its title, and even
 * that is the snapshot title the reader has been looking at. No source id, no
 * provenance, no note: a plan is a thing in the reader's own week, and a plan
 * that carried a pointer to somebody else's look would make the deletion
 * semantics of two features depend on each other.
 *
 * `createOperationIds` survives across renders so a retried tap replays the same
 * operation rather than making a second plan — the failure `usePlanOutfit`
 * documents, answered the same way and with the same key shape.
 */
export function useCreatePlanFromSave() {
  const qc = useQueryClient();
  const opIds = useRef(createOperationIds()).current;

  return useMutation({
    mutationFn: async ({
      itemIds,
      date,
      title,
    }: {
      itemIds: readonly string[];
      date: Date;
      title: string | null;
      hadMissing: boolean;
    }): Promise<string> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');
      if (itemIds.length === 0) throw new Error('A plan needs at least one piece.');

      const planned = dateKey(date);
      // Same clothes, same day = the same intention being retried.
      const actionKey = `${planned}|${[...itemIds].join('.')}`;

      const outfitId = await runCommand('plan_outfit_tx', {
        p_op_id: opIds.for(actionKey),
        p_item_ids: [...itemIds],
        p_planned_date: planned,
        p_name: title ?? undefined,
        p_note: undefined,
      });

      opIds.settle(actionKey);
      return outfitId;
    },

    onSuccess: (_outfitId, { itemIds, hadMissing }) => {
      track(
        SAVED_EVENTS.planCreated,
        planCreatedProps({ piecesUsed: itemIds.length, hadMissing }),
      );
      // The plan lands in the reader's week, which is a different feature's
      // cache. Same key `usePlanOutfit` invalidates.
      void qc.invalidateQueries({ queryKey: ['planned-week'] });
    },
  });
}
