/**
 * CP-03 fixture — redesign 22, frame 07: the batch page, early.
 *
 * "Honest counts, never a percent." What to check is the ladder: two tray rows
 * reading Filed in oxblood, two blush rows reading Filing, two pale rows
 * reading Waiting, the spelled subline above them, and the foot that promises
 * leaving costs nothing.
 *
 * The status inks are NOT the frame's — three of the frame's four fail AA at
 * 13px on their own ground, and `capture-spec.ts` records the substitution. The
 * grounds are the frame's exactly, which is where the ladder actually lives.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { CloseDisc, FilingRowView, PageMasthead } from '@/components/ingest/capture-parts';
import { CP_FILING_EARLY } from '@/features/ingest/capture-fixtures';
import { FILING_FOOT, PAGE, filingRows, filingSubline, filingTitle } from '@/features/ingest/capture-spec';

export default function DevCp03FilingScreen() {
  const rows = filingRows(CP_FILING_EARLY);

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-canvas">
      <View className="flex-row justify-start px-gutter pb-1 pt-2">
        <CloseDisc tone="canvas" glyph="chevron.left" label="Back" onPress={() => {}} />
      </View>
      <PageMasthead title={filingTitle(rows.length)} sub={filingSubline(rows)} />
      <View className="px-gutter" style={{ gap: PAGE.rowGap }}>
        {rows.map((row) => (
          <FilingRowView key={row.id} row={row} imageUri={null} />
        ))}
      </View>
      <View className="flex-1" />
      <View className="px-gutter pb-4">
        <Text variant="note" style={{ fontSize: 13 }}>
          {FILING_FOOT}
        </Text>
      </View>
    </SafeAreaView>
  );
}
