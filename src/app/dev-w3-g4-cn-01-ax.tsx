import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY · Wave 3 atlas state CN-01/AX — largest Dynamic Type.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "Facts scroll, decisions do not" — the actions are outside the scroll
 *   region, so however large the type is the sheet never covers its own
 *   decisions or the hairline above them.
 * · The cut is STATED. "2 more facts below" appears above the actions, and the
 *   2 is measured off the real viewport and the real layout — each fact reports
 *   its own offset, and a fact counts as below when its top has not reached the
 *   bottom of the visible region. Nothing is hard-coded, so the sentence is
 *   right on a device this frame was never captured on.
 * · The legal line stays in the scrolling region, where it is read at full size
 *   rather than shrunk to fit beside the buttons.
 *
 * `stressViewport` caps the scroll region so the arrangement is capturable
 * without depending on the simulator's Dynamic Type setting — the same
 * contract Group 2's `stacked` prop has. Set this route's device to the largest
 * type as well and the same composition appears for the same reason, with a
 * larger count.
 *
 * DETERMINISM: no clock, no random source, no network, no image, no spinner.
 * The cap is a literal, and the count is a function of it.
 */
export default function DevW3G4Cn01Ax() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-ink">
      <View className="flex-1 items-center justify-center">
        <Text variant="label" style={{ color: 'rgba(251,250,246,0.4)' }}>
          1 photo ready
        </Text>
      </View>
      <ConsentSheet
        visible
        busy={false}
        stressViewport={320}
        onAccept={() => {}}
        onDecline={() => {}}
      />
    </View>
  );
}
