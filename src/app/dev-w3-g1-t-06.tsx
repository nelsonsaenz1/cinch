/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: T-06.
 *
 * The ten settled, under the stop sheet — this route draws the grid beneath it; the sheet itself is the T-06 sheet fixture. Every tile is filled.
 *
 * Deterministic by construction: the slot list is a literal built by
 * `ten-fixtures.ts`, the photographs are bundled assets, and no figure on the
 * page is read from a clock or a network.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { fixtureT06 } from '@/components/dev/ten-fixtures';
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

  const { slots, names, images } = fixtureT06();
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
