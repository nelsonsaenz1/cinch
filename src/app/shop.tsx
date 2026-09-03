import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerShopSection } from '@/components/explore/partner-shop-section';
import { ShopFeedSection } from '@/components/explore/shop-feed-section';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useShowWhereToBuy } from '@/features/commerce/queries';
import { closetProfile, rankByAffinity } from '@/features/explore/closet-affinity';
import { usePartnerFeed } from '@/features/explore/use-partner-feed';
import { useShopFeed } from '@/features/explore/use-shop-feed';
import { useWardrobe } from '@/features/styling/queries';

/**
 * The full shop feed — what Explore's "See more" opens.
 *
 * WHY THIS ROUTE EXISTS. Explore is the circle; commerce there is one compact
 * grid of six (P1 #18, 2026-09-02). The shelves themselves did not shrink —
 * they moved. A person who wants a shop reaches it by tapping a door and
 * arriving somewhere that is honestly a shop, which is a different thing from
 * a social page that slowly becomes one.
 *
 * NO NEW READ AND NO NEW WIRE. Both hooks are the ones Explore already runs,
 * with the same query keys, so arriving here is served from the cache the
 * shelf warmed; the browse bodies still carry a fixed enum slot and the
 * partner read still carries no parameters at all.
 *
 * THE SAME GATE. `show_where_to_buy` (C-03) governs this page exactly as it
 * governs every other shop surface. With the switch off there is no door to
 * this route at all, and typing your way here anyway finds an empty state
 * naming the switch rather than a shelf that ignores it.
 */
export default function ShopScreen() {
  const router = useRouter();

  const showWhereToBuy = useShowWhereToBuy();
  const enabled = showWhereToBuy.data === true;

  const wardrobe = useWardrobe();
  const shopFeed = useShopFeed(wardrobe.data ?? [], enabled);
  const partnerFeed = usePartnerFeed(enabled);

  const closet = shopFeed.data ?? [];
  // Ranked like the closet shelf — department, formality, palette — and a
  // confident department mismatch dropped (closet-affinity.ts).
  const partner = rankByAffinity(partnerFeed.data ?? [], closetProfile(wardrobe.data ?? []));
  const settled = !showWhereToBuy.isLoading && !shopFeed.isLoading && !partnerFeed.isLoading;
  const nothing = settled && closet.length === 0 && partner.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="From the shops" backLabel="Back to Explore" />

      <ScrollView contentContainerClassName="pb-16" contentContainerStyle={{ flexGrow: 1 }}>
        {!enabled && !showWhereToBuy.isLoading ? (
          <EmptyState
            symbol="bag"
            title="Where to buy is off"
            body="You’ve turned off “Show where to buy”, so Cinch isn’t showing shops. Privacy and data has the switch."
            actionTitle="Open Privacy and data"
            onAction={() => router.push('/privacy')}
          />
        ) : nothing ? (
          <EmptyState
            symbol="bag"
            title="Nothing to show yet"
            body="The shops had nothing that matched the kinds of pieces you own. It’s worth another look later."
            actionTitle="Try again"
            onAction={() => {
              void shopFeed.refetch();
              void partnerFeed.refetch();
            }}
          />
        ) : (
          <View>
            {/* The two shelves, whole, in the order they answer in: what is
                like your closet first, then the partners' own stock. Each
                keeps its own heading and its own disclosure — the partner
                shelf's "paid arrangement" line is on the block whose every
                card is paid, which is the one place a block-level sentence is
                true. */}
            <ShopFeedSection cards={closet} />
            <PartnerShopSection items={partner} />
            <Text variant="note" className="mt-10 px-gutter text-muted">
              Cinch has no cart and no checkout. Every card opens the shop’s own page.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
