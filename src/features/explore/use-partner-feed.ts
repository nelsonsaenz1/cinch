import { useQuery } from '@tanstack/react-query';

import { track } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';

/**
 * Explore's partner shelf — every joined programme's products, served whole.
 *
 * One request, no parameters at all (`{ action: 'partner-feed' }`), so the
 * privacy story is even shorter than the shop feed's: nothing about this
 * person is in the request, and the answer is the same for every caller. The
 * server owns the round-robin, the slot-first ordering and — the part that
 * matters — every link: each `pageUrl` arrives as an Awin tracking URL built
 * by `_shared/commerce.ts`, publisher 3030871, no click identifiers. The
 * client never assembles or amends a commerce link.
 *
 * Founder order 2026-09-02: all joined partners' images, links and clothes on
 * Explore. The caller gates rendering on `show_where_to_buy`, the one switch
 * that governs every shop surface (C-03).
 */

export type PartnerFeedItem = {
  key: string;
  title: string;
  brand: string | null;
  merchant: string;
  imageUrl: string;
  pageUrl: string;
  priceCents: number | null;
  currency: string | null;
  slot: string | null;
};

const STALE_MS = 30 * 60_000;

export function usePartnerFeed(enabled: boolean) {
  return useQuery({
    queryKey: ['explore-partner-feed'],
    enabled,
    staleTime: STALE_MS,
    queryFn: async (): Promise<PartnerFeedItem[]> => {
      const { data, error } = await supabase.functions.invoke<{ items?: PartnerFeedItem[] | null }>(
        'garment-search',
        { body: { action: 'partner-feed' } },
      );
      if (error || !data?.items) return [];
      // A count and nothing else — same bound as the shop feed's load event.
      track('explore_shop_feed_loaded', { shelf: 'partner', cards: data.items.length });
      return data.items;
    },
  });
}
