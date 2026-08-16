import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/features/auth/use-session';
import { useMutedIds } from '@/features/social-graph/muted';

import { circleEntries } from './feed';
import { useNewAdditions, type NewAddition } from './queries';
import {
  advanceBoundary,
  hasUnseen,
  lastSeenStorageKey,
  newestTimestamp,
  unseenBoundaryIndex,
} from './unseen';

/**
 * UX-10's read state, wired — the storage and lifecycle half of `unseen.ts`.
 *
 * The cache entry, not the storage key, is the live copy: the same pattern as
 * `muted.ts` and for the same reason. The Explore screen writes a new boundary
 * when it shows you the page, and the tab bar's dot — mounted in a completely
 * different subtree — has to notice within the same frame. One react-query key
 * shared by both subscribers is what makes that true without an event bus.
 */

/** The cache key for one account's boundary. `null` user id is its own bucket. */
const lastSeenQueryKey = (userId: string | null) => ['explore-last-seen', userId] as const;

/**
 * The stored boundary, and the one way to move it.
 *
 * `isReady` is separate from a null boundary on purpose: "we have not finished
 * asking" and "there is no boundary" both mean *do not draw a dot*, but only
 * the second one may write a new boundary. Marking a timeline read on the
 * strength of a read that has not returned yet is how a user loses the one
 * batch they actually wanted to see.
 */
export function useExploreLastSeen(): {
  boundary: string | null;
  isReady: boolean;
  markSeen: (shown: string | null) => void;
} {
  const { userId } = useSession();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: lastSeenQueryKey(userId),
    enabled: Boolean(userId),
    // Device-local: nothing but `markSeen` below can change it, so refetching
    // would only race our own writes.
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<string | null> => {
      if (!userId) return null;
      try {
        return await AsyncStorage.getItem(lastSeenStorageKey(userId));
      } catch {
        // A read that throws is not a reader who has seen nothing — but the two
        // are indistinguishable from here, and the safe direction is silence:
        // no boundary, no dot, no divider. The next successful visit repairs it.
        return null;
      }
    },
  });

  const markSeen = useCallback(
    (shown: string | null) => {
      if (!userId || !shown) return;
      qc.setQueryData<string | null>(lastSeenQueryKey(userId), (prev) => {
        const next = advanceBoundary(prev ?? null, shown);
        if (next && next !== (prev ?? null)) {
          // Best-effort: a failed write costs one repeated dot, never a lost one.
          void AsyncStorage.setItem(lastSeenStorageKey(userId), next).catch(() => {});
        }
        return next;
      });
    },
    [qc, userId],
  );

  return {
    boundary: query.data ?? null,
    isReady: Boolean(userId) && query.isSuccess,
    markSeen,
  };
}

/**
 * Whether the Explore tab has genuinely unseen friend activity.
 *
 * Mounted by the tab layout, so the feed query runs for a signed-in session
 * whichever tab is open — which is the whole point of a badge, and costs one
 * request that react-query then hands to the Explore screen already warm. Every
 * suppression path returns `false`: no session, storage not yet read, the feed
 * still loading, the feed failed, or no boundary ever proven.
 */
export function useExploreUnseenDot(): boolean {
  const additions = useNewAdditions();
  const { muted } = useMutedIds();
  const { boundary, isReady } = useExploreLastSeen();
  const segments = useSegments();

  const entries = useMemo(
    () => circleEntries(additions.data ?? [], muted),
    [additions.data, muted],
  );

  // A dot on the tab you are currently reading is noise: it says "there is
  // something here" to somebody who is looking at it. The boundary itself does
  // not advance until you leave (see `useExploreVisit`), which is what keeps the
  // divider stable while you scroll — so without this the mark would sit lit
  // over the page it describes.
  if (segments[segments.length - 1] === 'explore') return false;

  if (!isReady || !boundary || additions.isError || !additions.isSuccess) return false;
  return hasUnseen(entries, (e) => e.item.createdAt, boundary);
}

/**
 * The boundary the Explore screen renders against, and when it moves.
 *
 * The screen has two jobs that pull in opposite directions: draw the "new since
 * you last looked" rule, and stop claiming there is something unseen, because
 * you are seeing it. Doing both at once — advancing the boundary on arrival —
 * would erase the divider in the same commit that drew it.
 *
 * So the boundary moves when the visit ENDS, not when it starts. Nothing writes
 * it while you are on the page, which is what makes the divider stable through
 * a scroll, a refetch and a pull-to-refresh without a frozen copy, a ref, or a
 * second render pass. Two endings are honoured, because there are two ways to
 * leave a tab:
 *
 * - **Blur** — you went to Closet. The focus effect's cleanup runs.
 * - **Background** — you swiped up, or the phone locked. iOS delivers
 *   `background` before it terminates an app in all but a crash, so this is
 *   what stops a killed session from redrawing a dot over rows already read.
 *
 * Both read the latest rows from a ref rather than closing over `entries`,
 * which changes identity on every refetch; re-subscribing a focus effect to
 * that would tear down and rebuild the listener on each one.
 *
 * @param entries Already through `circleEntries` — no self rows, no muted owners.
 * @param ready   The feed has actually loaded. A boundary must never be advanced
 *                past rows the reader was not shown.
 */
export function useExploreVisit(
  entries: readonly NewAddition[],
  ready: boolean,
): { boundary: string | null; dividerItemId: string | null } {
  const { boundary, markSeen } = useExploreLastSeen();

  // What we would store if the visit ended right now. Kept in a ref so the two
  // listeners below can stay mounted across refetches.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    shown.current = ready ? newestTimestamp(entries, (e) => e.item.createdAt) : null;
  }, [entries, ready]);

  const end = useCallback(() => markSeen(shown.current), [markSeen]);

  // Both endings, registered together and only while the page is on screen —
  // the tab stays mounted behind Closet, and a background from over there must
  // not mark rows read that arrived after you left.
  useFocusEffect(
    useCallback(() => {
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'background') end();
      });
      return () => {
        sub.remove();
        end();
      };
    }, [end]),
  );

  const index = unseenBoundaryIndex(entries, (e) => e.item.createdAt, boundary);

  return {
    boundary,
    // The row the rule sits above, named rather than numbered: the screen draws
    // the timeline in day groups, and an index into the flat list would have to
    // be re-derived against that nesting on every render.
    dividerItemId: index === null ? null : (entries[index]?.item.id ?? null),
  };
}
