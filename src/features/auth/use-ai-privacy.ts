import { useQuery } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

/**
 * The facts the Privacy screen (PD-02) states about what has actually left the
 * phone, kept out of the screen so the queries stay honest and testable.
 *
 * ── The undercount this file used to have ──────────────────────────────────
 *
 * Until 2026-08-10 every query here filtered `ai_calls` to
 * `workload = 'tagging'`, so "{n} photos sent" silently omitted the second
 * door: `garment-search`'s `match` action signs the user's own photo and sends
 * it to a vision model under the `garment_search` workload
 * (`supabase/functions/garment-search/index.ts:679`, attached at
 * `garment-search/provider.ts:434`). Any sentence promising the page showed
 * every photo that had left the phone was false. Found by the audit behind
 * docs/design/privacy-invite-help-contract.md Appendix A.3.
 *
 * ── Why it is two numbers and not one ──────────────────────────────────────
 *
 * Because the ledger cannot honestly produce one. `tag-item` writes `item_id`
 * on its row (`tag-item/index.ts:286`); `garment-search` writes none, on either
 * of its actions. So a `garment_search` send cannot be attributed to a piece,
 * cannot be de-duplicated against a re-run, and cannot be listed. Worse, the
 * `search` action shares the workload with `match` and sends a photo only when
 * the user attached one — so the row count for that workload is an upper bound
 * on photographs, not a count of them.
 *
 * Adding the two together would replace an undercount with an overcount and
 * print it as a single confident figure. Instead: `useSentPhotos` stays the
 * itemised ledger of what can be itemised, `useListingSendCount` counts the
 * second door separately, and `sentClause` in features/privacy/format.ts words
 * each for exactly what it is.
 *
 * ── Why failed calls count ─────────────────────────────────────────────────
 *
 * A row is written only after the provider call has been attempted — both
 * functions record accounting on the far side of the try
 * (`tag-item/index.ts:279-292`, `garment-search/index.ts:713-725`), and a
 * request refused by the quota check returns before any row exists. So
 * `succeeded = false` means the answer never came back, not that the
 * photograph stayed on the phone. Filtering those out, which this file used to
 * do, undercounts in the one direction a privacy page must never undercount.
 */

export type SentPhoto = {
  itemId: string;
  /** Most recent send for this item — the date the list shows. */
  sentAt: string;
};

/**
 * The workloads that can put a photograph on the wire.
 *
 * `outfit_generation` and `stylist_chat` are deliberately absent: the stylist
 * sends a digest and assembled outfits as text and never photographs
 * (`supabase/functions/stylist-chat/index.ts:23`, `:137`), and outfits are
 * built on-device by the beam search in `src/lib/styling/generate.ts`.
 */
const PHOTO_WORKLOADS = ['tagging', 'garment_search'] as const;

/**
 * `garment_search` rows that are not a model call at all.
 *
 * Pasting a retailer link spends a `garment_search` unit and writes a row with
 * `provider: 'link-import'` (`garment-search/index.ts:653-657`). It fetches a
 * web page; it sends no photograph. Counting it would be the overcount this
 * file exists to avoid.
 */
const NON_MODEL_PROVIDER = 'link-import';

/**
 * Every item whose photo has actually been sent, newest first.
 *
 * One entry per item: an item re-tagged twice was still one photo shared, and
 * the list must not double-count a retry. Filtered to rows that name an item,
 * which today means the tagger — `garment-search` records no `item_id`, so its
 * sends are counted by `useListingSendCount` and cannot appear here. If that
 * function ever starts recording one, these rows join the list with no change
 * to this query, which is why the filter is on `item_id` and the workload set
 * rather than on `workload = 'tagging'` alone.
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
        .in('workload', PHOTO_WORKLOADS)
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
 * How many times the listing search has run — the second door, counted.
 *
 * Every `match` sends the piece's photograph; a `search` sends one only when
 * the user attached a colour reference, and nothing in `ai_calls` separates
 * the two. So this is a count of listing searches, and PD-02 says so in those
 * words rather than calling them photographs.
 *
 * `head: true` — only the count crosses the wire.
 */
export function useListingSendCount() {
  return useQuery({
    queryKey: ['ai-listing-sends'],
    queryFn: async (): Promise<number> => {
      const userId = await getUserId();
      if (!userId) return 0;

      const { count, error } = await supabase
        .from('ai_calls')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('workload', 'garment_search')
        .neq('provider', NON_MODEL_PROVIDER);

      if (error) throw error;
      return count ?? 0;
    },
  });
}

/**
 * How many of the user's items have no AI tags — the number both the
 * "doesn't go back through the {n} items" paragraph and the back-fill card
 * name. `head: true` so only the count crosses the wire.
 *
 * `ai_tags` is the tagger's raw response, written only when tags come back
 * (closet/queries.ts documents it as exactly that), so `ai_tags IS NULL` is
 * the honest definition of "no AI tags" regardless of where an item sits in
 * the status pipeline. Archived items are excluded: they are not "in your
 * closet", and a back-fill should not spend uploads on them.
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
