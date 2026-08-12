import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GapCard } from '@/components/gap-feed/gap-card';
import { ShopRows } from '@/components/gap-feed/shop-row';
import {
  BOTTOM_GAP,
  FIXTURE_MATCHES,
  FIXTURE_TALLY,
} from '@/components/gap-feed/w3-g5-fixture-data';
import { Text } from '@/components/ui/text';

/**
 * GF-02 / AX — largest Dynamic Type, merchant rows stack.
 *
 * WHAT CHANGES, AND WHY EACH ONE CHANGES
 *
 * · THE ROW UNSTACKS INTO A CARD. Merchant, product and price take their own
 *   lines and Open becomes a full-width 48pt action beneath them. A horizontal
 *   row with a trailing action cannot survive 19pt type at 393pt without
 *   either truncating the product name or shrinking the target.
 * · "PAID LINK" GROWS TO 14pt MEDIUM, not 11 — a disclosure that does not
 *   scale with the type is a disclosure that disappears, which is the one
 *   thing this frame exists to prevent. It sits INSIDE the merchant card,
 *   above that card's own action: the atlas sketches it at the top of the
 *   tray, but correction 19 is explicit that no block-level marker exists, and
 *   at this size only one merchant is visible at a time — so a tray-level
 *   marker would read as this merchant's and then be wrong for the next one.
 * · THE COMMISSION SENTENCE GROWS TO 16pt, for the same reason, in its shorter
 *   form. It is still present only because a paid row is visible.
 * · THE COMPUTED EXPLANATION KEEPS ITS PLACE ABOVE, at 30pt display and 20pt
 *   prose, so the hierarchy the audit demands survives the type size: the gap
 *   is still the product and the merchants are still the footnote.
 * · ONE MERCHANT AT A TIME. Nothing is capped or dropped to achieve it — the
 *   second merchant is below the fold, which is the honest consequence of the
 *   type size rather than a hidden row.
 *
 * NOTHING IS TRUNCATED. No `numberOfLines` is set anywhere in the tray or the
 * card; every string takes the lines it needs.
 *
 * DETERMINISM: `stacked` is passed explicitly rather than read from the
 * simulator's font scale, so the frame is the same on any device. The shipping
 * components read `useWindowDimensions().fontScale` against `AX_STACK_SCALE`
 * and reach this identical composition on their own.
 */
export default function DevW3G5GF02AX() {
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
        <Text variant="title" trim style={{ fontSize: 32, lineHeight: 35 }}>
          What your closet is missing
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10 pt-3.5" contentContainerStyle={{ gap: 12 }}>
        <GapCard
          eyebrow="Biggest gap"
          gain={BOTTOM_GAP}
          tally={FIXTURE_TALLY}
          stacked
          footer={
            <ShopRows products={FIXTURE_MATCHES} onOpenProduct={() => undefined} stacked />
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
