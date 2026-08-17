import { useQuery } from '@tanstack/react-query';

import { getUserId } from '@/lib/supabase';

import { rowsOf, savedLooksDb } from './client';
import type { SavedCollectionRow, SavedLookRow } from './db-rows';
import type { SavedCollection, SavedLook } from './types';

/**
 * The reads for saved looks.
 *
 * ── WHAT THE SERVER HAS ALREADY DECIDED ───────────────────────────────────
 *
 * No predicate below says `owner_id = me`, and none should. `saved_looks`'
 * select policy is `(select auth.uid()) = owner_id` and `saved_looks_resolved`
 * is a `security_invoker` view over it, so the caller's own RLS applies
 * unchanged. **Privacy here is server-enforced, not filtered on arrival** —
 * which is the difference between a promise and a bug waiting for the day
 * somebody adds a query without the `.eq()`.
 *
 * The same holds for `boards`: four owner policies since 20260810100000.
 *
 * ── AND `availability` IS THE SERVER'S ANSWER TOO ─────────────────────────
 *
 * It arrives on every row of the view, recomputed from `can_save_source` at read
 * time. Nothing in this layer caches it, derives it, or repairs it: a save whose
 * source was un-shared five seconds ago comes back `unavailable` on the next
 * fetch with nothing to invalidate. That is why the whole feature reads the view
 * and never the table — `client.ts` types the table with no `select` at all, so
 * a read without availability is not expressible.
 *
 * ── THE PERSISTED CACHE IS THE OFFLINE STATE ──────────────────────────────
 *
 * OS-09b is "Showing your last synced looks", and it is these query keys under
 * the app's existing react-query persister rather than a second local store.
 * §13 classifies persistence as "Supabase client + RLS (existing). No new local
 * DB", and this is that line held: the offline screen is the cache, honestly
 * labelled.
 *
 * A cached save can be stale in exactly one direction that matters — it can say
 * `available` for a source that has since gone — and OS-09b's banner is what
 * makes that honest without a second mechanism. The moment the read succeeds,
 * the truth replaces it.
 */

/** Every save the caller has. */
export const SAVED_LOOKS_KEY = ['saved-looks'] as const;
/** One save, for its detail screen. */
export const savedLookKey = (saveId: string | null) => ['saved-look', saveId] as const;
/** The caller's collections. */
export const SAVED_COLLECTIONS_KEY = ['saved-collections'] as const;

/**
 * Every column of the view. Written out rather than `*` for the reason the rest
 * of this codebase writes them out: a `select('*')` silently starts shipping
 * whatever column is added next, and this view's columns are somebody's private
 * note and a snapshot of somebody else's look.
 */
const SAVED_COLUMNS =
  'id, owner_id, source_type, source_id, source_owner_id, collection_id, ' +
  'snap_title, snap_image_url, snap_source_label, snap_source_visibility, ' +
  'snap_saved_at, note, created_at, updated_at, availability';

/** Three of the seven `boards` columns. See `SavedCollectionRow` for the four omitted. */
const COLLECTION_COLUMNS = 'id, user_id, name';

/**
 * The wire row, as a screen sees it.
 *
 * `source_id` IS DROPPED HERE, and that is the point of having a mapping
 * boundary at all. It is a pointer into somebody else's data; the client's only
 * legitimate use for it was the availability recheck, and the server does that.
 * A component holding it is a component that will eventually try to follow it.
 */
export function toSavedLook(row: SavedLookRow): SavedLook {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceOwnerId: row.source_owner_id,
    collectionId: row.collection_id,
    title: row.snap_title,
    imageUrl: row.snap_image_url,
    sourceLabel: row.snap_source_label,
    sourceVisibility: row.snap_source_visibility,
    sourceAt: row.snap_saved_at,
    note: row.note,
    // `created_at` is when the SAVE was made; `snap_saved_at` is the moment the
    // source carried. OS-04 prints both, on adjacent lines, and swapping them
    // would date somebody's save to the day the look was worn.
    savedAt: row.created_at,
    availability: row.availability,
  };
}

/**
 * Every saved look, newest save first.
 *
 * ORDERED BY `created_at`, NOT `snap_saved_at`. This list is a record of the
 * reader's own acts, so it is ordered by when they acted — saving a look from
 * three weeks ago puts it at the top, because that is where they just put it.
 * Ordering by the source's date would bury a deliberate save under looks worn
 * more recently, which is the shelf reorganising itself.
 *
 * Unavailable saves are NOT filtered out. They are OS-03's and OS-06's drawn
 * tiles, they still carry the reader's note, and a list that dropped them would
 * make a revocation look like a deletion of the reader's own data.
 */
export function useSavedLooks() {
  return useQuery({
    queryKey: SAVED_LOOKS_KEY,
    queryFn: async (): Promise<SavedLook[]> => {
      const userId = await getUserId();
      // No session is not the same fact as "nothing saved". Resolving to `[]`
      // here would hand a session hiccup straight to OS-01, telling somebody
      // with fourteen saved looks how to make their first — the failure
      // `useCloset` documents at length and answers the same way.
      if (!userId) {
        throw new Error("Couldn't confirm your session. Check your connection and try again.");
      }

      const { data, error } = await savedLooksDb()
        .from('saved_looks_resolved')
        .select(SAVED_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return rowsOf<SavedLookRow>(data).map(toSavedLook);
    },
  });
}

/**
 * One saved look.
 *
 * `null` means the row is not there: removed here, removed on another device, or
 * never the caller's to see. Those are the same answer on purpose — a client
 * that could tell "deleted" from "not yours" would be an existence oracle over
 * uuids, and `resolveSavedDetailState` turns the null into `missing`, which pops
 * the screen rather than apologising.
 *
 * Fetched fresh rather than read out of the list cache, because `availability`
 * is a live answer and the list may have been sitting on screen for a while. The
 * detail is where "Plan this look" is offered, and offering it against a stale
 * `available` is the one place this feature could send somebody to a screen that
 * cannot work.
 */
export function useSavedLook(saveId: string | null) {
  return useQuery({
    queryKey: savedLookKey(saveId),
    enabled: Boolean(saveId),
    queryFn: async (): Promise<SavedLook | null> => {
      if (!saveId) return null; // `enabled` already guards; this narrows the type

      const { data, error } = await savedLooksDb()
        .from('saved_looks_resolved')
        .select(SAVED_COLUMNS)
        .eq('id', saveId)
        .maybeSingle();

      if (error) throw error;
      return data ? toSavedLook(data as SavedLookRow) : null;
    },
  });
}

/**
 * The caller's collections, alphabetical.
 *
 * ── THESE ARE `boards`, AND THE COUNT IS NOT READ FROM THE SERVER ─────────
 *
 * `savedCount` is filled in by the caller from the saves it already holds — see
 * `collectionCounts` in `states.ts`. A server count is a second number that can
 * disagree with the grid the reader is looking at, and a wrong number beside a
 * right list is read as the list being wrong.
 *
 * Every collection comes back, including the ones with nothing in them. An empty
 * collection is a real thing somebody made thirty seconds ago on the way to
 * filling it, and a list that hid it would look like the creation had failed.
 *
 * ALPHABETICAL, not newest-first, and deliberately unlike the saves list above.
 * These are shelves rather than events: the reader is looking for one by name,
 * and a set of names that reorders itself as they are used is a set nobody
 * builds muscle memory for.
 */
export function useSavedCollections() {
  return useQuery({
    queryKey: SAVED_COLLECTIONS_KEY,
    queryFn: async (): Promise<SavedCollection[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await savedLooksDb()
        .from('boards')
        .select(COLLECTION_COLUMNS)
        .order('name', { ascending: true });

      if (error) throw error;
      return rowsOf<SavedCollectionRow>(data).map((row) => ({
        id: row.id,
        name: row.name,
        // Zero until the caller merges the saves in. Not a lie for long, and a
        // better shape than an optional field every consumer has to defend.
        savedCount: 0,
      }));
    },
  });
}

/**
 * The collections with their counts filled in from a loaded set of saves.
 *
 * A function rather than a second query, because both halves are already in
 * hand and a join over two react-query results is a `useMemo` in the screen —
 * which is one more place for the two to be combined slightly differently.
 */
export function withSavedCounts(
  collections: readonly SavedCollection[],
  counts: ReadonlyMap<string, number>,
): SavedCollection[] {
  return collections.map((collection) => ({
    ...collection,
    savedCount: counts.get(collection.id) ?? 0,
  }));
}
