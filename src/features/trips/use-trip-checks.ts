import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/use-session';

import { readChecked, toggleCheck, tripChecksKey } from './trip-detail-spec';

/**
 * What this DEVICE remembers about packing one trip: which pieces are ticked.
 *
 * ── WHY LOCAL, AND WHY THAT IS THE BRIEF RATHER THAN A SHORTCUT ──────────────
 *
 * The directive asks for pieces "CHECKABLE as you pack (local state)". Packing
 * is something you do standing over a suitcase in one room on one evening; it
 * is not a fact about the trip that another device needs, and it is not worth a
 * column and a write on every tap. So there is no table, no sync, and nothing
 * to see from another phone — the same bargain, and the same sentence, as
 * `recent-people.ts`. The accepted offline frame says it out loud: "what you
 * already ticked is safe on this device."
 *
 * The NOTE is not here. It lives on `trips.note` and is written through
 * `useUpdateTripNote` in `features/plan/use-trips.ts`, the one module allowed
 * to touch that table — a sentence somebody typed is content, and content
 * survives a reinstall. See the spec's header for how that split came about.
 *
 * ── IDS ONLY ─────────────────────────────────────────────────────────────────
 *
 * What is stored is an array of closet item ids. No names, no photographs, no
 * category, nothing about the garment itself. The plate is re-read from
 * `trips.memo` and the closet every time, which means a piece the user has
 * since deleted stops appearing rather than living on in a JSON blob — the
 * identical property `recent-people.ts` relies on for privacy, applied here to
 * a wardrobe instead of to people.
 *
 * ── THE SPLIT ────────────────────────────────────────────────────────────────
 *
 * The key, the toggle and the read filter are in `trip-detail-spec.ts`, which
 * has no React and no storage in it and is therefore testable by this repo's
 * runner. This file holds only the store. Same split, same reason, as
 * `recent-people-spec.ts` beside `recent-people.ts`.
 */

export const tripChecksQueryKey = (userId: string | null, tripId: string) =>
  ['trip-detail-checks', userId, tripId] as const;

/** Persist, best-effort. A write that fails costs one tick one restart. */
function persist(userId: string, tripId: string, ids: readonly string[]): void {
  void AsyncStorage.setItem(tripChecksKey(userId, tripId), JSON.stringify(ids)).catch(() => {});
}

export type TripChecks = {
  checked: string[];
  loading: boolean;
  /** Returns the set AFTER the toggle, so the caller can decide its haptic. */
  toggle: (itemId: string) => string[];
};

/**
 * `pieceIds` is the plate, and it is a parameter rather than something this
 * hook derives, for one reason: it is the FILTER on the read. A re-plan rewrites
 * the bag, and an id ticked against the old one would otherwise be counted
 * against the new — see `readChecked` and `packingProgress`, which refuse that
 * from both ends.
 */
export function useTripChecks(tripId: string, pieceIds: readonly string[]): TripChecks {
  const qc = useQueryClient();
  const session = useSession();
  const me = session.userId;

  // Joined rather than passed as an array: a fresh array literal every render
  // would be a new query key every render.
  const fingerprint = pieceIds.join(',');

  const checks = useQuery({
    queryKey: [...tripChecksQueryKey(me, tripId), fingerprint],
    enabled: !!me && !!tripId,
    // Local state: nothing else can change it, so a refetch would only race the
    // writes below and could drop a tick the user just made.
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<string[]> => {
      if (!me || !tripId) return [];
      try {
        const raw = await AsyncStorage.getItem(tripChecksKey(me, tripId));
        return readChecked(raw ? JSON.parse(raw) : null, pieceIds);
      } catch {
        // A read that fails is an empty set, never a crash. The worst outcome
        // of failing this way is a plate that asks to be ticked again.
        return [];
      }
    },
  });

  const checked = checks.data ?? [];

  /**
   * Optimistic by construction, not by policy.
   *
   * The cache IS the live copy and AsyncStorage is the durable one — the shape
   * `muted.ts` and `recent-people.ts` both use. A tick therefore lands in the
   * same commit as the press, which is what makes the selection haptic honest:
   * the buzz confirms a mark that is already drawn, never announces a write
   * that has not happened.
   */
  const toggle = useCallback(
    (itemId: string): string[] => {
      const key = [...tripChecksQueryKey(me, tripId), fingerprint];
      const current = qc.getQueryData<string[]>(key) ?? [];
      const next = toggleCheck(current, itemId);
      qc.setQueryData<string[]>(key, next);
      if (me) persist(me, tripId, next);
      return next;
    },
    [qc, me, tripId, fingerprint],
  );

  return { checked, loading: checks.isLoading, toggle };
}
