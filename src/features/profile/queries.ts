import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getUserId, supabase } from '@/lib/supabase';

import { handleProblem, normaliseHandle } from './handle';

/**
 * Reads for the user's OWN profile — the row behind the closet masthead and
 * the edit form.
 *
 * Distinct from `features/social-graph/queries.ts`, which reads OTHER people
 * through the `social_profiles` projection. Nothing here goes through a
 * projection view: this is the base `profiles` row, and RLS's owner policy is
 * what makes that safe (`profiles: owner can select`, 20260803154431).
 */

/** Everything the edit form can change. Mirrors the columns, not the screen. */
export type EditableProfile = {
  displayName: string;
  /** The claimed `@handle`, without the `@`. Empty string when unclaimed. */
  username: string;
  bio: string;
  /** Public URL of the current avatar object, or null. */
  avatarUrl: string | null;
};

/**
 * The signed-in user's profile row, in the shape the form edits.
 *
 * Strings rather than nullable strings: a form field's empty state is `''`,
 * and translating null → '' at the boundary keeps every `value={}` in the
 * form free of `?? ''`. The write direction translates back (mutations.ts) —
 * an empty bio is stored as NULL, not as a zero-length string, because the
 * column's meaning is "she has not written one".
 */
export function useMyProfile() {
  return useQuery({
    queryKey: ['my-profile'],
    queryFn: async ({ signal }): Promise<EditableProfile | null> => {
      const userId = await getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, username, bio, avatar_url')
        .eq('user_id', userId)
        .abortSignal(signal)
        .maybeSingle();

      if (error) throw error;

      return {
        displayName: data?.display_name ?? '',
        username: data?.username ?? '',
        bio: data?.bio ?? '',
        avatarUrl: data?.avatar_url ?? null,
      };
    },
  });
}

/**
 * Is this handle free?
 *
 * Answered by a SECURITY DEFINER function (20260807110000), not by a select.
 * `profiles` RLS shows the caller her own row plus rows whose visibility is
 * public, so a client-side existence check reports "available" for every
 * handle held by a private account — the form would promise a handle it
 * cannot deliver. The function sees all of them and returns nothing but a
 * boolean.
 *
 * Debounced by 400ms in `useHandleAvailability` below: this runs while
 * someone is typing, and a round trip per keystroke is both rude and useless
 * — the answer for "dan" is not the answer for "dana".
 *
 * An error is NOT a verdict. If the RPC is missing (the migration has not been
 * deployed yet) or the network is down, the form falls back to saying nothing
 * about availability and lets the save's own 23505 translation speak.
 */
async function isHandleFree(handle: string): Promise<boolean> {
  // The generated `Database` type is regenerated from production, where this
  // function does not exist until the migration ships — so `supabase.rpc`
  // cannot know its name yet. One narrow cast here beats hand-editing the
  // generated types file, which the next regen would silently revert.
  // Cast the CLIENT, not the method: pulling `rpc` off the object detaches its
  // `this`, and the builder reads `this.rest` on invocation — every check then
  // threw before reaching the network, which the error-tolerant design below
  // silently rendered as "no verdict". The field looked idle instead of broken.
  const client = supabase as unknown as {
    rpc(
      fn: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };

  const { data, error } = await client.rpc('username_available', { p_username: handle });
  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * The claim field's live verdict on what is being typed.
 *
 * `taken` is the only state that blocks a save. `unknown` covers both "still
 * typing" and "the check itself failed", because those are the same thing to
 * the user: no promise either way, and the save is still allowed to try.
 */
export type HandleAvailability = 'unknown' | 'checking' | 'free' | 'taken';

export function useHandleAvailability(raw: string, currentHandle: string): HandleAvailability {
  const handle = normaliseHandle(raw);
  const [settled, setSettled] = useState(handle);

  // Debounce the VALUE, not the request: a query keyed on the settled handle
  // caches each answer, so backspacing to something already checked is free.
  useEffect(() => {
    const timer = setTimeout(() => setSettled(handle), 400);
    return () => clearTimeout(timer);
  }, [handle]);

  // Nothing to ask about an empty handle, a malformed one (the format message
  // is already on screen), or the one she already holds.
  const askable =
    settled.length > 0 && handleProblem(settled) === null && settled !== normaliseHandle(currentHandle);

  const query = useQuery({
    queryKey: ['handle-available', settled],
    enabled: askable,
    queryFn: () => isHandleFree(settled),
    staleTime: 30_000,
    // One attempt. A retry storm behind a text field buys nothing, and the
    // save will tell the truth regardless.
    retry: false,
  });

  if (!askable) return 'unknown';
  // Still catching up with the keystrokes, or in flight.
  if (settled !== handle || query.isFetching) return 'checking';
  if (query.isError || query.data === undefined) return 'unknown';
  return query.data ? 'free' : 'taken';
}

/**
 * How many people follow the signed-in user — the FOLLOWERS numeral in the
 * closet's stats row.
 *
 * Counted off `follows`, not read from `profiles.follower_count`. The counter
 * column exists and a trigger maintains it (20260803210000), but it is
 * decremented with `greatest(0, …)`, which is precisely the shape of a number
 * that can drift low and never say so. The edge rows are the fact; a
 * head-only `count: 'exact'` fetches none of them.
 *
 * "Followers", not "friends", because that is what the schema stores: `follows`
 * is a directional edge, and a friendship in this app is the coincidence of
 * two of them (architecture.md §1.1). The number therefore counts everyone
 * pointing at you — the friends AND the people whose follow you have not
 * returned — which is exactly the two lists the /friends screen shows.
 */
export function useFollowerCount() {
  return useQuery({
    queryKey: ['follower-count'],
    queryFn: async ({ signal }): Promise<number> => {
      const userId = await getUserId();
      if (!userId) return 0;

      const { count, error } = await supabase
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('followee_id', userId)
        .abortSignal(signal);

      if (error) throw error;
      return count ?? 0;
    },
    // Someone else following you is not an event this device hears about.
    // Pull-to-refresh on the closet is the refresh path; a minute of
    // staleness keeps the numeral from refetching on every tab return.
    staleTime: 60_000,
  });
}
