import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LeadGapCard, ScrollHint } from '@/components/gap-feed/gap-feed-parts';
import { ShopRows } from '@/components/gap-feed/shop-row';
import {
  BOTTOM_GAP,
  FIXTURE_MATCHES,
  FIXTURE_TALLY,
  WAITING_TOPS,
} from '@/components/gap-feed/w3-g5-fixture-data';
import { Text } from '@/components/ui/text';
import { CARD, GAP_FEED_COPY, TYPE, mastheadLine, rankEyebrow } from '@/features/closet/gap-feed-spec';

/**
 * GF-04 · redesign 26 — the largest Dynamic Type composition.
 *
 * WHAT GROWS, AND WHAT THAT COSTS
 *
 * · The wells YIELD HEIGHT rather than dropping to a column. Three across is
 *   the composition's whole claim — two you own and one you do not — and a
 *   stacked version of that is not a smaller version of the same picture, it is
 *   a list.
 * · The merchant row UNSTACKS into a card: title, then merchant and price on
 *   their own lines, then the disclosure at 14pt rather than 11, then Open as a
 *   full-width 48pt action. A disclosure that does not scale with the type is a
 *   disclosure that disappears, so "Paid link" grows with everything else.
 * · The commission sentence takes its shorter form — the same claim with the
 *   gap/match pair collapsed into "what is shown". It is NOT a quieter
 *   disclosure and it is never absent while a paid row is on screen.
 * · The scroll hint appears, because at this size only the leading card fits a
 *   viewport and the reader is told the rest exists rather than left to find
 *   it. It counts what is actually below it.
 *
 * `ax`/`stacked` are passed explicitly so the frame reproduces without the
 * device's own text-size setting — the components read `useAx()` in the app.
 */
export default function DevGf04() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-12 pt-1">
        <Text variant="title" trim style={{ fontSize: TYPE.mastheadAx, lineHeight: TYPE.mastheadAx + 4 }}>
          {GAP_FEED_COPY.title}
        </Text>
        <Text
          variant="body"
          className="mt-2 text-muted"
          style={{ fontSize: TYPE.supportingAx, lineHeight: TYPE.supportingAxLineHeight }}>
          {mastheadLine({ activeFull: false, totalFull: false, cards: 3 })}
        </Text>

        <View className="mt-4" style={{ gap: CARD.gap }}>
          <LeadGapCard
            eyebrow={rankEyebrow(0)}
            gain={BOTTOM_GAP}
            tally={FIXTURE_TALLY}
            pieces={WAITING_TOPS.shown}
            gloss
            ax
            onPress={() => undefined}
            footer={
              <ShopRows products={FIXTURE_MATCHES} onOpenProduct={() => undefined} stacked />
            }
          />
          <ScrollHint remaining={2} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
