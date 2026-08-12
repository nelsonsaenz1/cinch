/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: T-04.
 *
 * The dress declined. A decline REDIRECTS the position, never drops it, and
 * every row carries the count the finished closet would make — computed by
 * `countOutfits(plannedTally(…))`, never a table. The recommended row carries a
 * ring AND the word, so the recommendation is never colour alone, and the
 * sentence beneath says in the open why the recommended option shows the
 * smaller figure.
 *
 * Deterministic by construction: the slot list is a literal and every total on
 * the sheet is derived from it.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fixtureT04 } from '@/components/dev/ten-fixtures';
import { SubstitutionSheetBody } from '@/components/onboarding/substitution-sheet';
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

  const { slots, names, images } = fixtureT04();
  // Slot 6 is the dress on the canonical ten.
  const slot = slots.find((s) => s.id === 6)!;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The grid recedes behind the sheet, exactly as the real modal leaves
          it — dimmed, not replaced, so the position being spent stays in
          view. */}
      <View className="flex-1" style={{ opacity: 0.35 }} pointerEvents="none">
        <TenBody slots={slots} garmentNames={names} imageUris={images} />
      </View>
      <View>
        <SubstitutionSheetBody
          slot={slot}
          slots={slots}
          onRedirect={() => {}}
          onKeepOpen={() => {}}
          onKeepSlot={() => {}}
        />
      </View>
    </SafeAreaView>
  );
}
