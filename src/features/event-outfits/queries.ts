import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  EventCommentRow,
  EventOutfitPostRow,
  EventPostItemRow,
  EventVoteCountRow,
} from '@/features/social/db-rows';
import {
  boardsFor,
  toEventComment,
  toEventOutfitPost,
  toPostGarment,
  type AttendeeBoard,
  type EventComment,
  type MyVote,
  type PostedLook,
} from '@/features/event-outfits/types';
import { getUserId, supabase } from '@/lib/supabase';

/**
 * The social tables are not in the generated `Database` type yet — Agent DB
 * regenerates it only after the migrations apply — so reads go through an
 * untyped client and cast at the boundary via `.returns<Row[]>()`, exactly the
 * pattern `src/lib/commands.ts` documents for pre-regen `rpc` calls. Delete
 * the cast after the next `npm run gen:types` and every call site keeps
 * working.
 */
const social = supabase as unknown as SupabaseClient;

/**
 * Query keys are a seam contract (build-plan §5.4): EVENTS' `useEventChannel`
 * invalidates exactly these keys on realtime vote/comment changes. Rename one
 * here and live updates silently stop — change the build plan first.
 */
export const eventPostsKey = (eventId: string) => ['event-posts', eventId] as const;
export const eventCommentsKey = (eventId: string) => ['event-comments', eventId] as const;
export const myVoteKey = (eventId: string) => ['my-vote', eventId] as const;

/**
 * The board: every posted look in the event, composed from three surfaces —
 * `event_outfit_posts` (member-scoped RLS), the `event_post_items` projection
 * (garments without any grant on `items`), and `event_vote_counts` (tallies
 * without fan-out). Voter ids ride along from the votes table itself because
 * picks are signed by design.
 *
 * Returned flat plus grouped: the flat list is what mutations reason over,
 * the boards are what the screen renders. Grouping is per-attendee and stays
 * that way — no surface built on this may rank attendees against each other.
 */
export function useEventPosts(eventId: string | null) {
  return useQuery({
    queryKey: eventPostsKey(eventId ?? 'none'),
    enabled: Boolean(eventId),
    // Realtime invalidation is the freshness mechanism while the screen is
    // open; staleTime only guards against redundant refetches on remount.
    staleTime: 15_000,
    queryFn: async (): Promise<{ looks: PostedLook[]; boards: AttendeeBoard[] }> => {
      const [posts, items, counts, votes] = await Promise.all([
        social
          .from('event_outfit_posts')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true })
          .returns<EventOutfitPostRow[]>(),
        social
          .from('event_post_items')
          .select('*')
          .eq('event_id', eventId)
          .returns<EventPostItemRow[]>(),
        social
          .from('event_vote_counts')
          .select('*')
          .eq('event_id', eventId)
          .returns<EventVoteCountRow[]>(),
        social
          .from('event_outfit_votes')
          .select('post_id, voter_id')
          .eq('event_id', eventId)
          .returns<{ post_id: string; voter_id: string }[]>(),
      ]);

      const failed = posts.error ?? items.error ?? counts.error ?? votes.error;
      if (failed) throw failed;

      const itemsByPost = new Map<string, EventPostItemRow[]>();
      for (const row of items.data ?? []) {
        const list = itemsByPost.get(row.post_id) ?? [];
        list.push(row);
        itemsByPost.set(row.post_id, list);
      }

      const tally = new Map((counts.data ?? []).map((c) => [c.post_id, Number(c.votes)]));

      const votersByPost = new Map<string, string[]>();
      for (const v of votes.data ?? []) {
        const list = votersByPost.get(v.post_id) ?? [];
        list.push(v.voter_id);
        votersByPost.set(v.post_id, list);
      }

      const looks: PostedLook[] = (posts.data ?? []).map((row) => {
        const garments = (itemsByPost.get(row.id) ?? [])
          .sort((a, b) => a.position - b.position)
          .map(toPostGarment);
        return {
          ...toEventOutfitPost(row),
          garments,
          votes: tally.get(row.id) ?? 0,
          voterIds: votersByPost.get(row.id) ?? [],
        };
      });

      return { looks, boards: boardsFor(looks) };
    },
  });
}

/**
 * The caller's one pick in this event — `unique(event_id, voter_id)` is the
 * schema's word on "one signed, movable pick per event", so this is at most
 * one row. Movable until the board locks; retracting deletes it.
 */
export function useMyVote(eventId: string | null) {
  return useQuery({
    queryKey: myVoteKey(eventId ?? 'none'),
    enabled: Boolean(eventId),
    staleTime: 15_000,
    queryFn: async (): Promise<MyVote> => {
      const me = await getUserId();
      if (!me) return null;

      const { data, error } = await social
        .from('event_outfit_votes')
        .select('post_id')
        .eq('event_id', eventId)
        .eq('voter_id', me)
        .maybeSingle<{ post_id: string }>();

      if (error) throw error;
      return data ? { postId: data.post_id } : null;
    },
  });
}

/**
 * Every comment in the event, one cache entry, filtered per-post client-side
 * (build-plan §3): the realtime channel invalidates `['event-comments', id]`
 * as a whole, and one fetch serving both the event thread and every look's
 * thread means a change can never leave two caches disagreeing.
 *
 * `postId` — undefined: everything; null: the event-level thread only;
 * a string: that look's thread only.
 *
 * Hidden rows arrive only for callers RLS lets see them (author, host); the
 * UI's job is to LABEL them, not to re-derive visibility.
 */
export function useEventComments(eventId: string | null, postId?: string | null) {
  return useQuery({
    queryKey: eventCommentsKey(eventId ?? 'none'),
    enabled: Boolean(eventId),
    staleTime: 15_000,
    queryFn: async (): Promise<EventComment[]> => {
      const { data, error } = await social
        .from('event_comments')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
        .returns<EventCommentRow[]>();

      if (error) throw error;
      return (data ?? []).map(toEventComment);
    },
    select:
      postId === undefined
        ? undefined
        : (all: EventComment[]) => all.filter((c) => c.postId === postId),
  });
}

/** A saved outfit of the caller's own, as the posting sheet lists them. */
export type PostableOutfit = {
  id: string;
  name: string | null;
  occasion: string | null;
  wornAt: string | null;
  createdAt: string;
  /** In stack position order; resolve to garments via `useWardrobe`. */
  itemIds: string[];
};

/**
 * The caller's own saved outfits, newest first — the source list for "post
 * your look". Reads `outfits`/`outfit_items` under the existing owner RLS
 * (both tables predate this feature and are in the generated types, so the
 * typed client is used directly). Garment data comes from `useWardrobe`
 * (`@/features/styling/queries`) at the call site rather than a third query
 * here — the wardrobe cache is already persisted and warm.
 */
export function useMyPostableOutfits() {
  return useQuery({
    queryKey: ['my-postable-outfits'],
    queryFn: async (): Promise<PostableOutfit[]> => {
      const me = await getUserId();
      if (!me) return [];

      const { data: outfits, error } = await supabase
        .from('outfits')
        .select('id, name, occasion, worn_at, created_at')
        .eq('user_id', me)
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) throw error;
      if (!outfits?.length) return [];

      const { data: joins, error: joinError } = await supabase
        .from('outfit_items')
        .select('outfit_id, item_id, position')
        .in(
          'outfit_id',
          outfits.map((o) => o.id),
        );

      if (joinError) throw joinError;

      const itemsByOutfit = new Map<string, { item_id: string; position: number }[]>();
      for (const j of joins ?? []) {
        const list = itemsByOutfit.get(j.outfit_id) ?? [];
        list.push(j);
        itemsByOutfit.set(j.outfit_id, list);
      }

      return outfits
        .map((o) => ({
          id: o.id,
          name: o.name,
          occasion: o.occasion,
          wornAt: o.worn_at,
          createdAt: o.created_at,
          itemIds: (itemsByOutfit.get(o.id) ?? [])
            .sort((a, b) => a.position - b.position)
            .map((j) => j.item_id),
        }))
        // An outfit whose garments were all archived has nothing to show.
        .filter((o) => o.itemIds.length > 0);
    },
  });
}
