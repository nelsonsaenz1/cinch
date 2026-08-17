/**
 * The narrow view of the Supabase client that private groups are allowed to
 * use.
 *
 * ── WHY A CAST AT ALL ─────────────────────────────────────────────────────
 *
 * `src/types/database.ts` is generated from the live database by
 * `npm run gen:types`, and `20260818000000_private_circles.sql` has not been
 * applied there yet, so the typed client cannot name `circles`,
 * `circle_members` or the `circle_member_count` RPC. Hand-editing the
 * generated file would be silently reverted by the next regen — the trap
 * `useFriendClosetMeta` already names — so the client is cast here instead,
 * once, and the regen makes every use of it a no-op rather than a lie.
 *
 * ── WHY THE CLIENT AND NOT THE METHOD ─────────────────────────────────────
 *
 * Pulling `rpc` or `from` off the object detaches its `this` and the builder
 * throws before the network. Same narrowing, and the same reasoning, as
 * `dailySocialDb`.
 *
 * ── WHY IT IS THIS NARROW ─────────────────────────────────────────────────
 *
 * The relation union is the entire set of things this feature may touch, and
 * `circle_members` deliberately exposes NO `delete()` — there is no DELETE
 * grant on that table, leaving is `left` and removal is `removed`, and a
 * builder that could express a delete is a builder someone will eventually
 * reach for. `social_profiles` is absent for the opposite reason: it is
 * already in the generated types and is read through the ordinary typed
 * client, which is the stronger guarantee of the two.
 */

import { supabase } from '@/lib/supabase';

/**
 * What PostgREST hands back. `data` stays `unknown`; the caller shapes it.
 *
 * The error carries `code` and `hint` as well as `message` because both are
 * load-bearing for `errors.ts`: `enforce_circle_size` raises
 * `check_violation` with the hint that names the cause, and every other
 * classification turns on the SQLSTATE.
 */
export interface CircleResult {
  data: unknown;
  error: CirclePostgrestError | null;
}

/** As much of `PostgrestError` as the classification actually reads. */
export interface CirclePostgrestError {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

/** The read builder, exactly as far as this feature chains it. */
export interface CircleSelect extends PromiseLike<CircleResult> {
  eq(column: string, value: string): CircleSelect;
  in(column: string, values: readonly string[]): CircleSelect;
  order(column: string, options: { ascending: boolean }): CircleSelect;
  maybeSingle(): PromiseLike<CircleResult>;
}

/** A write that returns the row it wrote — creation, and only creation. */
export interface CircleReturning extends PromiseLike<CircleResult> {
  select(columns: string): { single(): PromiseLike<CircleResult> };
}

/** The write builder. `eq` chains so an update can be scoped by both key columns. */
export interface CircleWrite extends PromiseLike<CircleResult> {
  eq(column: string, value: string): CircleWrite;
}

export interface CircleClient {
  from(relation: 'circles'): {
    select(columns: string): CircleSelect;
    insert(values: Record<string, unknown>): CircleReturning;
    update(values: Record<string, unknown>): CircleWrite;
    /** The owner's only delete, and the only delete in this feature. */
    delete(): CircleWrite;
  };
  from(relation: 'circle_members'): {
    select(columns: string): CircleSelect;
    /**
     * ONE ROW AT A TIME, and the signature is what enforces it.
     *
     * A row-level BEFORE trigger cannot see the other rows of its own
     * multi-row INSERT, so `enforce_circle_size` counting eleven and admitting
     * three is reachable with an array insert and unreachable without one.
     * 20260818000000:282-289 states that limit and says the client is what
     * makes it unreachable — this parameter type is that promise, in the
     * type system.
     */
    insert(values: Record<string, unknown>): CircleWrite;
    update(values: Record<string, unknown>): CircleWrite;
    // No `delete`. Departure (4) of the migration: leaving is a state, never
    // an erasure, and `authenticated` holds no DELETE grant to spend anyway.
  };
  /** One argument, returns an integer. Nothing else in this feature is an RPC. */
  rpc(fn: 'circle_member_count', args: { p_circle: string }): PromiseLike<CircleResult>;
}

/** The one place the cast happens. */
export function circlesDb(): CircleClient {
  return supabase as unknown as CircleClient;
}

/** PostgREST returns an array or nothing; anything else is not a row set. */
export function rowsOf<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}
