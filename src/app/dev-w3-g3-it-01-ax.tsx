import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemStats } from '@/components/item/item-stats';
import { Text } from '@/components/ui/text';

/**
 * IT-01 / AX — largest Dynamic Type, the band stacks.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "Band becomes ruled rows" — "Three centred cells cannot hold three 19 pt
 *   labels side by side, so the band changes composition: label left, figure
 *   right, one ruled row each, still in the display face."
 * · "Nothing is clipped" — the rows carry no `numberOfLines` and no
 *   `adjustsFontSizeToFit`, which the three-cell composition needs and this one
 *   does not: a full-width row has the space, so shrinking a figure here would
 *   be shrinking type the frame said to grow.
 * · The SAME cells. A figure with nothing behind it removes its row exactly as
 *   it removes its column, so the two compositions can never disagree about
 *   what is known.
 * · The attribute sentence "wraps to two lines instead of truncating."
 *
 * DETERMINISM: `stacked` is passed as a literal rather than read off
 * `fontScale`, so the route draws the AX composition on a device at any type
 * size — the shipping page reads the real setting at the shared threshold in
 * `features/closet/dynamic-type.ts`. "Jul 2" is a literal for the same reason it
 * is one in `dev-w3-g3-it-01`: the real screen computes it against the clock.
 */
export default function DevW3G3It01Ax() {
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
        {/* 36px — the frame's own hero size at this type setting. */}
        <Text variant="display" style={{ fontSize: 36, lineHeight: 39 }}>
          Shearling coat
        </Text>
        {/* The attribute sentence, allowed two lines rather than truncated. */}
        <Text variant="note" className="mt-2" style={{ fontSize: 18, lineHeight: 26 }}>
          Outerwear · cognac shearling
        </Text>
        <Text variant="note" style={{ fontSize: 18, lineHeight: 26 }}>
          Bought March 2024
        </Text>
      </View>
      <View className="pt-5">
        <ItemStats wears={31} costPerWear="$14.19" sinceLast="Jul 2" stacked />
      </View>
    </SafeAreaView>
  );
}
