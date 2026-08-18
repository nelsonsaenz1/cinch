import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShopRows } from '@/components/gap-feed/shop-row';
import {
  DIRECT_MATCH,
  JOINED_MATCH,
  PRICELESS_MATCH,
  SECOND_JOINED_MATCH,
} from '@/components/gap-feed/w3-g5-fixture-data';
import { Text } from '@/components/ui/text';
import { CARD, TYPE } from '@/features/closet/gap-feed-spec';
import type { ShopMatch } from '@/features/commerce/use-shop-match';

/**
 * GF-06 · redesign 26 — every tray the disclosure rules allow, one under
 * another.
 *
 * THE PROPERTY UNDER TEST IS A COUNT. `tests/commerce-disclosure.test.ts`
 * asserts that a tray renders exactly as many "Paid link" markers as it has
 * paid rows, which is a property no block-level marker can satisfy for a mixed
 * tray. This frame is that assertion drawn: three markers over three paid rows,
 * none at all over three direct rows, and exactly one over the mixed pair.
 *
 * · THREE PAID · every row carries the marker in its own right, every action
 *   reads "Open", and the commission sentence takes its plural ("the paid links
 *   above") because three of them are visible.
 * · THREE DIRECT · no marker anywhere and NO commission sentence at all. A
 *   softened sentence over a tray where nothing earns would be the same false
 *   claim in a quieter voice.
 * · MIXED, PRICE UNKNOWN · the last row's price is `null`, so the row prints
 *   the merchant alone. Never a placeholder, never a dash, never a zero — a
 *   price this app has not got is a price it does not print.
 *
 * THREE IS THE CAP in every tray here, because `MAX_ROWS` is 3 on this surface
 * and `MAX_MERCHANTS` is 3 in the policy. A fixture with four rows would be
 * drawing a state the server cannot produce.
 */
const THREE_PAID: readonly ShopMatch[] = [
  JOINED_MATCH,
  SECOND_JOINED_MATCH,
  { ...JOINED_MATCH, id: 'arket-boxy', title: 'Boxy oxford trouser', merchantName: 'Arket' },
];

const THREE_DIRECT: readonly ShopMatch[] = [
  DIRECT_MATCH,
  { ...DIRECT_MATCH, id: 'muji-wide', title: 'Wide straight trouser', merchantName: 'Muji' },
  { ...DIRECT_MATCH, id: 'sunspel-twill', title: 'Washed broadcloth trouser', merchantName: 'Sunspel' },
];

const MIXED: readonly ShopMatch[] = [JOINED_MATCH, PRICELESS_MATCH];

function Tray({ label, products }: { label: string; products: readonly ShopMatch[] }) {
  return (
    <View>
      <Text variant="eyebrow" className="mb-2">
        {label}
      </Text>
      <View className="overflow-hidden bg-tray" style={{ borderRadius: CARD.radius }}>
        <ShopRows products={products} onOpenProduct={() => undefined} stacked={false} />
      </View>
    </View>
  );
}

export default function DevGf06() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-12 pt-4">
        <Text variant="title" trim style={{ fontSize: TYPE.compactHeadline, lineHeight: TYPE.compactHeadlineLineHeight }}>
          Merchant trays
        </Text>

        <View className="mt-5" style={{ gap: 22 }}>
          <Tray label="Three paid · the cap" products={THREE_PAID} />
          <Tray label="Three direct · no marker, no sentence" products={THREE_DIRECT} />
          <Tray label="Mixed · one marker, price unknown omitted" products={MIXED} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
