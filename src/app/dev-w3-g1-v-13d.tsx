/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: V-13d.
 *
 * Offline — the one retryable branch, and so the only one whose action is "Try again". "Leave it for later" is what puts the unfinished-walkthrough card on TR-06; the two frames are the two ends of one promise.
 *
 * Deterministic by construction: the cause and every figure it prints are
 * literals, so the frame photographs identically every time.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { DEV_DURATION_MS } from '@/features/intake/dev-fixtures';
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
      failure={{ cause: 'offline', retry: () => {} }}
      durationMs={DEV_DURATION_MS}
      onPhotograph={() => {}}
      onRetake={() => {}}
      onSignIn={() => {}}
      onLeaveForLater={() => {}}
    />
  );
}
