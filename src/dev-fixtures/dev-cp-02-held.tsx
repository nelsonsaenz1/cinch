/**
 * CP-02 fixture — redesign 22, frames 05 and 06: the stage with a batch held.
 *
 * The two things to check are the two pieces of chrome that grow: the pill
 * becomes a count ("6 held") and the strip appears above the control row, with
 * the Review door taking the slot beside the library well once something has
 * finished filing.
 *
 * The strip's thumbnails are empty wells rather than stock photographs: the
 * real strip only ever shows the user's own shots, and bundling a garment
 * picture into a fixture would put a picture in a screenshot the shipped screen
 * cannot produce.
 *
 * Inert: every callback is a no-op.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CloseDisc,
  DescribeDoor,
  FramingCorners,
  HeldStrip,
  LibraryDoor,
  ReviewPill,
  Shutter,
  StagePill,
} from '@/components/ingest/capture-parts';
import { CAPTURE, heldPill, reviewPill } from '@/features/ingest/capture-spec';
import { CP_FILING_EARLY } from '@/features/ingest/capture-fixtures';

export default function DevCp02HeldScreen() {
  const uris = CP_FILING_EARLY.map((j) => j.localUri);
  const done = CP_FILING_EARLY.filter((j) => j.stage === 'done').length;

  return (
    <View className="flex-1" style={{ backgroundColor: CAPTURE.stage }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1">
        <View className="flex-row items-center justify-between px-gutter pb-2">
          <CloseDisc onPress={() => {}} />
          <StagePill label={heldPill(uris.length)} />
        </View>

        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: CAPTURE.preview }}>
          <FramingCorners previewHeight={420} />
        </View>

        <View style={{ paddingTop: 12 }}>
          <HeldStrip uris={uris} />
        </View>

        <View
          className="flex-row items-center justify-between"
          style={{ paddingHorizontal: 26, paddingTop: 14, paddingBottom: 10 }}>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <LibraryDoor
              onPress={() => {}}
              thumbUri={null}
              count={uris.length}
              hint="Opens your photos."
            />
            <ReviewPill label={reviewPill(done)} onPress={() => {}} />
          </View>
          <Shutter onPress={() => {}} disabled={false} busy={false} hint="Files this piece and stays open" />
          <DescribeDoor onPress={() => {}} />
        </View>
      </SafeAreaView>
    </View>
  );
}
