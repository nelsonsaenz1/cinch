import { useQuery } from '@tanstack/react-query';

import type {
  BorrowRequestRow,
  FriendItemRow,
  SocialProfileRow,
  UserBlockRow,
} from '@/features/social/db-rows';
import { getUserId, supabase } from '@/lib/supabase';
import { useDebouncedValue } from '@/lib/use-debounced-value';

import {
  socialDb,
  toBorrowRequest,
  toFriendItem,
  toSocialProfile,
  type BlockedUser,
  type BorrowItemPreview,
  type BorrowThread,
  type FriendItem,
  type SocialProfile,
} from './types';

/**
 * Reads for the social graph: follows both ways, the friends derived from
 * them, friend closets, borrow requests, blocks.
 *
 * Friendship is not a table — it is the intersection of two follow edges
 * (architecture.md §1.1), so the friends and requests queries fetch the edges
 * and intersect client-side, then hydrate identities from `social_profiles`.
 * The view screens out blocked pairs server-side; anyone it declines to name
 * simply drops out of the hydrated list, which is exactly the product rule
 * ("requests from blocked users never surface") falling out of the read path.
 */

/** Both follow edges touching the signed-in user, split by direction. */
async function fetchEdges(userId: string): Promise<{
  following: Set<string>;
  followers: Set<string>;
}> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, followee_id')
    .or(`follower_id.eq.${userId},followee_id.eq.${userId}`);

  if (error) throw error;

  const following = new Set<string>();
  const followers = new Set<string>();
  for (const edge of data ?? []) {
    if (edge.follower_id === userId) following.add(edge.followee_id);
    if (edge.followee_id === userId) followers.add(edge.follower_id);
  }
  return { following, followers };
}

/** Identities for a set of user ids, via `social_profiles`. Silently partial. */
async function fetchProfiles(ids: string[]): Promise<Map<string, SocialProfile>> {
  const map = new Map<string, SocialProfile>();
  if (ids.length === 0) return map;

  const { data, error } = await socialDb
    .from('social_profiles')
    .select('user_id, username, display_name, avatar_url')
    .in('user_id', ids);

  if (error) throw error;
  for (const row of (data ?? []) as SocialProfileRow[]) {
    map.set(row.user_id, toSocialProfile(row));
  }
  return map;
}

/** Sort for people lists: named before nameless, then alphabetical. */
function byName(a: SocialProfile, b: SocialProfile): number {
  const an = a.displayName ?? a.username ?? '';
  const bn = b.displayName ?? b.username ?? '';
  if (!an && bn) return 1;
  if (an && !bn) return -1;
  return an.localeCompare(bn);
}

/** Ids the signed-in user follows. */
export function useFollowing() {
  return useQuery({
    queryKey: ['following'],
    queryFn: async (): Promise<string[]> => {
      const userId = await getUserId();
      if (!userId) return [];
      const { following } = await fetchEdges(userId);
      return [...following];
    },
  });
}

/** Ids following the signed-in user. */
export function useFollowers() {
  return useQuery({
    queryKey: ['followers'],
    queryFn: async (): Promise<string[]> => {
      const userId = await getUserId();
      if (!userId) return [];
      const { followers } = await fetchEdges(userId);
      return [...followers];
    },
  });
}

/** Mutual follows — the people whose closets open to the signed-in user. */
export function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: async (): Promise<SocialProfile[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { following, followers } = await fetchEdges(userId);
      const mutual = [...following].filter((id) => followers.has(id));
      const profiles = await fetchProfiles(mutual);

      // Hydration is the block filter: an id social_profiles will not name is
      // an id this list must not show, so unresolved entries are dropped, not
      // rendered as placeholders.
      return mutual
        .flatMap((id) => {
          const p = profiles.get(id);
          return p ? [p] : [];
        })
        .sort(byName);
    },
  });
}

/** Followers not yet followed back — the requests inbox. Accepting = following back. */
export function useFriendRequests() {
  return useQuery({
    queryKey: ['friend-requests'],
    queryFn: async (): Promise<SocialProfile[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { following, followers } = await fetchEdges(userId);
      const pending = [...followers].filter((id) => !following.has(id));
      const profiles = await fetchProfiles(pending);

      return pending
        .flatMap((id) => {
          const p = profiles.get(id);
          return p ? [p] : [];
        })
        .sort(byName);
    },
  });
}

/**
 * Username search. Two surfaces, merged: `public_profiles` for anyone public,
 * `social_profiles` for people already related to the caller (a follower whose
 * profile is private is findable here — she reached out first). Neither view
 * will name a blocked user, so the merge cannot resurface one.
 */
export function useProfileSearch(rawQuery: string) {
  // "@dana" and "Dana " mean dana; prefix match is what a username field expects.
  const q = rawQuery.trim().replace(/^@/, '').toLowerCase();
  // Debounce the query, not the render: the field updates every keystroke,
  // the Supabase round trip waits for typing to pause.
  const debouncedQ = useDebouncedValue(q, 200);

  return useQuery({
    queryKey: ['profile-search', debouncedQ],
    enabled: debouncedQ.length >= 2,
    queryFn: async (): Promise<SocialProfile[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const [publicRes, socialRes] = await Promise.all([
        supabase
          .from('public_profiles')
          .select('user_id, username, display_name, avatar_url')
          .ilike('username', `${debouncedQ}%`)
          .limit(10),
        socialDb
          .from('social_profiles')
          .select('user_id, username, display_name, avatar_url')
          .ilike('username', `${debouncedQ}%`)
          .limit(10),
      ]);

      if (publicRes.error) throw publicRes.error;
      if (socialRes.error) throw socialRes.error;

      const merged = new Map<string, SocialProfile>();
      for (const row of (socialRes.data ?? []) as SocialProfileRow[]) {
        merged.set(row.user_id, toSocialProfile(row));
      }
      for (const row of publicRes.data ?? []) {
        if (row.user_id && !merged.has(row.user_id)) {
          merged.set(row.user_id, {
            userId: row.user_id,
            username: row.username,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
          });
        }
      }
      merged.delete(userId);

      return [...merged.values()].sort(byName);
    },
  });
}

/**
 * A friend's closet, via the `friend_items` projection — presentation columns
 * and `borrowable` only; the view enforces friendship per-row, so a revoked
 * friendship or a block empties this on the next fetch with no cache surgery.
 */
export function useFriendCloset(userId: string | null) {
  return useQuery({
    queryKey: ['friend-closet', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<FriendItem[]> => {
      if (!userId) return []; // `enabled` already guards; this narrows the type
      const { data, error } = await socialDb
        .from('friend_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return ((data ?? []) as FriendItemRow[]).map(toFriendItem);
    },
  });
}

/**
 * The owner's own `borrowable` flag for one garment. A separate two-column read
 * rather than a widening of `useCloset`: the closet query maps through the
 * generated `Item` type, which predates the column, and the flag is only ever
 * needed on the one detail screen that can flip it.
 */
export function useItemBorrowable(itemId: string | null) {
  return useQuery({
    queryKey: ['item-borrowable', itemId],
    enabled: Boolean(itemId),
    queryFn: async (): Promise<boolean> => {
      if (!itemId) return true; // `enabled` already guards; this narrows the type
      const { data, error } = await socialDb
        .from('items')
        .select('borrowable')
        .eq('id', itemId)
        .single();

      if (error) throw error;
      return Boolean((data as { borrowable: boolean } | null)?.borrowable);
    },
  });
}

/**
 * Every borrow request the signed-in user is party to, hydrated for rendering:
 * the other woman's identity from `social_profiles`, the garment from her own
 * `items` (incoming — it is hers) or from `friend_items` (outgoing). Both
 * hydrations are allowed to come back partial; a block or a revoked friendship
 * takes the picture away, never the row — the request's history is still real.
 */
export function useBorrowRequests() {
  return useQuery({
    queryKey: ['borrow-requests'],
    queryFn: async (): Promise<BorrowThread[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await socialDb
        .from('borrow_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (data ?? []) as BorrowRequestRow[];
      if (rows.length === 0) return [];

      const incoming = rows.filter((r) => r.owner_id === userId);
      const outgoing = rows.filter((r) => r.owner_id !== userId);

      const counterpartIds = [
        ...new Set(rows.map((r) => (r.owner_id === userId ? r.requester_id : r.owner_id))),
      ];
      const ownItemIds = [...new Set(incoming.map((r) => r.item_id))];
      const friendItemIds = [...new Set(outgoing.map((r) => r.item_id))];

      const [profiles, ownItems, friendItems] = await Promise.all([
        fetchProfiles(counterpartIds),
        ownItemIds.length
          ? supabase
              .from('items')
              .select('id, category, subcategory, thumb_path, cutout_path')
              .in('id', ownItemIds)
          : Promise.resolve({ data: [], error: null }),
        friendItemIds.length
          ? socialDb
              .from('friend_items')
              .select('id, category, subcategory, thumb_path, cutout_path')
              .in('id', friendItemIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (ownItems.error) throw ownItems.error;
      if (friendItems.error) throw friendItems.error;

      const items = new Map<string, BorrowItemPreview>();
      for (const raw of [...(ownItems.data ?? []), ...(friendItems.data ?? [])]) {
        const row = raw as {
          id: string;
          category: string;
          subcategory: string | null;
          thumb_path: string | null;
          cutout_path: string | null;
        };
        items.set(row.id, {
          id: row.id,
          category: row.category,
          subcategory: row.subcategory,
          thumbPath: row.thumb_path,
          cutoutPath: row.cutout_path,
        });
      }

      return rows.map((row) => {
        const direction = row.owner_id === userId ? 'incoming' : 'outgoing';
        const counterpartId = direction === 'incoming' ? row.requester_id : row.owner_id;
        return {
          request: toBorrowRequest(row),
          direction,
          counterpart: profiles.get(counterpartId) ?? null,
          item: items.get(row.item_id) ?? null,
        } satisfies BorrowThread;
      });
    },
  });
}

/**
 * The blocked list (App Store UGC requirement: blocks must be manageable).
 * Identity hydrates from `public_profiles` — `social_profiles` screens out
 * blocked pairs by design, so a private blocked account resolves to no name
 * and renders as a neutral row. That is the ceiling the boundary allows, not
 * an oversight: blocking someone must not keep a window onto their profile.
 */
export function useBlockedUsers() {
  return useQuery({
    queryKey: ['blocked-users'],
    queryFn: async (): Promise<BlockedUser[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await socialDb
        .from('user_blocks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (data ?? []) as UserBlockRow[];
      if (rows.length === 0) return [];

      const { data: pubs, error: pubError } = await supabase
        .from('public_profiles')
        .select('user_id, username, display_name, avatar_url')
        .in(
          'user_id',
          rows.map((r) => r.blocked_id),
        );

      if (pubError) throw pubError;
      const profiles = new Map<string, SocialProfile>();
      for (const row of pubs ?? []) {
        if (row.user_id) {
          profiles.set(row.user_id, {
            userId: row.user_id,
            username: row.username,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
          });
        }
      }

      return rows.map((row) => ({
        userId: row.blocked_id,
        blockedAt: row.created_at,
        profile: profiles.get(row.blocked_id) ?? null,
      }));
    },
  });
}
