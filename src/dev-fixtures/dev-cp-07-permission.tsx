/**
 * CP-07 fixture — redesign 22, frame 01: the ask, before the system sheet.
 *
 * The SHIPPING `CameraAsk`, not a posed copy: this card carries a
 * consent-adjacent promise about where a photograph goes, and a second
 * implementation of it in a fixture is a sentence free to drift from the one
 * users read. What to check is that all three doors are present — the ask, the
 * library, and describe — because the frame's whole annotation is that the
 * fallbacks are offered HERE and not hidden behind a refusal.
 *
 * Inert: every callback is a no-op, so nothing raises the OS prompt.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraAsk } from '@/components/ingest/camera-ask';
import { CloseDisc } from '@/components/ingest/capture-parts';

export default function DevCp07PermissionScreen() {
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-canvas">
      <View className="flex-row items-center justify-start px-gutter pt-2">
        <CloseDisc tone="canvas" onPress={() => {}} />
      </View>
      <CameraAsk onAsk={() => {}} onLibrary={() => {}} onDescribe={() => {}} />
    </SafeAreaView>
  );
}
