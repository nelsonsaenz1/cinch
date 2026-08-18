import { useQuery } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

/**
 * How many pieces are photographed but not yet readable.
 *
 * ── WHY THIS IS A SEPARATE READ ─────────────────────────────────────────────
 *
 * `useWardrobe` filters to `tagged | needs_review | verified`, so a piece still
 * at `pending_upload` or `pending_tag` never reaches the tally — correctly,
 * because a piece with no slot cannot enter an outfit. But it also means the
 * Reveal was showing a number derived from SEVEN pieces to somebody who had
 * just photographed TEN, with nothing on screen to explain the gap.
 *
 * That is the state the accepted design calls "partial tagging — honest
 * count": the number stays true to what the engine could read, and a sentence
 * says how many are still coming. This hook is the only new fact needed to
 * write that sentence.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 *
 * No new table, view, RPC or policy. It is a HEAD count on `items` — the same
 * table `useWardrobe` reads, under the same RLS — and it returns a number and
 * nothing else. No ids, no paths, no rows.
 *
 * ── WHY IT FAILS TO ZERO ────────────────────────────────────────────────────
 *
 * An error resolves to zero rather than throwing, and that is the safe
 * direction: zero means "say nothing about tagging", which leaves the screen
 * exactly as it was before this existed. The alternative — a failed count
 * blocking the reveal, or worse, guessing — would let a network hiccup on a
 * secondary fact break the primary one.
 */
export function useUntaggedCount(): { count: number; loading: boolean } {
  const { data, isPending } = useQuery({
    queryKey: ['untagged-count'],
    // The gap closes on its own within seconds as the tagger finishes, so this
    // is deliberately short-lived rather than cached across the session.
    staleTime: 5_000,
    queryFn: async (): Promise<number> => {
      const userId = await getUserId();
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_archived', false)
        .in('status', ['pending_upload', 'pending_tag']);
      if (error) return 0;
      return count ?? 0;
    },
  });

  return { count: data ?? 0, loading: isPending };
}
