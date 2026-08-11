import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import type { CatalogSlot } from './slot';
import { useShowWhereToBuy } from './queries';

/**
 * One matched, purchasable product — the client's own shape, declared
 * independently of `supabase/functions/gap-shop-match/index.ts`'s `ShopMatch`.
 * The two are not imported from a shared file on purpose: the edge function is
 * a Deno module and cannot be imported into the Expo bundle, and duplicating a
 * five-field response shape costs less than a cross-runtime build step would.
 */
export type ShopMatch = {
  id: string;
  title: string;
  brand: string | null;
  colour: string | null;
  priceCents: number | null;
  currency: string | null;
  imageUrl: string;
  merchantName: string;
  /** Already a tracking link — commerce-directive.md §6 refusal 7 is the edge
   *  function's job, not this hook's; nothing here ever builds a link. */
  trackingUrl: string;
};

/**
 * Catalogue matches for one slot — the shared primitive behind both C-01/C-02
 * (the Gap Feed, via `useGapShopMatch`) and C-04 (a friend's item detail,
 * which passes its own `category` directly — see `slot.ts`'s header for why
 * no translation is needed there).
 *
 * Returns an empty list rather than an error whenever there is nothing to
 * show — no merchant match, the account's own "Show where to buy" is off, or
 * the account is signed out — because C-01 states the absence rule in plain
 * terms: "If no merchant matches, the row is absent entirely." An absent row
 * and a failed fetch must look identical to the screen.
 */
export function useShopMatch(slot: CatalogSlot | null, enabled: boolean) {
  const preference = useShowWhereToBuy();
  const allowed = preference.data ?? true;

  return useQuery({
    queryKey: ['gap-shop-match', slot],
    enabled: enabled && slot !== null && !preference.isLoading && allowed,
    queryFn: async (): Promise<ShopMatch[]> => {
      const { data, error } = await supabase.functions.invoke<{ products: ShopMatch[] }>(
        'gap-shop-match',
        { body: { slot } },
      );
      // A failed match is silence, not an error state: the merchant row's own
      // absence rule (C-01) covers "the network hiccuped" exactly the same as
      // "nothing matched" — neither is worth a retry banner under a card that
      // is already showing the real, computed gap.
      if (error) return [];
      return data?.products ?? [];
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}
