import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

import type { TourGate } from '@/features/onboarding/tour-state';

/**
 * The one fact the first-run tour turns on: `profiles.toured_at`.
 *
 * A server column, not a device flag. "Once, ever, on any device" is a claim
 * about an account, and AsyncStorage would break it twice over — the tour
 * would run again on the iPad, and again after a reinstall.
 */

export const TOUR_GATE_KEY = ['tour-gate'] as const;

type GateRow =
  /** No session. Nothing to gate and nothing to write. */
  | { signedIn: false }
  | { signedIn: true; touredAt: string | null };

async function readGate(signal: AbortSignal): Promise<GateRow> {
  const userId = await getUserId();
  if (!userId) return { signedIn: false };

  const { data, error } = await supabase
    .from('profiles')
    .select('toured_at')
    .eq('user_id', userId)
    .abortSignal(signal)
    .maybeSingle();

  if (error) throw error;
  // No row yet is not an error and not a reason to skip: an account whose
  // profile row has not been written has demonstrably never been toured.
  return { signedIn: true, touredAt: data?.toured_at ?? null };
}

/**
 * Has this account seen the tour?
 *
 * `staleTime: Infinity` — the answer changes exactly once per account, and
 * this mutation is the thing that changes it. `retry: 1` rather than the
 * default three: this read sits between the sign-in handoff and the first
 * screen, and a long retry ladder there is a user staring at a held beat.
 *
 * An error resolves to `unavailable`, which never shows the tour. See the
 * note on `TourGate` for why that direction is the safe one.
 */
export function useTourGate(): TourGate {
  const query = useQuery({
    queryKey: TOUR_GATE_KEY,
    queryFn: ({ signal }) => readGate(signal),
    staleTime: Infinity,
    retry: 1,
  });

  if (query.isPending) return { status: 'loading' };
  if (query.isError || !query.data) return { status: 'unavailable' };
  if (!query.data.signedIn) return { status: 'unavailable' };
  return { status: 'ready', touredAt: query.data.touredAt };
}

/**
 * Close the tour, for good.
 *
 * Called on every exit — Skip, "Start with the camera", "I'll look around
 * first" — because each of the three is a decision the reader has made, and
 * none of them wants the promise again tomorrow morning.
 *
 * The cache is set BEFORE the round trip and is never rolled back on failure.
 * That is deliberate and it is the honest trade: the alternative to a
 * write that quietly fails is a user who cannot leave the tour, and the cost
 * of the failure is that the tour appears once more on the next cold start.
 * The screen navigates on its own without waiting for this.
 */
export function useMarkToured() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await getUserId();
      if (!userId) return;
      const { error } = await supabase
        .from('profiles')
        .update({ toured_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onMutate: () => {
      const toured: GateRow = { signedIn: true, touredAt: new Date().toISOString() };
      qc.setQueryData<GateRow>(TOUR_GATE_KEY, toured);
    },
  });
}
