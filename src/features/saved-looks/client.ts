/**
 * The narrow view of the Supabase client that saved looks are allowed to use.
 *
 * ── WHY A CAST AT ALL ─────────────────────────────────────────────────────
 *
 * `src/types/database.ts` is generated from the live database by
 * `npm run gen:types`, and `20260821000000_saved_looks.sql` has not been applied
 * there yet, so the typed client cannot name `saved_looks` or
 * `saved_looks_resolved`. Hand-editing the generated file would be silently
 * reverted by the next regen — the trap `useFriendClosetMeta` already names — so
 * the client is cast here instead, once, and the regen makes every use of it a
 * no-op rather than a lie.
 *
 * ── WHY THE CLIENT AND NOT THE METHOD ─────────────────────────────────────
 *
 * Pulling `from` off the object detaches its `this` and the builder throws
 * before the network. Same narrowing, and the same reasoning, as `circlesDb`.
 *
 * ── WHY IT IS THIS NARROW ─────────────────────────────────────────────────
 *
 * The relation union is the entire set of things this feature may touch, and
 * two of the three shapes are deliberately incomplete:
 *
 * · `saved_looks_resolved` exposes NO write verb. It is a view with a computed
 *   column, so it is not auto-updatable and the migration grants SELECT alone —
 *   a builder that could express an insert on it is a builder someone will
 *   eventually reach for and then debug for an afternoon.
 * · `saved_looks` exposes no `select`. Every read goes through the view,
 *   because a read of the table is a read with `availability` missing, and the
 *   one thing this feature must never do is draw a save without knowing whether
 *   its source is still there.
 *
 * `boards` is the collections table — see `types.ts` for why there is no second
 * one — and is reached through this client rather than the generated one only so
 * that the whole feature has a single door. It is already in the generated
 * types, which is the stronger guarantee; nothing here widens it.
 */

import { supabase } from '@/lib/supabase';

/**
 * What PostgREST hands back. `data` stays `unknown`; the caller shapes it.
 *
 * The error carries `code`, `details` and `hint` as well as `message` because
 * the first is what `errors.ts` classifies on: the unique constraint's 23505 is
 * the duplicate-save state, and the immutability trigger's 42501 is a client
 * bug. A wrapped `new Error(message)` would flatten both into "unknown".
 */
export interface SavedResult {
  data: unknown;
  error: SavedPostgrestError | null;
}

/** As much of `PostgrestError` as the classification actually reads. */
export interface SavedPostgrestError {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

/** The read builder, exactly as far as this feature chains it. */
export interface SavedSelect extends PromiseLike<SavedResult> {
  eq(column: string, value: string): SavedSelect;
  order(column: string, options: { ascending: boolean }): SavedSelect;
  maybeSingle(): PromiseLike<SavedResult>;
}

/** A write that returns the row it wrote — creation, and only creation. */
export interface SavedReturning extends PromiseLike<SavedResult> {
  select(columns: string): { single(): PromiseLike<SavedResult> };
}

/** The write builder. `eq` chains so an update can be scoped by owner and id. */
export interface SavedWrite extends PromiseLike<SavedResult> {
  eq(column: string, value: string): SavedWrite;
}

export interface SavedClient {
  /** Reads only. The view is where `availability` comes from. */
  from(relation: 'saved_looks_resolved'): {
    select(columns: string): SavedSelect;
  };
  /**
   * Writes only. A read here would be a read without `availability`, and a
   * saved look drawn without it is a saved look drawn as if a source that may
   * be gone is still there.
   */
  from(relation: 'saved_looks'): {
    /**
     * ONE ROW AT A TIME. A save is one tap on one look; there is no batch
     * anywhere in the atlas, and an array insert would meet the unique
     * constraint as a whole-statement failure rather than as the per-row
     * duplicate state OS-02 draws.
     */
    insert(values: Record<string, unknown>): SavedReturning;
    update(values: Record<string, unknown>): SavedWrite;
    delete(): SavedWrite;
  };
  /** Collections. See `types.ts`: a collection is a board, and there is one table. */
  from(relation: 'boards'): {
    select(columns: string): SavedSelect;
    insert(values: Record<string, unknown>): SavedReturning;
    update(values: Record<string, unknown>): SavedWrite;
    delete(): SavedWrite;
  };
}

/** The one place the cast happens. */
export function savedLooksDb(): SavedClient {
  return supabase as unknown as SavedClient;
}

/** PostgREST returns an array or nothing; anything else is not a row set. */
export function rowsOf<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}
