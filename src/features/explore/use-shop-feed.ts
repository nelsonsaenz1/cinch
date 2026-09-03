import { useQuery } from '@tanstack/react-query';

import type { CatalogueFamilies } from '@/features/catalogue/types';
import { track } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';

import { closetProfile, profileKey } from './closet-affinity';
import {
  closetColourNames,
  confidentShelf,
  feedCards,
  feedSlots,
  type ShopFeedCard,
  type ShopFeedSlot,
} from './shop-feed';

/**
 * The shop feed's one read: a browse per owned kind, merged into a grid.
 *
 * Each request is `{ action: 'browse', slot }` — the enum-only body the
 * catalogue browse ships with (`use-catalogue-browse.ts`), so nothing about
 * this closet travels; which slots get asked is decided on the device and
 * the wire carries fixed words. The server caches browse results for
 * everyone (`catalog_cache`), which is what makes a feed affordable: the
 * first visit of the day warms the slot for every later one.
 *
 * Failure policy is a feed's, not a flow's: slots settle independently, a
 * failed one simply contributes nothing, and an all-failed read renders the
 * section absent rather than an error hero — Explore's page is the circle;
 * the feed is a shelf at the end of it.
 */

const STALE_MS = 30 * 60_000;

async function browseSlot(slot: ShopFeedSlot): Promise<{ slot: ShopFeedSlot; families: CatalogueFamilies } | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{ families?: CatalogueFamilies | null }>(
      'garment-search',
      { body: { action: 'browse', slot } },
    );
    if (error || !data?.families) return null;
    return { slot, families: data.families };
  } catch {
    return null;
  }
}

export function useShopFeed(
  wardrobe: readonly Parameters<typeof closetProfile>[0][number][] &
    readonly Parameters<typeof closetColourNames>[0][number][] &
    readonly Parameters<typeof feedSlots>[0][number][],
  enabled: boolean,
) {
  const slots = feedSlots(wardrobe);
  // The closet's profile — department, formality, palette, fabrics, prints,
  // brands — rides into the RANKING only, never the wire (closet-affinity.ts).
  // The key is a short bounded string of it, so a closet that changes
  // department or palette re-ranks and one that does not is served from cache.
  const profile = closetProfile(wardrobe);
  const signature = profileKey(profile);

  return useQuery({
    queryKey: ['explore-shop-feed', slots, signature],
    enabled: enabled && slots.length > 0,
    staleTime: STALE_MS,
    queryFn: async (): Promise<ShopFeedCard[]> => {
      const settled = await Promise.all(slots.map(browseSlot));
      // `confidentShelf` is the shelf-level half of the category gate: a run
      // that survives it with fewer than four cards is a catalogue answer that
      // was mostly not clothing, and the honest shelf for that is none at all
      // (`shop-feed.ts`, MIN_CONFIDENT_CARDS).
      const cards = confidentShelf(
        feedCards(settled.filter((s): s is NonNullable<typeof s> => s !== null), profile),
      );
      // A COUNT and a slot count. Which kinds this closet holds is the
      // closest thing this feature knows to closet content, so even the slot
      // NAMES stay out of analytics.
      track('explore_shop_feed_loaded', { cards: cards.length, kinds: slots.length });
      return cards;
    },
  });
}
