/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: TR-05.
 *
 * The two doors, drawn as peers. Neither plate is filled and neither takes
 * oxblood, so the frame spends no accent at all — that is the state under
 * review, and it is what makes photography and voice read as equal ways in.
 *
 * Deterministic by construction: no clock, no random source, no network.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { FirstTenDoors } from '@/components/onboarding/first-ten-doors';
import { Text } from '@/components/ui/text';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <FirstTenDoors
        unfinished={null}
        onPhotograph={() => {}}
        onVoice={() => {}}
        onResume={() => {}}
        onStartAgain={() => {}}
      />
    </SafeAreaView>
  );
}
