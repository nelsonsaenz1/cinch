/**
 * The narrow view of the Supabase client the Activity Center is allowed to use.
 *
 * ── WHY A CAST AT ALL ─────────────────────────────────────────────────────
 *
 * `src/types/database.ts` is generated from the live database by
 * `npm run gen:types`, and `20260820000000_activity_center.sql` has not been
 * applied there yet, so the typed client cannot name `activity_events` or the
 * `activity_has_unseen` RPC. Hand-editing the generated file would be silently
 * reverted by the next regen — the trap `useFriendClosetMeta` already names —
 * so the client is cast here instead, once, and the regen makes every use of it
 * a no-op rather than a lie.
 *
 * ── WHY THE CLIENT AND NOT THE METHOD ─────────────────────────────────────
 *
 * Pulling `rpc` or `from` off the object detaches its `this` and the builder
 * throws before the network. Same narrowing, and the same reasoning, as
 * `circlesDb` and `dailySocialDb`.
 *
 * ── THERE IS NO `insert` ON THIS INTERFACE ────────────────────────────────
 *
 * Not because it would fail — though it would, there is no INSERT grant — but
 * because a builder that can express a forged inbox row is a builder somebody
 * eventually reaches for while debugging and then leaves behind. The absence is
 * the same instrument `CircleClient` uses to keep a DELETE off `circle_members`,
 * and it is checked in the database by `21_activity_center.sql` assertion 2 so
 * the type is not the only thing standing there.
 */

import { supabase } from '@/lib/supabase';

/** What PostgREST hands back. `data` stays `unknown`; the caller shapes it. */
export interface ActivityResult {
  data: unknown;
  error: ActivityPostgrestError | null;
}

/** As much of `PostgrestError` as `classifyActivityError` actually reads. */
export interface ActivityPostgrestError {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

/** The read builder, exactly as far as this feature chains it. */
export interface ActivitySelect extends PromiseLike<ActivityResult> {
  eq(column: string, value: string): ActivitySelect;
  is(column: string, value: null): ActivitySelect;
  in(column: string, values: readonly string[]): ActivitySelect;
  order(column: string, options: { ascending: boolean }): ActivitySelect;
  maybeSingle(): PromiseLike<ActivityResult>;
}

/** The write builder. `eq`/`is`/`in` chain so a write can be scoped precisely. */
export interface ActivityWrite extends PromiseLike<ActivityResult> {
  eq(column: string, value: string): ActivityWrite;
  is(column: string, value: null): ActivityWrite;
  in(column: string, values: readonly string[]): ActivityWrite;
}

export interface ActivityClient {
  from(relation: 'activity_events'): {
    select(columns: string): ActivitySelect;
    /** Two columns move, and the trigger refuses the other nine. */
    update(values: Record<string, unknown>): ActivityWrite;
    /** Clear All, and the hard half of a dismissal. Scoped to self by policy. */
    delete(): ActivityWrite;
    // No `insert`. See the header.
  };
  /** The dot. Takes nothing, returns a boolean, and cannot be asked about anybody else. */
  rpc(fn: 'activity_has_unseen'): PromiseLike<ActivityResult>;
}

/** The one place the cast happens. */
export function activityDb(): ActivityClient {
  return supabase as unknown as ActivityClient;
}

/** PostgREST returns an array or nothing; anything else is not a row set. */
export function rowsOf<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}
