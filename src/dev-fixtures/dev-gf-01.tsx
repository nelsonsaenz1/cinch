import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CompactGapRow,
  LeadGapCard,
} from '@/components/gap-feed/gap-feed-parts';
import { ShopRows } from '@/components/gap-feed/shop-row';
import {
  BOTTOM_GAP,
  FIXTURE_MATCHES,
  FIXTURE_TALLY,
  SHOE_GAP,
  WAITING_TOPS,
} from '@/components/gap-feed/w3-g5-fixture-data';
import { Text } from '@/components/ui/text';
import { CARD, GAP_FEED_COPY, TYPE, mastheadLine, rankEyebrow } from '@/features/closet/gap-feed-spec';

/**
 * GF-01 · redesign 26 — the standard feed, one paid row and one direct.
 *
 * THE CANONICAL FRAME. Imagery first, headline second, one sentence third, the
 * merchant tray as a footnote inside the same card, and the runner-up gap as a
 * compact row underneath it.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · The brief's own instruction — "gap cards led by the outfit-you-can't-make
 *   imagery". Two garments the fixture closet really holds, then the dashed
 *   well where the third would go. No catalogue photograph has entered the
 *   card; the merchant pictures live in the tray, below the fold of the claim.
 * · Correction 19 — disclosure is PER ROW. Everlane carries "Paid link" and
 *   Uniqlo carries none, and the commission sentence exists because exactly one
 *   paid row is visible. A block-level marker would be visible here as a single
 *   label over both rows, and there is none.
 * · Audit 85 — no bare delta. The sentence names the unit, glosses it, and
 *   prints both endpoints, every figure from `countOutfits()`.
 *
 * DETERMINISM: `ShopRows` rather than `GapShopFooter`, so the frame never
 * touches the network; no clock, no random source, no spinner, no shimmer.
 */
export default function DevGf01() {
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
            footer={
              <ShopRows products={FIXTURE_MATCHES} onOpenProduct={() => undefined} stacked={false} />
            }
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
