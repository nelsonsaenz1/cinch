import { useQuery } from '@tanstack/react-query';

import { useMyProfile } from '@/features/profile/queries';
import { getUserId, supabase } from '@/lib/supabase';

import { toArrival, type InviteArrival } from './arrivals';
import { bareHandle, inviteUrl, shareTitle } from './link';

/**
 * The invite screen's reads (IV-01).
 *
 * Two of them, and one is not a network call at all: the link is a pure
 * function of the handle the app already has on the profile row, because "one
 * link per person, forever — the handle is the link" means there is nothing to
 * look up. See `link.ts`.
 */

// ---------------------------------------------------------------------------
// The link itself
// ---------------------------------------------------------------------------

export type InviteLink = {
  /** The handle without its `@`, or null when none has been claimed. */
  handle: string | null;
  /** `https://cinchstyle.com/i/@handle`, or null when there is no handle. */
  url: string | null;
  /** The sentence the share sheet and the landing page both carry. */
  title: string | null;
};

/**
 * The signed-in user's link, derived from their own profile row.
 *
 * NO HANDLE IS A REAL STATE, NOT AN ERROR. `profiles.username` is nullable and
 * nothing forces a handle at sign-up, so a brand-new account opening this
 * screen genuinely has no link. Returning `null` here rather than building
 * `cinchstyle.com/i/@undefined` is the whole point: the screen shows what is
 * true and offers the one thing that fixes it.
 *
 * `title` falls back to the handle when the display name is empty, because
 * `shareTitle('')` is " added you on Cinch" — a sentence with a hole in it,
 * shared into somebody else's Messages thread.
 */
export function useInviteLink(): {
  link: InviteLink;
  loading: boolean;
  error: boolean;
  refetch: () => void;
} {
  const query = useMyProfile();
  const profile = query.data ?? null;

  const handle = profile?.username ? bareHandle(profile.username) : null;
  const name = profile?.displayName?.trim() ?? '';

  return {
    link: {
      handle,
      url: handle ? inviteUrl(handle) : null,
      title: handle ? shareTitle(name.length > 0 ? name : `@${handle}`) : null,
    },
    loading: query.isPending,
    error: query.isError,
    refetch: () => void query.refetch(),
  };
}

// ---------------------------------------------------------------------------
// Who arrived
// ---------------------------------------------------------------------------

export const inviteArrivalsKey = ['invite-arrivals'] as const;

/**
 * The people who came in through the link, newest first.
 *
 * A definer RPC rather than a select: `profiles` is not readable row-by-row for
 * an arbitrary viewer, and "who joined through me" is a fact about the caller
 * rather than about the people listed. The bound (50) is the function's, in
 * SQL, so this list cannot quietly grow into a feed.
 */
export function useInviteArrivals() {
  return useQuery({
    queryKey: inviteArrivalsKey,
    queryFn: async (): Promise<InviteArrival[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      // The generated `Database` type is regenerated from production and the
      // `Args: never` signature it gives a no-argument function cannot be
      // satisfied by any call. Cast the CLIENT, not the method — pulling `rpc`
      // off the object detaches its `this` and the builder throws before the
      // network. Same narrowing, same reasoning, as `useActivityFeed`.
      const client = supabase as unknown as {
        rpc(fn: string): PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };

      const { data, error } = await client.rpc('invite_arrivals');
      if (error) throw new Error(error.message);

      return (Array.isArray(data) ? (data as Record<string, unknown>[]) : []).flatMap((raw) => {
        const row = toArrival(raw);
        return row ? [row] : [];
      });
    },
    // Somebody accepting your invite is not an event this device hears about,
    // and the screen is opened deliberately rather than lived on. A minute of
    // staleness keeps returning to it from the share sheet free.
    staleTime: 60_000,
  });
}
