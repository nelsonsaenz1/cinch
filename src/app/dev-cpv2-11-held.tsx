/**
 * CPV2-11, the day after — the held selection offered back.
 *
 * §10.5 left the hold open as a SERVER question; it is answered client-side
 * (`features/catalogue/held-selection.ts`) because nothing in the frame is
 * cross-device: the user is refused, goes to Membership or archives a piece,
 * and comes back, all on the phone in their hand.
 *
 * Inert — the pose carries the offer directly, so this route never reads
 * AsyncStorage and never restores anything.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogueBody } from '@/components/catalogue/catalogue-body';
import { Text } from '@/components/ui/text';
import { CPV2_POSES } from '@/features/catalogue/dev-fixtures';

export default function DevCpv2HeldScreen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <View className="px-gutter pb-3 pt-2">
        <Text variant="eyebrow">CPV2-11 · selection still held</Text>
      </View>
      <View className="flex-1">
        <CatalogueBody view={CPV2_POSES['11-held']} />
      </View>
    </SafeAreaView>
  );
}
