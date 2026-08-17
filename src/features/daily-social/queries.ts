import { useQuery } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

import { dailySocialDb, rowsOf } from './client';
import type {
  FriendWornOutfitItemRow,
  FriendWornOutfitRow,
  FriendWornPieceImageRow,
} from './db-rows';
import { assembleDailyLooks, DAILY_LOOKS_LIMIT, type WornPieceEntry } from './feed';
import type { DailyLook } from './types';

/**
 * The daily read — what the mutual friends who opted in wore, most recently
 * first, and how many of them opted in at all.
 *
 * ── THREE READS, AND WHY NOT ONE ──────────────────────────────────────────
 *
 * PostgREST can embed a related table in one request only when it can see a
 * foreign key between them, and there is no such key between two views. So the
 * looks, their piece links and the piece images are three round trips. That is
 * the cost of routing pieces through `friend_items` rather than projecting
 * image paths into `friend_worn_outfit_items` — and it is the right cost,
 * because it means this feature adds NO new item exposure: every path it draws
 * is one `friend_items` was already prepared to hand this caller for that
 * friend's closet page.
 *
 * ── WHAT THE SERVER HAS ALREADY DECIDED ───────────────────────────────────
 *
 * No predicate below says anything about friendship, blocks, sharing or
 * expiry, and none should. `friend_worn_outfits` has already applied all four:
 * `is_friend()`, `worn_outfits_shared_since is not null`,
 * `worn_at >= worn_outfits_shared_since`, and the seven-day window. A
 * friendship that lapses, a block that lands, sharing switched off or a look
 * that ages out all empty the affected rows on the next fetch with no cache
 * surgery here — the same shape as `useNewAdditions` against `friend_items`.
 *
 * ── A SHORT LOOK IS JUST A SHORT LOOK ─────────────────────────────────────
 *
 * A garment its owner has hidden is absent from `friend_worn_outfit_items`,
 * and a garment `friend_items` declines to name is dropped when the paths are
 * hydrated. Neither is counted, neither is annotated, and a look left with no
 * pieces is still returned. There is nowhere in this file that could say how
 * many are missing, which is the point.
 */

export const DAILY_LOOKS_KEY = ['daily-looks'] as const;
export const FRIENDS_SHARING_COUNT_KEY = ['friends-sharing-worn-outfits-count'] as const;

/** The four columns `friend_worn_outfits` projects, verbatim. */
const WORN_OUTFIT_COLUMNS = 'id, user_id, name, worn_at';

/**
 * The image paths a collage needs, and nothing else. `friend_items` also
 * carries brand, material, description and wear counts; a look is drawn from
 * pictures and none of those belong on this surface.
 */
const PIECE_IMAGE_COLUMNS = 'id, thumb_path, cutout_path, plate_path';

/**
 * The day. Finite, ordered, and ending — see `feed.ts` for the four rules.
 */
export function useDailyLooks() {
  return useQuery({
    queryKey: DAILY_LOOKS_KEY,
    queryFn: async (): Promise<DailyLook[]> => {
      const db = dailySocialDb();

      const looksRes = await db
        .from('friend_worn_outfits')
        .select(WORN_OUTFIT_COLUMNS)
        .order('worn_at', { ascending: false })
        .limit(DAILY_LOOKS_LIMIT);

      if (looksRes.error) throw new Error(looksRes.error.message);
      const outfitRows = rowsOf<FriendWornOutfitRow>(looksRes.data);
      if (outfitRows.length === 0) return [];

      const outfitIds = [...new Set(outfitRows.map((row) => row.id))];
      const linksRes = await db
        .from('friend_worn_outfit_items')
        .select('outfit_id, item_id')
        .in('outfit_id', outfitIds);

      if (linksRes.error) throw new Error(linksRes.error.message);
      const linkRows = rowsOf<FriendWornOutfitItemRow>(linksRes.data);

      const images = new Map<string, FriendWornPieceImageRow>();
      const itemIds = [...new Set(linkRows.map((row) => row.item_id))];
      if (itemIds.length > 0) {
        // The typed client, not the cast one: `friend_items` predates this
        // migration and is already in the generated types, which is a stronger
        // guarantee than any hand-written shape.
        const { data, error } = await supabase
          .from('friend_items')
          .select(PIECE_IMAGE_COLUMNS)
          .in('id', itemIds);

        if (error) throw error;
        for (const row of (data ?? []) as unknown as FriendWornPieceImageRow[]) {
          images.set(row.id, row);
        }
      }

      const pieces: WornPieceEntry[] = linkRows.flatMap((link) => {
        const image = images.get(link.item_id);
        // The two reads are not one transaction, so a garment can be hidden or
        // archived between them. It is simply not in the collage — the same
        // answer a piece hidden before the first read gets, and no count
        // anywhere distinguishes the two.
        if (!image) return [];
        return [
          {
            outfitId: link.outfit_id,
            itemId: link.item_id,
            thumbPath: image.thumb_path,
            cutoutPath: image.cutout_path,
            platePath: image.plate_path,
          },
        ];
      });

      return assembleDailyLooks(
        outfitRows.map((row) => ({
          outfitId: row.id,
          ownerId: row.user_id,
          name: row.name,
          wornAt: row.worn_at,
        })),
        pieces,
      );
    },
  });
}

/**
 * How many mutual friends are sharing at all — an integer, and only an
 * integer.
 *
 * This is what tells "nobody is sharing yet" (S-1b) apart from "a quiet day"
 * (S-2). Both look identical from an empty look list, they are two different
 * screens with two different actions, and the client cannot read anyone else's
 * `worn_outfits_shared_since` — `profiles` RLS shows the caller their own row
 * and public ones, which is exactly right and stays that way.
 *
 * `friends_sharing_worn_outfits_count()` is deliberately not a view: a view
 * would be joinable back to `follows` and would name people. A scalar cannot
 * be decomposed.
 */
export function useFriendsSharingCount() {
  return useQuery({
    queryKey: FRIENDS_SHARING_COUNT_KEY,
    queryFn: async (): Promise<number> => {
      const userId = await getUserId();
      // Signed out there is no `auth.uid()` for `is_friend()` to read, so the
      // function would answer zero anyway. Not asking is one fewer round trip
      // and one fewer way to misread the answer.
      if (!userId) return 0;

      const { data, error } = await dailySocialDb().rpc('friends_sharing_worn_outfits_count');
      if (error) throw new Error(error.message);

      return typeof data === 'number' ? data : 0;
    },
  });
}
