import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GapCard } from '@/components/gap-feed/gap-card';
import { ShopRows } from '@/components/gap-feed/shop-row';
import {
  BOTTOM_GAP,
  FIXTURE_MATCHES,
  FIXTURE_TALLY,
  WAITING_TOPS,
} from '@/components/gap-feed/w3-g5-fixture-data';
import { Text } from '@/components/ui/text';

/**
 * GF-02 — merchant matches under the computed line.
 *
 * THE FRAME CORRECTION 19 EXISTS FOR. Two merchants, one joined and one not:
 *
 *   Everlane · joined  →  "Open"            with "Paid link" under it
 *   Uniqlo   · direct  →  "Open at Uniqlo"  and no marker at all
 *
 * There is no marker over the block, because a block-level marker was false
 * for Uniqlo's row every time it was drawn. The commission sentence appears
 * only because Everlane's row is visible, and it names all three things a
 * commission does not change — the gap, the match and the order.
 *
 * WHAT THIS FRAME IS ALSO EVIDENCE FOR
 *
 * · The computed explanation keeps the paper ground and the larger type; the
 *   merchant block is a tray footer INSIDE the same card, quieter in every
 *   dimension. The gap is the product; this is the footnote.
 * · Prices are floors — `floorPriceLabel` prints "from $88" from the feed's
 *   own `priceCents`. No literal is written anywhere in this lane, and there
 *   is no strikethrough, no was/now pair, no sale badge and no urgency.
 * · "Open" is ink text, not a filled accent action. No oxblood is spent on
 *   buying anywhere in this product.
 *
 * DETERMINISM: `ShopRows` is the pure half of the merchant tray, so this frame
 * renders literal matches and never touches `useShopMatch` or the network.
 */
export default function DevW3G5GF02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-6 pt-2.5">
        <Text variant="title" trim style={{ fontSize: 30, lineHeight: 32 }}>
          What your closet is missing
        </Text>
        <Text variant="note" className="mt-1.5" style={{ fontSize: 15, lineHeight: 22 }}>
          Two gaps, computed from what you own.
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10 pt-3.5" contentContainerStyle={{ gap: 12 }}>
        <GapCard
          eyebrow="Biggest gap"
          gain={BOTTOM_GAP}
          tally={FIXTURE_TALLY}
          pairings={WAITING_TOPS}
          stacked={false}
          footer={
            <ShopRows
              products={FIXTURE_MATCHES}
              onOpenProduct={() => undefined}
              stacked={false}
            />
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
