import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { DiaryPage } from '@/features/diary/diary-page';
import { ALL_YEARS, diaryTotalLine, groupByMonth } from '@/features/diary/entry';
import { resolveFixtureImage, WD_ENTRIES, WD_NOW } from '@/features/diary/w3-g4-fixtures';

/**
 * WD-01 — populated, long names wrap.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 77 — the two longest realistic names in the set are drawn here and
 *   BOTH wrap to a second line rather than ellipsising. The width comes from a
 *   44pt date stack (weekday label over a display-face numeral) and a 56pt
 *   well, with every trailing fact moved under the name; there is no third
 *   column and no chevron left to take it.
 * · audit 78 — the month header is 13pt REGULAR in secondary ink, not the
 *   serif cut, and it carries no second total; the masthead's count is the one
 *   that follows the filter.
 * · Cost-per-wear appears on the first row, whose five pieces are all priced,
 *   and is ABSENT on the three whose pieces are not. The sentence simply ends.
 *   Nothing is estimated and nothing is a dash.
 * · A described piece — the navy merino crewneck, the black jeans — draws its
 *   silhouette at the same 56pt scale, so a words-only closet reads the same
 *   way.
 * · "No oxblood spent": nothing on this frame is an accent.
 *
 * DETERMINISM: every figure and every timestamp is a literal in
 * `features/diary/w3-g4-fixtures`, the photographs are the repo's own licensed
 * set, and the masthead's total is read against the frozen `WD_NOW` rather than
 * the system clock. No route on this frame reads a clock, a random source or a
 * network.
 */
export default function DevW3G4WD01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <DiaryPage
        months={groupByMonth(WD_ENTRIES)}
        totalLine={diaryTotalLine(WD_ENTRIES, ALL_YEARS, WD_NOW)}
        chips={[]}
        selectedChip={ALL_YEARS}
        onSelectChip={() => undefined}
        loading={false}
        error={false}
        retrying={false}
        onRetry={() => undefined}
        showEmpty={false}
        onPlanToday={() => undefined}
        onOpenEntry={() => undefined}
        refreshing={false}
        onRefresh={() => undefined}
        resolveImage={resolveFixtureImage}
      />
    </View>
  );
}
