import { Image } from 'expo-image';
import { Linking, Pressable, View } from 'react-native';

import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import type { ShopFeedCard } from '@/features/explore/shop-feed';
import { track } from '@/lib/posthog';

/**
 * The full closet-similarity shelf — partner clothing like what you own.
 *
 * ── IT MOVED, IT DID NOT SHRINK (2026-09-02, P1 #18) ───────────────────────
 * This used to render whole at the end of Explore. Explore now carries ONE
 * compact grid of six (`shop-shelf.tsx`) and this section draws in full on
 * `/shop`, behind that grid's "See more" — the page is the circle, and a
 * merchant feed under it was slowly making it something else.
 *
 * Cinch's own grammar, not a shop's: paper
 * ground, bordered wells, serif nothing — no masonry, no badges, no urgency.
 * Every card opens the merchant's own page and says so; Cinch still has no
 * cart and no checkout, and the choosing happened on the phone before any
 * shop was consulted (the standing privacy sentence, kept true here).
 *
 * Renders nothing without cards — absent, not greyed — and the caller gates
 * it on the person's own "Show where to buy" switch, so turning that off in
 * Privacy & data removes this shelf the way it removes every other shop
 * surface.
 */
export function ShopFeedSection({ cards }: { cards: ShopFeedCard[] }) {
  if (cards.length === 0) return null;

  const open = (card: ShopFeedCard) => {
    // The event carries NOTHING about the card: not the merchant, not the
    // kind, not the title. That a shelf item was opened is the whole fact.
    track('explore_shop_product_opened');
    void Linking.openURL(card.pageUrl);
  };

  return (
    <View className="mt-10 px-gutter">
      <SectionHeader title="Like your closet, from the shops" className="mb-1" />
      <Text variant="note" className="mb-3 text-muted">
        Picked from the kinds of pieces you already own. Each opens the shop’s own page.
      </Text>

      <View className="flex-row flex-wrap justify-between">
        {cards.map((card) => (
          <Pressable
            key={card.key}
            accessibilityRole="link"
            accessibilityLabel={`${card.title}${card.merchant ? `, at ${card.merchant}` : ''}. Opens the shop.`}
            onPress={() => open(card)}
            className="mb-4 active:opacity-70"
            style={{ width: '48.5%' }}>
            <View
              className="items-center justify-center rounded-md border border-hairline bg-surface"
              style={{ aspectRatio: 0.8, overflow: 'hidden' }}>
              <Image
                source={{ uri: card.imageUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
                transition={150}
                accessibilityIgnoresInvertColors
              />
            </View>
            <Text variant="label" className="mt-2 text-ink">
              {card.title}
            </Text>
            <Text variant="note" className="mt-0.5 text-muted">
              {card.brand ?? card.merchant ?? 'Opens the shop'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
