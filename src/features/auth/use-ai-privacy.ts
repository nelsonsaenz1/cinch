import { useQuery } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

/**
 * The two facts the Privacy screen (design frame A-06) states about AI
 * tagging, kept out of the screen so the queries stay honest and testable:
 *
 * - "{n} photos sent" — what actually left the phone, counted from `ai_calls`,
 *   the server's own ledger. RLS lets the owner select their rows; a row with
 *   `workload = 'tagging'` and `succeeded = true` is a photo the tagger really
 *   received, so the count is distinct items among those rows — never a guess
 *   from client state, which forgets on reinstall.
 *
 * - "the {n} items already in your closet" — what a back-fill would send.
 *   `ai_tags` is the tagger's raw response, written only when tags come back
 *   (closet/queries.ts documents it as exactly that), so `ai_tags IS NULL` is
 *   the honest definition of "no AI tags" regardless of where an item sits in
 *   the status pipeline. Archived items are excluded: they are not "in your
 *   closet", and a back-fill should not spend uploads on them.
 */

export type SentPhoto = {
  itemId: string;
  /** Most recent successful send for this item — the date the list shows. */
  sentAt: string;
};

/**
 * Every item whose photo has actually been sent for tagging, newest first.
 * One entry per item: an item re-tagged twice was still one photo shared,
 * and "12 photos sent" must not double-count a retry.
 */
export function useSentPhotos() {
  return useQuery({
    queryKey: ['ai-sent-photos'],
    queryFn: async (): Promise<SentPhoto[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('ai_calls')
        .select('item_id, created_at')
        .eq('user_id', userId)
        .eq('workload', 'tagging')
        .eq('succeeded', true)
        .not('item_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const seen = new Set<string>();
      const photos: SentPhoto[] = [];
      for (const row of data ?? []) {
        if (!row.item_id || seen.has(row.item_id)) continue;
        seen.add(row.item_id);
        photos.push({ itemId: row.item_id, sentAt: row.created_at });
      }
      return photos;
    },
  });
}

/**
 * How many of the user's items have no AI tags — the number both the
 * "doesn't go back through the {n} items" paragraph and the back-fill card
 * name. `head: true` so only the count crosses the wire.
 *
 * `refetchInterval` is for the back-fill's quiet progress state: while a
 * back-fill is running the screen polls this count and watches it drain.
 */
export function useUntaggedCount(opts?: {
  refetchInterval?: number | false | ((query: { state: { data?: number | undefined } }) => number | false);
}) {
  return useQuery({
    queryKey: ['untagged-count'],
    refetchInterval: opts?.refetchInterval ?? false,
    queryFn: async (): Promise<number> => {
      const userId = await getUserId();
      if (!userId) return 0;

      const { count, error } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_archived', false)
        .is('ai_tags', null);

      if (error) throw error;
      return count ?? 0;
    },
  });
}

export type SentItemDetail = {
  id: string;
  thumbPath: string | null;
  cutoutPath: string | null;
  /** Subcategory when the tagger produced one, category otherwise — labelFor's rule. */
  name: string;
};

function nameFor(subcategory: string | null, category: string | null): string {
  const raw = (subcategory ?? category ?? '').trim();
  if (!raw) return 'Item';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Thumbnail + name for the "See what we sent" list. Fetched only when the
 * list is opened (`enabled`), keyed by the item ids so the sent-photos query
 * refreshing does not refetch details that have not changed.
 */
export function useSentItemDetails(itemIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ['ai-sent-items', itemIds],
    enabled: enabled && itemIds.length > 0,
    queryFn: async (): Promise<Record<string, SentItemDetail>> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, thumb_path, cutout_path, subcategory, category')
        .in('id', itemIds);

      if (error) throw error;

      const map: Record<string, SentItemDetail> = {};
      for (const row of data ?? []) {
        map[row.id] = {
          id: row.id,
          thumbPath: row.thumb_path,
          cutoutPath: row.cutout_path,
          name: nameFor(row.subcategory, row.category),
        };
      }
      return map;
    },
  });
}
