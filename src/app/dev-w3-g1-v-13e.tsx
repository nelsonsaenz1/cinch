/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: V-13e.
 *
 * Signed out mid-flow. A fifth named cause, found in a simulator walk rather than in the directive: with no session the Start tap used to return silently after the permission prompt.
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
      failure={{ cause: 'signed_out' }}
      durationMs={null}
      onPhotograph={() => {}}
      onRetake={() => {}}
      onSignIn={() => {}}
      onLeaveForLater={() => {}}
    />
  );
}
