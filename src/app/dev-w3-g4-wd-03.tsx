import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { DiaryPage } from '@/features/diary/diary-page';
import {
  ALL_YEARS,
  diaryTotalLine,
  groupByMonth,
  pieceWord,
  THIS_YEAR,
  undoneNotice,
} from '@/features/diary/entry';
import {
  resolveFixtureImage,
  WD_CREWNECK_DAY,
  WD_ENTRIES,
  WD_NOW,
  WD_PLANNED,
} from '@/features/diary/w3-g4-fixtures';

/**
 * WD-03 — filtered year, and a planned day among worn ones.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 78 — a planned day sits ABOVE the worn ones and is distinguished on
 *   three channels and no fourth: the word "Planned" begins its name, its name
 *   is set in the regular cut where a worn day is Medium, and a rule separates
 *   it from the record below. No opacity trick and no colour tint — a plan is a
 *   different kind of row, not a faded wear. Its metadata says "not worn yet",
 *   and it is not a button, because there is nowhere honest for it to lead:
 *   WD-02 is a recorded wear, and a plan has no weather, no cost and no
 *   correction window.
 * · The undo notice names BOTH figures it moved — the piece's own wear count
 *   and the record's total — because a count that moves without explanation is
 *   the thing the audit asks to fix. Neither is estimated:
 *   `unwear_outfit_tx` decrements each piece by exactly one as it deletes the
 *   row, so the arithmetic here is the transaction's defined effect.
 * · The masthead total FOLLOWS THE FILTER, so "in 2026" and an all-time figure
 *   can never appear in the same sentence.
 *
 * The undone wear is Tuesday's navy merino crewneck — a single-piece look, so
 * the notice can name one piece and one count, exactly as the atlas draws it.
 *
 * DETERMINISM: every figure is composed by the real selectors over the frozen
 * fixture and the frozen `WD_NOW`.
 */
export default function DevW3G4WD03() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  // The record as it stands AFTER the correction: Tuesday's wear is gone.
  const remaining = WD_ENTRIES.filter((e) => e.id !== WD_CREWNECK_DAY.id);
  const spine = [WD_PLANNED, ...remaining];

  const notice = undoneNotice({
    weekday: new Date(WD_CREWNECK_DAY.wornAt).toLocaleDateString('en-GB', { weekday: 'long' }),
    // The crewneck as it stood BEFORE the undo — five wears, going back to four.
    pieces: [
      {
        word: pieceWord(WD_CREWNECK_DAY.pieces[0]!),
        wearCount: WD_CREWNECK_DAY.pieces[0]!.wearCount,
      },
    ],
    totalLine: diaryTotalLine(remaining, THIS_YEAR, WD_NOW),
  });

  return (
    <View className="flex-1 bg-canvas">
      <DiaryPage
        months={groupByMonth(spine)}
        totalLine={diaryTotalLine(remaining, THIS_YEAR, WD_NOW)}
        chips={[
          { id: ALL_YEARS, label: 'All' },
          { id: THIS_YEAR, label: 'This year' },
          { id: '2025', label: '2025' },
        ]}
        selectedChip={THIS_YEAR}
        onSelectChip={() => undefined}
        undoneNotice={notice}
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
