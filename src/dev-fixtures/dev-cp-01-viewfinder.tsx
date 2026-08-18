/**
 * CP-01 fixture — redesign 22, frame 04: the live viewfinder, empty.
 *
 * THE CAMERA CANNOT RENDER IN THE SIMULATOR, so this poses the stage with the
 * preview left as the ground it falls back to on a device with no session. What
 * is being checked is the CHROME, which is the whole of the brief's first
 * clause: a close disc, one pill, four corner marks, a 76pt shutter, a 52pt
 * library door and the describe door — and nothing else. No title, no
 * instruction sentence, no filed-count pill, no dashed rectangle.
 *
 * Inert: every callback is a no-op.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CloseDisc,
  DescribeDoor,
  FramingCorners,
  LibraryDoor,
  Shutter,
  StagePill,
} from '@/components/ingest/capture-parts';
import { CAPTURE, heldPill } from '@/features/ingest/capture-spec';

export default function DevCp01ViewfinderScreen() {
  return (
    <View className="flex-1" style={{ backgroundColor: CAPTURE.stage }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1">
        <View className="flex-row items-center justify-between px-gutter pb-2">
          <CloseDisc onPress={() => {}} />
          <StagePill label={heldPill(0)} />
        </View>

        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: CAPTURE.preview }}>
          <FramingCorners previewHeight={480} />
        </View>

        <View
          className="flex-row items-center justify-between"
          style={{ paddingHorizontal: 26, paddingTop: 20, paddingBottom: 10 }}>
          <LibraryDoor onPress={() => {}} thumbUri={null} count={0} hint="Opens your photos." />
          <Shutter onPress={() => {}} disabled={false} busy={false} hint="Files this piece and stays open" />
          <DescribeDoor onPress={() => {}} />
        </View>
      </SafeAreaView>
    </View>
  );
}
