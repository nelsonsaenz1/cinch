import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemStats } from '@/components/item/item-stats';
import { Text } from '@/components/ui/text';

/**
 * IT-02 — silhouette, unknown price, never worn.
 *
 * TWO UNKNOWNS ON ONE SCREEN, HANDLED THE SAME WAY TWICE, and this is the frame
 * that proves the refusal about dashes.
 *
 * · No price → the cost cell is GONE and the band redistributes. "There is no
 *   empty column, no dash and no '— a wear'." Before Wave 3 this band printed
 *   an em dash here.
 * · No wear → the first cell prints the WORD Never, because "a 0 in a display
 *   face would read as a verdict on the garment."
 * · The tray under the band states what adding a price would buy and what it
 *   would not, "so the omission is a choice the user can act on rather than a
 *   gap". Its second sentence is the refusal itself, said to the person it
 *   protects: Cinch does not guess what you paid.
 *
 * GARMENT IMAGERY: none. The licensed set holds no camel overcoat, and this
 * frame draws the silhouette treatment anyway.
 */
export default function DevW3G3It02() {
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
        <Text variant="colophon">Described in words</Text>
        <Text variant="title" trim className="mt-1.5">
          Camel overcoat
        </Text>
        <Text variant="note" className="mt-2">
          Outerwear · camel wool
        </Text>
      </View>
      <View className="pt-6">
        <ItemStats wears={0} costPerWear={null} sinceLast={null} />
      </View>
      <View className="mx-gutter mt-4 rounded-md bg-tray p-3.5">
        <Text variant="label" className="text-ink">
          Add a price to see cost per wear
        </Text>
        <Text variant="note" className="mt-1">
          Cinch does not guess what you paid. Nothing else about this piece depends on it.
        </Text>
      </View>
    </SafeAreaView>
  );
}
