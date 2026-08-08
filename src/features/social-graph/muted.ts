import { useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Muted friends — a local-only quiet switch for the Lately feed.
 *
 * Muting hides a friend's posts on this device and nowhere else: nothing is
 * written to the server, the friendship stays intact, and she is never told —
 * the same promise the Friends page makes about waved-off requests
 * (DISMISSED_KEY there, same pattern here). A mute that synced or notified
 * would be a soft unfollow, which is a different, heavier product.
 *
 * The set lives in react-query under `['muted-ids']` rather than in a
 * screen's own useState so that a mute toggled on the Friends page shows up
 * in the Lately feed immediately — every subscriber shares the one cache
 * entry, and `setMuted` writes it through `setQueryData`. AsyncStorage is
 * the durable copy; the cache is the live one.
 */

const MUTED_KEY = 'cinch.lately.muted.v1';

/** Persist, best-effort. A write that fails costs one mute one restart. */
function persist(ids: string[]): void {
  void AsyncStorage.setItem(MUTED_KEY, JSON.stringify(ids)).catch(() => {});
}

/** The muted set, live across screens, plus the two ways to touch it. */
export function useMutedIds(): {
  muted: Set<string>;
  isMuted: (id: string) => boolean;
  setMuted: (id: string, muted: boolean) => void;
} {
  const qc = useQueryClient();

  // A read that fails resolves to the empty set — the safe direction to fail
  // in: showing a muted friend once beats silently hiding an unmuted one.
  const { data } = useQuery({
    queryKey: ['muted-ids'],
    queryFn: async (): Promise<string[]> => {
      try {
        const raw = await AsyncStorage.getItem(MUTED_KEY);
        if (!raw) return [];
        const ids: unknown = JSON.parse(raw);
        return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
      } catch {
        return [];
      }
    },
    // Local state, not a server read: nothing else can change it, so it never
    // goes stale and refetching would only race the writes below.
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const muted = useMemo(() => new Set(data ?? []), [data]);

  const isMuted = useCallback((id: string) => muted.has(id), [muted]);

  const setMuted = useCallback(
    (id: string, nextMuted: boolean) => {
      qc.setQueryData<string[]>(['muted-ids'], (prev) => {
        const next = new Set(prev ?? []);
        if (nextMuted) next.add(id);
        else next.delete(id);
        const list = [...next];
        persist(list);
        return list;
      });
    },
    [qc],
  );

  return { muted, isMuted, setMuted };
}
