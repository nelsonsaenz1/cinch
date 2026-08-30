import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

/**
 * The one fact Today's reveal door turns on: `profiles.reveal_seen_at`.
 *
 * `tour-queries.ts`'s arrangement exactly, one column over, and for the same
 * reason — "once, ever, on any device" is a claim about an account.
 *
 * Why the fact exists: the Reveal was reachable only from The Ten's finish
 * button and the walkthrough's exit, so an account that filled its closet any
 * other way — import, add-clothes, the capture flow — never met the product's
 * proof moment, and the `reveal_complete` paywall placement behind it never
 * fired. Production analytics, walked 2026-08-30: zero `reveal_phase` events
 * from ANY account after 08-21, including a same-day account with 51 tagged
 * pieces and consent granted. The closet was ready; no door existed.
 *
 * The direction of every default is chosen so the door can only under-show:
 * loading, error, and signed-out all read as "seen", because offering the
 * Reveal twice is a shrug while a door that flickers in wrongly on a slow
 * read is a broken promise on the app's front page.
 */

export const REVEAL_SEEN_KEY = ['reveal-seen'] as const;

type SeenRow =
  | { signedIn: false }
  | { signedIn: true; revealSeenAt: string | null };

async function readSeen(signal: AbortSignal): Promise<SeenRow> {
  const userId = await getUserId();
  if (!userId) return { signedIn: false };

  const { data, error } = await supabase
    .from('profiles')
    .select('reveal_seen_at')
    .eq('user_id', userId)
    .abortSignal(signal)
    .maybeSingle<{ reveal_seen_at: string | null }>();

  if (error) throw error;
  // No profile row yet: demonstrably never revealed — the tour gate's own
  // reading of the same absence.
  return { signedIn: true, revealSeenAt: data?.reveal_seen_at ?? null };
}

/**
 * Whether the door may be offered. TRUE only on a settled read that says the
 * account has never seen the Reveal; every other state — loading, error,
 * signed out — answers false.
 */
export function useRevealNeverSeen(): boolean {
  const query = useQuery({
    queryKey: REVEAL_SEEN_KEY,
    queryFn: ({ signal }) => readSeen(signal),
    staleTime: Infinity,
    retry: 1,
  });
  return Boolean(query.data && query.data.signedIn && query.data.revealSeenAt === null);
}

/**
 * Stamp the Reveal seen, for good.
 *
 * Called by the Reveal on arrival — not on completion, because arriving IS
 * seeing it, and a person who backgrounds mid-count has still been shown the
 * moment. Cache set before the round trip and never rolled back, the
 * `useMarkToured` trade: the failure cost is the door appearing once more,
 * and the alternative is a door that cannot be dismissed by walking through
 * it.
 */
export function useMarkRevealSeen() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await getUserId();
      if (!userId) return;
      // `reveal_seen_at` postdates the last `gen:types` run — one cast in one
      // named place, the build-export arrangement, gone at the next gen.
      const { error } = await supabase
        .from('profiles')
        .update({ reveal_seen_at: new Date().toISOString() } as never)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onMutate: () => {
      const seen: SeenRow = { signedIn: true, revealSeenAt: new Date().toISOString() };
      qc.setQueryData<SeenRow>(REVEAL_SEEN_KEY, seen);
    },
  });
}
