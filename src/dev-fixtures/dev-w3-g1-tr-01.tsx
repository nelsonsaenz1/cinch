/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: TR-01.
 *
 * The promise, on the hallway's one ink ground.
 *
 * Deterministic by construction: no clock, no random source, no network, no
 * spinner and no autofocused field. Every figure is a literal or is computed
 * from one, so two captures of this route produce the same bytes.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { TourFrameView } from '@/features/onboarding/tour-frames';
import { frameAt } from '@/features/onboarding/tour-state';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <TourFrameView
      frame={frameAt(0)}
      index={0}
      onNext={() => {}}
      onSkip={() => {}}
      onCamera={() => {}}
      onLookAround={() => {}}
    />
  );
}
