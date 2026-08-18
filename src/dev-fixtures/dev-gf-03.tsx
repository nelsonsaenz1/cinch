import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LeadGapCard } from '@/components/gap-feed/gap-feed-parts';
import { GapLimitFooter } from '@/components/gap-feed/limit-footer';
import {
  ACTIVE_LIMIT,
  BOTTOM_GAP,
  FIXTURE_TALLY,
  WAITING_TOPS,
} from '@/components/gap-feed/w3-g5-fixture-data';
import { Text } from '@/components/ui/text';
import { CARD, GAP_FEED_COPY, TYPE, mastheadLine, rankEyebrow } from '@/features/closet/gap-feed-spec';

/** Standard's total ceiling. Both figures come from `plans.ts` in the app. */
const TOTAL_LIMIT = 450;

/**
 * GF-03 · redesign 26 — the two ceilings, side by side.
 *
 * THE COMMERCE TRAY IS REPLACED, NOT JOINED. A screen that cannot accept a new
 * piece has no business leading with where to buy one, so the capacity notice
 * takes the exact slot and inset the merchant tray would have occupied. Both
 * cards here draw that slot; only the notice inside it differs.
 *
 * TOP CARD · the ACTIVE ceiling. Storing frees a place, so "Choose one to
 * store" is offered and it really works.
 *
 * BOTTOM CARD · the TOTAL ceiling. Storing does NOT free a place there — the
 * stored pieces are the problem — so that action is absent rather than present
 * and doomed. Two ceilings, two remedies, and the difference is the whole
 * reason `useCapacity` keeps `full` and `storageFull` apart.
 *
 * NO PAYWALL IN EITHER. The artifact draws "See plans" as this panel's only
 * action; see `limit-footer.tsx` for why it is not adopted — the See-plans
 * placement fires exactly as shipped, from the gap detail, and a second trigger
 * on the feed would not be "as shipped".
 */
export default function DevGf03() {
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
          {mastheadLine({ activeFull: true, totalFull: false, cards: 1 })}
        </Text>

        <View className="mt-4" style={{ gap: CARD.gap }}>
          <LeadGapCard
            eyebrow={rankEyebrow(0)}
            gain={BOTTOM_GAP}
            tally={FIXTURE_TALLY}
            pieces={WAITING_TOPS.shown}
            gloss
            ax={false}
            footer={
              <GapLimitFooter
                ceiling="active"
                used={ACTIVE_LIMIT}
                limit={ACTIVE_LIMIT}
                onChooseToStore={() => undefined}
                onSeeStored={() => undefined}
              />
            }
          />

          <LeadGapCard
            eyebrow={rankEyebrow(0)}
            gain={BOTTOM_GAP}
            tally={FIXTURE_TALLY}
            pieces={WAITING_TOPS.shown}
            ax={false}
            footer={
              <GapLimitFooter
                ceiling="total"
                used={TOTAL_LIMIT}
                limit={TOTAL_LIMIT}
                onSeeStored={() => undefined}
              />
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
