import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemStats } from '@/components/item/item-stats';
import { Text } from '@/components/ui/text';

/**
 * IT-01 — photographed, priced, worn. The three-cell ruled band.
 *
 * Audit 65 is what this route exists for: "three cells, ruled rather than
 * boxed, figures set in the display face and centred over their labels; the
 * cost cell is 1.35× the others so $14.19 and a four-figure equivalent both
 * centre without the rules moving."
 *
 * DETERMINISM: "Jul 2" is passed in as a literal rather than computed from
 * `lastWornAt` against the system clock — the real screen does that arithmetic,
 * and a fixture that did it too would produce different bytes every day.
 */
export default function DevW3G3It01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-6">
        <Text variant="title" trim>
          Shearling coat
        </Text>
        {/* Audit 64: category, material and purchase date as ONE prose
            sentence under the name, in the regular cut, so the attributes
            cannot outweigh what the garment is called. */}
        <Text variant="note" className="mt-2">
          Outerwear · cognac shearling · bought March 2024
        </Text>
      </View>
      <View className="pt-6">
        <ItemStats wears={31} costPerWear="$14.19" sinceLast="Jul 2" />
      </View>
    </SafeAreaView>
  );
}
