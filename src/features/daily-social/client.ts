/**
 * The narrow view of the Supabase client that Daily Social is allowed to use.
 *
 * ── WHY A CAST AT ALL ─────────────────────────────────────────────────────
 *
 * `src/types/database.ts` is generated from the live database by
 * `npm run gen:types`, and `20260817000000_daily_social.sql` has not been
 * applied there yet. So the typed client cannot name `friend_worn_outfits`,
 * `friend_worn_outfit_items`, `daily_social_reactions`, the RPC, or the new
 * `profiles.worn_outfits_shared_since` column. Hand-editing the generated file
 * would be silently reverted by the next regen — the trap `useFriendClosetMeta`
 * already names — so the client is cast instead, and the regen makes every
 * cast below a no-op rather than a lie.
 *
 * ── WHY THE CLIENT AND NOT THE METHOD ─────────────────────────────────────
 *
 * Pulling `rpc` or `from` off the object detaches its `this` and the builder
 * throws before the network. Same narrowing, and the same reasoning, as
 * `useActivityFeed` and `useInviteArrivals`.
 *
 * ── WHY IT IS THIS NARROW ─────────────────────────────────────────────────
 *
 * The relation union below is the entire set of things this feature may touch,
 * and the builder exposes only the operations it actually performs. A cast to
 * `any` would have been one line and would have let a later edit select
 * `reasoning` off `outfits` with nothing to stop it. This one refuses to
 * compile if the feature reaches somewhere it was not meant to go.
 */

import { supabase } from '@/lib/supabase';

/** What PostgREST hands back. `data` stays `unknown`; the caller shapes it. */
export interface DailySocialResult {
  data: unknown;
  error: { message: string } | null;
}

/** The read builder, exactly as far as this feature chains it. */
export interface DailySocialSelect extends PromiseLike<DailySocialResult> {
  order(column: string, options: { ascending: boolean }): DailySocialSelect;
  limit(count: number): DailySocialSelect;
  in(column: string, values: readonly string[]): DailySocialSelect;
  eq(column: string, value: string): DailySocialSelect;
}

/** The write builder — `update` and `delete` both scope with `eq`. */
export interface DailySocialWrite extends PromiseLike<DailySocialResult> {
  eq(column: string, value: string): DailySocialWrite;
}

/**
 * Everything Daily Social may reach.
 *
 * `profiles` is here for the owner's own `worn_outfits_shared_since` and for
 * nothing else. `friend_items` is deliberately ABSENT: it is already in the
 * generated types and is read through the ordinary typed client, which is the
 * stronger guarantee of the two.
 */
export type DailySocialRelation =
  | 'friend_worn_outfits'
  | 'friend_worn_outfit_items'
  | 'daily_social_reactions'
  | 'profiles';

export interface DailySocialClient {
  from(relation: DailySocialRelation): {
    select(columns: string): DailySocialSelect;
    /**
     * The reaction write. `on conflict (outfit_id, reactor_id) do update` is
     * exactly "changing your mind rewrites the one row" — the primary key
     * makes a second row impossible, so no tally can accumulate by accident.
     */
    upsert(values: Record<string, unknown>, options: { onConflict: string }): DailySocialWrite;
    update(values: Record<string, unknown>): DailySocialWrite;
    delete(): DailySocialWrite;
  };
  /** No arguments, returns an integer. Nothing else in this feature is an RPC. */
  rpc(fn: 'friends_sharing_worn_outfits_count'): PromiseLike<DailySocialResult>;
}

/** The one place the cast happens. */
export function dailySocialDb(): DailySocialClient {
  return supabase as unknown as DailySocialClient;
}

/** PostgREST returns an array or nothing; anything else is not a row set. */
export function rowsOf<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}
