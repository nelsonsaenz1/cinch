import { useQuery } from '@tanstack/react-query';

import { closetUserId } from '@/features/closet/session';
import { supabase } from '@/lib/supabase';

/** One other garment, and how many worn outfits it shared with the subject. */
export type CoWorn = { itemId: string; count: number };

/**
 * What this garment actually goes out with.
 *
 * ── What counts as a co-wear, and why it is narrower than it looks ────────
 *
 * `outfits.worn_at` is nullable and most rows in the table have it null: the
 * stylist generates outfits continuously and the user marks the ones she
 * actually put on. Counting every shared `outfit_items` row would therefore
 * report the MODEL's habits back to the user as if they were her own — "you
 * wear this with the grey trousers" said about a suggestion she declined. So a
 * co-wear is only ever a shared outfit with a non-null `worn_at`, and a piece
 * that has never left the house honestly returns nothing.
 *
 * `outfit_items` is keyed `primary key (outfit_id, item_id)`
 * (migrations/20260803154431:186), so one worn outfit contributes at most one
 * to any garment's count — the plain occurrence tally below cannot double-count
 * a piece that appears as both `base` and `swap`, because it cannot appear
 * twice at all.
 *
 * ── Three round trips, and why not one ────────────────────────────────────
 *
 * The obvious shape is a single read with an embedded `outfits!inner(worn_at)`.
 * It does not work here: `outfit_items` carries TWO foreign keys to `outfits` —
 * `outfit_items_outfit_id_fkey` and the tenant-integrity composite
 * `outfit_items_outfit_same_user` (migrations/20260804200000:214) — and
 * PostgREST refuses an ambiguous embed. Naming the constraint inline would work
 * and would also weld this query to a constraint name, for a saving of one
 * indexed round trip on a list of uuids. Three plain reads say what they mean:
 * which outfits hold this piece, which of those were worn, and what else was in
 * them. No migration and no RPC — the counting is a `Map` over at most a few
 * hundred rows, which is not worth a database object to own.
 *
 * Each read stops the chain when it comes back empty, so the common case for a
 * new closet (no worn outfits at all) costs one query and no `.in()` with an
 * empty list.
 *
 * Follows `useCloset`'s contract: `closetUserId()` for the filter (RLS is what
 * actually scopes the rows), the abort `signal` threaded through, and a thrown
 * error rather than `[]` when the session cannot be confirmed — "worn with
 * nothing" is a claim about her wardrobe, and a session hiccup verifies no such
 * thing.
 */
export function useCoWear(itemId: string | null) {
  return useQuery({
    queryKey: ['co-wear', itemId],
    enabled: itemId !== null,
    queryFn: async ({ signal }): Promise<CoWorn[]> => {
      // `enabled` already gates this; the guard is what makes the id a string
      // for the rest of the function without a non-null assertion.
      if (itemId === null) return [];

      const userId = await closetUserId();
      if (!userId) {
        throw new Error("Couldn’t confirm your session. Check your connection and try again.");
      }

      const { data: appearances, error: appearancesError } = await supabase
        .from('outfit_items')
        .select('outfit_id')
        .eq('item_id', itemId)
        .eq('user_id', userId)
        .abortSignal(signal);
      if (appearancesError) throw appearancesError;

      const candidateIds = (appearances ?? []).map((row) => row.outfit_id);
      if (candidateIds.length === 0) return [];

      const { data: worn, error: wornError } = await supabase
        .from('outfits')
        .select('id')
        .in('id', candidateIds)
        .eq('user_id', userId)
        .not('worn_at', 'is', null)
        .abortSignal(signal);
      if (wornError) throw wornError;

      const wornIds = (worn ?? []).map((row) => row.id);
      if (wornIds.length === 0) return [];

      const { data: companions, error: companionsError } = await supabase
        .from('outfit_items')
        .select('item_id')
        .in('outfit_id', wornIds)
        .eq('user_id', userId)
        .abortSignal(signal);
      if (companionsError) throw companionsError;

      const counts = new Map<string, number>();
      for (const row of companions ?? []) {
        // The subject is in every one of these outfits by construction, and
        // "worn with itself" is not a fact about anything.
        if (row.item_id === itemId) continue;
        counts.set(row.item_id, (counts.get(row.item_id) ?? 0) + 1);
      }

      return [...counts.entries()]
        .map(([id, count]): CoWorn => ({ itemId: id, count }))
        // Ties keep whatever order the Map yielded — insertion order, which is
        // the order the rows arrived in. Inventing a second sort key here would
        // dress an arbitrary choice up as a ranking.
        .sort((a, b) => b.count - a.count);
    },
  });
}
