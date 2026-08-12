/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: V-04.
 *
 * Reading it back. No percentage and no spinner — a duration estimate in prose instead — and the skeleton rows are the exact height and radius of the procession cards that replace them, so nothing shifts at the swap.
 *
 * Deterministic by construction: `slow` is a literal prop rather than a timer,
 * and the duration is the frozen `DEV_DURATION_MS`, so neither the notice nor
 * the headline depends on when the capture runs. The skeleton does not shimmer.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReadingBack } from '@/components/intake/ReadingBack';
import { Text } from '@/components/ui/text';
import { DEV_DURATION_MS } from '@/features/intake/dev-fixtures';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ReadingBack durationMs={DEV_DURATION_MS} slow={false} onLeaveRunning={() => {}} />
      </SafeAreaView>
    </View>
  );
}
