import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompactGapRow, LeadGapCard } from '@/components/gap-feed/gap-feed-parts';
import { ShopRows } from '@/components/gap-feed/shop-row';
import {
  BOTTOM_GAP,
  FIXTURE_TALLY,
  SHOE_GAP,
  WAITING_TOPS,
} from '@/components/gap-feed/w3-g5-fixture-data';
import { Text } from '@/components/ui/text';
import { CARD, GAP_FEED_COPY, TYPE, mastheadLine, rankEyebrow } from '@/features/closet/gap-feed-spec';

/**
 * GF-02 · redesign 26 — the same feed with NO merchant tray.
 *
 * THE ACCEPTANCE CASE FOR SILENCE. Correction 21: when the catalogue returns
 * nothing — nothing matched, the viewer's "Show where to buy" is off, the
 * account is signed out, or the provider is down — the tray renders NOTHING and
 * says nothing. The packet draws three separate silence frames for those four
 * causes and they are all this one picture, because the app deliberately cannot
 * tell them apart on screen: `useShopMatch` returns an empty list for every
 * failure mode, and `ShopRows` returns `null` on an empty list.
 *
 * Nothing about this card looks like a card with a row missing. It ends on its
 * own sentence, at its own radius, and the gap it states is complete without
 * any shop having been consulted — which is the whole claim the feed makes.
 *
 * `ShopRows` is passed an empty array HERE rather than the footer being omitted
 * at the call site, so the frame proves the component's own emptiness rule
 * instead of proving that a fixture can leave a prop out.
 */
export default function DevGf02() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-12 pt-1">
        <Text variant="title" trim style={{ fontSize: TYPE.masthead, lineHeight: TYPE.mastheadLineHeight }}>
          {GAP_FEED_COPY.title}
        </Text>
        <Text
          variant="body"
          className="mt-2 text-muted"
          style={{ fontSize: TYPE.supporting, lineHeight: 22 }}>
          {mastheadLine({ activeFull: false, totalFull: false, cards: 2 })}
        </Text>

        <View className="mt-4" style={{ gap: CARD.gap }}>
          <LeadGapCard
            eyebrow={rankEyebrow(0)}
            gain={BOTTOM_GAP}
            tally={FIXTURE_TALLY}
            pieces={WAITING_TOPS.shown}
            gloss
            ax={false}
            onPress={() => undefined}
            footer={<ShopRows products={[]} onOpenProduct={() => undefined} stacked={false} />}
          />
          <CompactGapRow
            eyebrow={rankEyebrow(1)}
            gain={SHOE_GAP}
            tally={FIXTURE_TALLY}
            ax={false}
            onPress={() => undefined}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
