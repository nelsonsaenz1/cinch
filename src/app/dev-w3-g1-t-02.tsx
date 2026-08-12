/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: T-02.
 *
 * Four settled, six to go. Filled tiles carry the photograph at full bleed and drop their word; the foregrounded slot is marked by a white ground and a 1.5px ink ring, a second channel beyond colour.
 *
 * Deterministic by construction: the slot list is a literal built by
 * `ten-fixtures.ts`, the photographs are bundled assets, and no figure on the
 * page is read from a clock or a network.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { fixtureT02 } from '@/components/dev/ten-fixtures';
import { TenBody } from '@/components/onboarding/ten-body';
import { Text } from '@/components/ui/text';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const { slots, names, images } = fixtureT02();
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <TenBody
        slots={slots}
        garmentNames={names}
        imageUris={images}>
      </TenBody>
    </SafeAreaView>
  );
}
