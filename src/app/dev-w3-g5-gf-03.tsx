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

/**
 * GF-03 — the product sheet, drawn twice: opened from a JOINED row and opened
 * from a DIRECT one.
 *
 * A COMPARISON FRAME. One of these is on screen at a time in the running app;
 * they are drawn together because the whole of correction 19 is the difference
 * between them, and a single sheet cannot show a difference.
 *
 *   joined  →  header marker "Paid link"; commission paragraph in full;
 *              action "Open Everlane".
 *   direct  →  no marker anywhere; NO commission paragraph; action
 *              "Open at the merchant".
 *
 * The header marker is correct here and only here: a product sheet is always
 * one merchant, so the marker describes exactly one link. That is the same
 * fact that makes a block-level marker over a two-merchant tray false.
 *
 * ALSO EVIDENCE FOR
 *
 * · Correction 12 — the provenance line names the RETAILER as the source of
 *   both the picture and the price and admits it may be stale. The listing
 *   service is not named; Privacy → Shopping partners names it in full, which
 *   is where the complete answer belongs, and this line agrees with that
 *   page's own "the pictures beside each result are the shops' own".
 * · Audit 85 — "Why this was suggested" restates the arithmetic with both
 *   endpoints, so the sheet is never a decontextualised advert.
 * · No oxblood on a purchase: the one filled action is ink, and "Back to the
 *   gap" is a quiet 44pt exit that buys nothing.
 *
 * DETERMINISM: `ProductSheetBody` is the sheet's contents without its `Modal`,
 * so both frames are drawn by the code the app runs, in place, with no
 * presentation animation and no network.
 */
export default function DevW3G5GF03() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const reason = productReason(FIXTURE_TALLY, BOTTOM_GAP);

  return (
    <SafeAreaView className="flex-1 bg-tray" edges={['top']}>
      <ScrollView contentContainerClassName="pb-10">
        <View className="px-gutter pb-1 pt-2">
          <Text variant="eyebrow">Opened from a joined row</Text>
        </View>
        <ProductSheetBody product={SHEET_PRODUCT} reason={reason} onDismiss={() => undefined} inline />

        <View className="px-gutter pb-1 pt-5">
          <Text variant="eyebrow">Opened from a direct row</Text>
        </View>
        <ProductSheetBody
          product={{ ...DIRECT_MATCH, title: 'The Pleated Trouser' }}
          reason={reason}
          onDismiss={() => undefined}
          inline
        />
      </ScrollView>
    </SafeAreaView>
  );
}
