import { Image } from 'expo-image';
import { Linking, Pressable, View } from 'react-native';

import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import type { PartnerFeedItem } from '@/features/explore/use-partner-feed';
import { track } from '@/lib/posthog';

/**
 * The partner shelf — every shop Cinch has a paid arrangement with, shown as
 * such.
 *
 * Draws in full on `/shop` since 2026-09-02 (P1 #18); the six-card grid on
 * Explore is `shop-shelf.tsx`, where these rows arrive already marked `paid`
 * so the disclosure rides each card rather than a block that would be false
 * for the closet-similarity cards beside them.
 *
 * Sits under the closet-similarity feed and follows its grammar (paper
 * ground, bordered wells, no urgency), with the one difference the law and
 * the help article both care about: THESE ARE PAID LINKS AND THE SHELF SAYS
 * SO, once, plainly, above the grid — the same disclosure rule the gap rows
 * carry per-row. Cinch may earn a commission; which products appear and their
 * order are the feed's own, not bid on.
 *
 * Renders nothing without items, and the caller gates it on the person's own
 * "Show where to buy" switch — the C-03 rule every shop surface obeys.
 */
export function PartnerShopSection({ items }: { items: PartnerFeedItem[] }) {
  if (items.length === 0) return null;

  const open = (item: PartnerFeedItem) => {
    // A shelf item was opened; which one stays out of analytics, same rule
    // as the shop feed. `shelf` is a two-value enum, not content.
    track('explore_shop_product_opened', { shelf: 'partner' });
    void Linking.openURL(item.pageUrl);
  };

  return (
    <View className="mt-10 px-gutter">
      <SectionHeader title="From Cinch’s partners" className="mb-1" />
      <Text variant="note" className="mb-3 text-muted">
        Shops Cinch has a paid arrangement with — we may earn a commission if you buy. Each opens
        the shop’s own page.
      </Text>

      <View className="flex-row flex-wrap justify-between">
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="link"
            accessibilityLabel={`${item.title}, at ${item.merchant}. Paid link — opens the shop.`}
            onPress={() => open(item)}
            className="mb-4 active:opacity-70"
            style={{ width: '48.5%' }}>
            <View
              className="items-center justify-center rounded-md border border-hairline bg-surface"
              style={{ aspectRatio: 0.8, overflow: 'hidden' }}>
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
                transition={150}
                accessibilityIgnoresInvertColors
              />
            </View>
            <Text variant="label" className="mt-2 text-ink">
              {item.title}
            </Text>
            <Text variant="note" className="mt-0.5 text-muted">
              {item.merchant} · Paid link
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
