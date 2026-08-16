import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CutoutFailedNotice } from '@/components/ingest/cutout-failed-notice';
import { Text } from '@/components/ui/text';

/**
 * CP-05 — processing failed, photo kept.
 *
 * The notice as it renders on the capture surface, without the camera behind
 * it: a fixture that opened the viewfinder would capture differently on every
 * run and would need a device with a camera to draw at all.
 *
 * The two actions are the REAL ones. `retryCutout` returns immediately for a
 * job id that is not in the queue and `acceptFullPhoto` patches a job that does
 * not exist, so both are inert here without being stubbed — a fixture wired to
 * fakes would be posing a component that is not the shipping one.
 */
export default function DevW3G3Cp05() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="px-gutter pt-8">
        <Text variant="title" trim>
          Add clothes
        </Text>
        {/* Standing in for the rail the notice sits under — the notice is
            drawn over its own subject, never floating on an empty screen. */}
        <Text variant="note" className="mt-3">
          1 piece filed just now
        </Text>

        <CutoutFailedNotice jobId="dev-cp-05" count={1} />

        {/* The second frame the atlas implies but does not draw: more than one
            piece in a session losing its cutout. Singular says nothing extra. */}
        <View className="mt-12">
          <Text variant="eyebrow">Two in one session</Text>
          <CutoutFailedNotice jobId="dev-cp-05-b" count={2} />
        </View>
      </View>
    </SafeAreaView>
  );
}
