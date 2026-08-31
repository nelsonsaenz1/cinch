import { useQuery } from '@tanstack/react-query';

import type { CatalogueFamilies } from '@/features/catalogue/types';
import { track } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';

import { closetColourNames, feedCards, feedSlots, type ShopFeedCard, type ShopFeedSlot } from './shop-feed';

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
  wardrobe: readonly Parameters<typeof closetColourNames>[0][number][] &
    readonly Parameters<typeof feedSlots>[0][number][],
  enabled: boolean,
) {
  const slots = feedSlots(wardrobe);
  // The closet's palette rides into the RANKING only — never the wire. Top
  // six names is plenty of signal without letting one giant closet turn the
  // scorer into a regex farm.
  const palette = closetColourNames(wardrobe).slice(0, 6);

  return useQuery({
    queryKey: ['explore-shop-feed', slots, palette],
    enabled: enabled && slots.length > 0,
    staleTime: STALE_MS,
    queryFn: async (): Promise<ShopFeedCard[]> => {
      const settled = await Promise.all(slots.map(browseSlot));
      const cards = feedCards(settled.filter((s): s is NonNullable<typeof s> => s !== null), palette);
      // A COUNT and a slot count. Which kinds this closet holds is the
      // closest thing this feature knows to closet content, so even the slot
      // NAMES stay out of analytics.
      track('explore_shop_feed_loaded', { cards: cards.length, kinds: slots.length });
      return cards;
    },
  });
}
