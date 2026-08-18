/**
 * CP-04 fixture — redesign 22, frame 08: the batch page with one piece short.
 *
 * "A settled failure stops looking busy." The wool coat's row takes the amber
 * ground and the "Needs another photo" word while the rest of the batch carries
 * on, and the cut-out notice sits under the rows over its own subject.
 *
 * The notice is the SHIPPED `CutoutFailedNotice`, not the frame's "Retake it /
 * Skip it" plate: its four strings are pinned verbatim by
 * `tests/cutout-failure.test.ts`. Recorded as a deviation.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CutoutFailedNotice } from '@/components/ingest/cutout-failed-notice';
import { CloseDisc, FilingRowView, PageMasthead } from '@/components/ingest/capture-parts';
import { CP_FILING_MIXED } from '@/features/ingest/capture-fixtures';
import { PAGE, filingRows, filingSubline, filingTitle } from '@/features/ingest/capture-spec';

export default function DevCp04FilingTroubleScreen() {
  const rows = filingRows(CP_FILING_MIXED);

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
      <View className="px-gutter pt-3.5">
        <CutoutFailedNotice jobId="e" count={1} />
      </View>
    </SafeAreaView>
  );
}
