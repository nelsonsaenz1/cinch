/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: V-13b.
 *
 * Nothing audible in the take. The action says "Record again" and never "Try again": the same audio would fail the same way, and naming why is what stops a second attempt being made against the same file.
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
      failure={{ cause: 'silent' }}
      durationMs={null}
      onPhotograph={() => {}}
      onRetake={() => {}}
      onSignIn={() => {}}
      onLeaveForLater={() => {}}
    />
  );
}
