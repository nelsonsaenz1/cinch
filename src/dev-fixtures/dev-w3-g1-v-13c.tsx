/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: V-13c.
 *
 * Heard, but nothing recognisable. Showing the transcript is the whole design — it turns "it did not work" into "here is what it heard, and now you can see why". The transcript never leaves this screen: not to analytics, not to the closet.
 *
 * Deterministic by construction: the cause and every figure it prints are
 * literals, so the frame photographs identically every time.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { DEV_UNPARSED_TRANSCRIPT } from '@/features/intake/dev-fixtures';
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
      failure={{ cause: 'unparsed', transcript: DEV_UNPARSED_TRANSCRIPT }}
      durationMs={null}
      onPhotograph={() => {}}
      onRetake={() => {}}
      onSignIn={() => {}}
      onLeaveForLater={() => {}}
    />
  );
}
