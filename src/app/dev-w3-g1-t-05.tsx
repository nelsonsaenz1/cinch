/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: T-05.
 *
 * The camera switched off, drawn as a FORK rather than a wall: the loudest
 * action is the one that needs no permission at all. The count stays in the
 * masthead so the work already done is visible from the failure, and the
 * closing sentence names what is kept.
 *
 * Deterministic by construction: two filled slots, both literals, so the kept
 * sentence reads the same on every capture.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fixtureT02 } from '@/components/dev/ten-fixtures';
import { CameraDenied } from '@/components/onboarding/camera-denied';
import { TenBody } from '@/components/onboarding/ten-body';
import { Text } from '@/components/ui/text';
import { canonicalTen, fillSlot } from '@/features/onboarding/ten-slots';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const stocked = fixtureT02();
  // Two photographed, which is the count the atlas's own frame carries.
  let slots = canonicalTen();
  slots = fillSlot(slots, 1, 'sample-blouse');
  slots = fillSlot(slots, 2, 'sample-sweater');

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <TenBody slots={slots} garmentNames={stocked.names} imageUris={stocked.images}>
        <View style={{ marginTop: 24 }}>
          <CameraDenied filled={2} onLibrary={() => {}} onSettings={() => {}} onVoice={() => {}} />
        </View>
      </TenBody>
    </SafeAreaView>
  );
}
