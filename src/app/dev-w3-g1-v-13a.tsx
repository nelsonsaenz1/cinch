/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: V-13a.
 *
 * The microphone denied. "Nothing was recorded" is the second sentence because a denied prompt after a Start tap otherwise reads as a lost take, and both named exits end in the same closet.
 *
 * Deterministic by construction: the cause and every figure it prints are
 * literals, so the frame photographs identically every time.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { FailureScreen } from '@/components/intake/FailureScreen';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <FailureScreen
      failure={{ cause: 'denied' }}
      durationMs={null}
      onPhotograph={() => {}}
      onRetake={() => {}}
      onSignIn={() => {}}
      onLeaveForLater={() => {}}
    />
  );
}
