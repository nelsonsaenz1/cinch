import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { productReason } from '@/components/gap-feed/gap-prose';
import { ProductSheetBody } from '@/components/gap-feed/product-sheet';
import {
  BOTTOM_GAP,
  DIRECT_MATCH,
  FIXTURE_TALLY,
  SHEET_PRODUCT,
} from '@/components/gap-feed/w3-g5-fixture-data';
import { Text } from '@/components/ui/text';
import { TYPE } from '@/features/closet/gap-feed-spec';

/**
 * GF-07 · redesign 26 — the product sheet, paid above direct.
 *
 * THE TWO SHEETS DIFFER BY THREE THINGS AND NOTHING ELSE:
 *
 *   joined  →  the "Paid link" marker under the merchant line; the commission
 *              paragraph in full, naming what commission does not change; the
 *              action reads "Open Everlane".
 *   direct  →  no marker anywhere; NO commission paragraph at all; the action
 *              reads "Open at the merchant" — generic on purpose, because a
 *              direct sheet's whole point is that Cinch has no arrangement with
 *              whoever is on the other side, and naming them there would read
 *              as an endorsement.
 *
 * A marker in this header is CORRECT where a tray-level one is not, and the
 * reason is structural rather than stylistic: a product sheet is always exactly
 * one merchant, so the marker cannot be false about a second row — there is no
 * second row it could be about.
 *
 * "Why this was suggested" repeats the GAP, never the product. Nothing in that
 * paragraph is read from the catalogue, so no merchant's own copy can ever end
 * up inside the reason a suggestion exists.
 *
 * DETERMINISM: `ProductSheetBody` with `inline`, so the frame is drawn by the
 * same code the app runs without a `Modal` having to be opened, and two of them
 * can share one scroller.
 */
export default function DevGf07() {
  const reason = productReason(FIXTURE_TALLY, BOTTOM_GAP);

  return (
    <SafeAreaView className="flex-1 bg-tray" edges={['top']}>
      <ScrollView contentContainerClassName="pb-12">
        <Text
          variant="title"
          trim
          className="px-gutter pt-4"
          style={{ fontSize: TYPE.compactHeadline, lineHeight: TYPE.compactHeadlineLineHeight }}>
          Product sheets
        </Text>

        <View className="mt-5" style={{ gap: 20 }}>
          <ProductSheetBody
            product={SHEET_PRODUCT}
            reason={reason}
            onDismiss={() => undefined}
            inline
            ax={false}
          />
          <ProductSheetBody
            product={DIRECT_MATCH}
            reason={reason}
            onDismiss={() => undefined}
            inline
            ax={false}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
