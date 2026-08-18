import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/use-session';
import type { SocialProfileRow } from '@/features/social/db-rows';
import { recentKey, withRecent } from './recent-people-spec';
import { socialDb, toSocialProfile, type SocialProfile } from './types';

/**
 * Recent searches — the RECENT list on People Search, on this device only.
 *
 * The redesign asks for a list the page did not have. The brief also draws
 * the line around it: "implement the smallest safe on-device/local
 * recent-search behavior; do not create a new server table for this page."
 * So there is no table, no sync, and nothing to see from another phone.
 *
 * ── WHAT IS STORED, AND WHY IT IS ONLY IDS ────────────────────────────────
 *
 * The obvious implementation caches the ROWS — name, handle, avatar — so the
 * list can draw instantly with no round trip. This one deliberately does not.
 * It stores an ordered list of opaque user ids and re-reads the people from
 * `social_profiles` at render.
 *
 * The reason is privacy, and it is the whole design:
 *
 *   `social_profiles` is the view that already decides who you are allowed to
 *   see. It excludes anybody either of you has blocked, and it names a
 *   private account only while you are actually related to it. A cached NAME
 *   would survive all of that — somebody blocks you, or goes private, or
 *   deletes their handle, and their face keeps appearing in your app because
 *   a JSON blob on your phone remembers it.
 *
 * Hydrating through the view instead means a person who is no longer visible
 * to you simply stops being in the list, with no expiry logic to get wrong
 * and no second copy of the privacy rules to keep in step with the first.
 * `fetchProfiles`' own docblock relies on the same property for Friends.
 *
 * ── WHY THE KEY CARRIES THE USER ID ───────────────────────────────────────
 *
 * The same reason `explore/unseen.ts` keys on it, and the reason
 * `invite/pending-invite.ts` refuses to persist at all: two people sign in to
 * one phone, and a list keyed on the device would show the first one's
 * searches to the second. Ids are meaningless without the session that can
 * resolve them, but "meaningless to an attacker" is not the bar — "not shown
 * to the wrong person" is.
 *
 * The cache is the live copy and AsyncStorage the durable one, which is the
 * shape `muted.ts` established for exactly this kind of local list.
 *
 * The ordering and the storage key live in `recent-people-spec.ts`, which has
 * no React and no storage in it and is therefore testable by this repo's
 * runner. Re-exported here so a caller needs one import.
 */

export { RECENT_LIMIT, recentKey, withRecent } from './recent-people-spec';

export const recentIdsKey = (userId: string | null) => ['recent-people-ids', userId] as const;
export const recentPeopleKey = (userId: string | null) => ['recent-people', userId] as const;

async function readIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(recentKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // A read that fails is an empty list, never a crash: the worst outcome of
    // failing this way is a page that offers to invite somebody instead.
    return [];
  }
}

/** Persist, best-effort. A write that fails costs one entry one restart. */
function persist(userId: string, ids: string[]): void {
  void AsyncStorage.setItem(recentKey(userId), JSON.stringify(ids)).catch(() => {});
}

/**
 * The recent people, resolved.
 *
 * Two queries rather than one: the ids are local and never go stale, the
 * people are a server read that can. Splitting them means recording a search
 * does not refetch profiles, and a profile refetch does not touch the list.
 */
export function useRecentPeople(): {
  people: SocialProfile[];
  loading: boolean;
  remember: (userId: string) => void;
} {
  const qc = useQueryClient();
  const session = useSession();
  const me = session.userId;

  const ids = useQuery({
    queryKey: recentIdsKey(me),
    queryFn: () => readIds(me),
    enabled: !!me,
    // Local state: nothing else can change it, so refetching would only race
    // the writes below.
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const idList = ids.data ?? [];

  const people = useQuery({
    queryKey: [...recentPeopleKey(me), idList.join(',')],
    enabled: !!me && idList.length > 0,
    queryFn: async (): Promise<SocialProfile[]> => {
      const { data, error } = await socialDb
        .from('social_profiles')
        .select('user_id, username, display_name, avatar_url, bio')
        .in('user_id', idList);
      if (error) throw error;

      // Through `unknown` while the generated types predate the view's `bio`
      // column — the same widening, and the same reason, as `fetchProfiles`.
      const found = new Map(
        ((data ?? []) as unknown as SocialProfileRow[]).map((row) => [
          row.user_id,
          toSocialProfile(row),
        ]),
      );

      // The stored ORDER is the answer, not the database's. `.in()` returns
      // rows in whatever order it likes, and "recent" is the one property
      // this list has. Ids the view declined to name simply fall out here —
      // that is the block/visibility filter doing its job, not an error.
      return idList.map((id) => found.get(id)).filter((p): p is SocialProfile => !!p);
    },
  });

  const record = useMutation({
    mutationFn: async (userId: string) => {
      if (!me || userId === me) return;
      const current = qc.getQueryData<string[]>(recentIdsKey(me)) ?? (await readIds(me));
      const next = withRecent(current, userId);
      qc.setQueryData<string[]>(recentIdsKey(me), next);
      persist(me, next);
    },
  });

  return {
    people: people.data ?? [],
    loading: ids.isLoading || (idList.length > 0 && people.isLoading),
    remember: (userId: string) => record.mutate(userId),
  };
}
