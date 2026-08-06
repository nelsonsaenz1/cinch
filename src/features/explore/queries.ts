import { useQuery } from '@tanstack/react-query';

import type { FriendItemRow } from '@/features/social/db-rows';
import { toFriendItem, type FriendItem } from '@/features/social-graph/types';
import { getUserId, supabase } from '@/lib/supabase';

/**
 * Explore's read path — "what has lately been added to the closets I can see".
 *
 * There is exactly one projection in this database that names another person's
 * garments, and it is `friend_items`: presentation columns plus `borrowable`
 * and `created_at`, gated row-by-row on `is_friend(i.user_id)`
 * (20260807103000). So the feed this file builds is friends-only, by
 * construction rather than by a client-side filter — no `user_id` predicate is
 * sent at all, because the view has already decided which rows exist for this
 * caller. A friendship that lapses or a block that lands empties the affected
 * rows on the next fetch, with no cache surgery here.
 *
 * The public projections (`public_items`) are deliberately NOT read. They
 * require `items.is_public` AND `profiles.visibility = 'public'`, both of which
 * default false/private and neither of which any screen in this app can set —
 * so a "discover strangers" feed would be a permanently empty surface today,
 * and making it non-empty would mean widening the boundary, which this
 * codebase does not do from a feature branch.
 *
 * The signed-in user's own additions ride in the same timeline. A closet is
 * only ever added to by its owner, so a feed of "new things in my circle" that
 * excluded the one closet that is certainly filling up would be barren for
 * exactly the person most likely to open it on day one. They come from `items`
 * under the owner's own RLS, projected down to the same columns the friend view
 * publishes so both sides of the union render through one code path.
 */

/**
 * The `friend_items` column list, verbatim. Used for the caller's own `items`
 * read too: matching the projection means a garment of mine cannot render with
 * a field a friend's garment would have withheld, and both map through
 * `toFriendItem`.
 */
const PRESENTATION_COLUMNS =
  'id, user_id, category, subcategory, colors, pattern, material, brand, seasons, ' +
  'occasions, description, thumb_path, cutout_path, plate_path, borrowable, created_at';

/** How deep the timeline goes. A lookbook page, not an infinite feed. */
export const NEW_ADDITIONS_LIMIT = 40;

/** One garment, lately added, and whose it is. */
export interface NewAddition {
  item: FriendItem;
  ownerId: string;
  /** True for the caller's own pieces — the row says "You" rather than a name. */
  isSelf: boolean;
}

/**
 * Recent additions across the caller's circle, newest first.
 *
 * Both halves are ordered and capped server-side, then merged and re-capped:
 * fetching `LIMIT` from each side is what guarantees the merged top `LIMIT` is
 * genuinely the newest, whichever side happens to dominate.
 */
export function useNewAdditions() {
  return useQuery({
    queryKey: ['explore-new-additions'],
    queryFn: async (): Promise<NewAddition[]> => {
      const me = await getUserId();

      const [friendsRes, mineRes] = await Promise.all([
        supabase
          .from('friend_items')
          .select(PRESENTATION_COLUMNS)
          .order('created_at', { ascending: false })
          .limit(NEW_ADDITIONS_LIMIT),
        me
          ? supabase
              .from('items')
              .select(PRESENTATION_COLUMNS)
              .eq('user_id', me)
              .eq('is_archived', false)
              .order('created_at', { ascending: false })
              .limit(NEW_ADDITIONS_LIMIT)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (friendsRes.error) throw friendsRes.error;
      if (mineRes.error) throw mineRes.error;

      const rows = [
        ...((friendsRes.data ?? []) as unknown as FriendItemRow[]),
        ...((mineRes.data ?? []) as unknown as FriendItemRow[]),
      ];

      return rows
        .map((row) => {
          const item = toFriendItem(row);
          return { item, ownerId: item.userId, isSelf: item.userId === me };
        })
        .sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt))
        .slice(0, NEW_ADDITIONS_LIMIT);
    },
  });
}
