import { useQuery } from '@tanstack/react-query';

import { pieceName } from '@/features/closet/item-name';
import {
  presenceByFriend,
  type PresenceFact,
  type PresenceLinkRow,
  type PresenceOutfitRow,
  type PresencePieceRow,
} from '@/features/social-graph/friends-presence';
import type { Item } from '@/schemas/item';
import { supabase } from '@/lib/supabase';

/**
 * The friends list's presence read. Redesign 08.
 *
 * Three hops over views that already exist and already decide everything:
 *
 *   friend_worn_outfits        opted in · not retroactive · inside seven days ·
 *                              closet not hidden · mutual · neither blocked
 *   friend_worn_outfit_items   the pieces of those looks the reader may see
 *   friend_items               those pieces' names and authorized derivatives
 *
 * No new table, view, function, policy or column was added for this page. The
 * chain was built for Daily Social (`20260817000000_daily_social.sql`) and
 * carries exactly the guarantees this page needs; `supabase/tests/
 * 23_friends_presence.sql` proves them against this per-friend read shape.
 *
 * ── WHY PER-FRIEND AND NOT `useDailyLooks` ──────────────────────────────────
 *
 * The feed's query is global and capped at forty looks, ordered newest first.
 * Reusing it would be safe — every row in it has already passed every gate —
 * but a friend whose latest look sits past the fortieth would silently lose a
 * fact they are entitled to show. That is a completeness bug, not a privacy
 * one, and it is avoided by scoping the read to the ids on screen.
 *
 * ── WHY THIS QUERY MAY FAIL ALONE ───────────────────────────────────────────
 *
 * It is its own `useQuery` with its own key, so a failure here is a page of
 * name-only cards — frame 10, a state the design already accepts as valid —
 * while the friends list, the requests band and every action stay live.
 */

const PRESENCE_KEY = ['friends-presence'] as const;

/** The window the server already enforces. Read only to bound the fetch. */
const LOOKS_PER_READ = 200;

export function useFriendsPresence(friendIds: readonly string[]) {
  // Sorted so the same circle in a different order is a cache hit rather than a
  // fresh request, the same discipline `useSignedUrls` keeps.
  const ids = [...new Set(friendIds)].sort();

  return useQuery({
    queryKey: [...PRESENCE_KEY, ids.join(',')],
    enabled: ids.length > 0,
    // Presence is a claim about a permission that can be withdrawn at any
    // moment, so it is deliberately short-lived. A stale fact is the one thing
    // this page must not serve.
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, PresenceFact>> => {
      const looks = await supabase
        .from('friend_worn_outfits')
        .select('id, user_id, worn_at')
        .in('user_id', ids)
        .order('worn_at', { ascending: false })
        .limit(LOOKS_PER_READ);

      if (looks.error) throw looks.error;
      const outfits = (looks.data ?? []) as unknown as PresenceOutfitRow[];
      if (outfits.length === 0) return new Map();

      const outfitIds = [...new Set(outfits.map((row) => row.id))];
      const links = await supabase
        .from('friend_worn_outfit_items')
        .select('outfit_id, item_id')
        .in('outfit_id', outfitIds);

      if (links.error) throw links.error;
      const linkRows = (links.data ?? []) as unknown as PresenceLinkRow[];

      const itemIds = [...new Set(linkRows.map((row) => row.item_id))];
      let pieces: PresencePieceRow[] = [];
      if (itemIds.length > 0) {
        const { data, error } = await supabase
          .from('friend_items')
          .select('id, category, subcategory, colors, thumb_path, cutout_path, plate_path')
          .in('id', itemIds);

        if (error) throw error;
        pieces = ((data ?? []) as unknown as {
          id: string;
          category: string;
          subcategory: string | null;
          colors: { name: string }[] | null;
          thumb_path: string | null;
          cutout_path: string | null;
          plate_path: string | null;
        }[]).map((row) => ({
          id: row.id,
          // The app's one naming derivation. A friend's coat is called the same
          // thing on their closet grid, in their Lately look and here.
          label: pieceName({
            category: row.category as Item['category'],
            subcategory: row.subcategory,
            colors: row.colors ?? [],
          }),
          thumbPath: row.thumb_path,
          cutoutPath: row.cutout_path,
          platePath: row.plate_path,
        }));
      }

      return presenceByFriend({ outfits, links: linkRows, pieces });
    },
  });
}
