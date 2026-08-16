import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyCloset } from '@/components/closet/empty-closet';
import { Text } from '@/components/ui/text';

/**
 * C-05 — the empty closet, nothing filed yet.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · AUDIT 100 — "the approved positioning line appears verbatim and no absolute
 *   about shopping is stated anywhere on the frame." The line is a constant
 *   (`POSITIONING_LINE`) rather than a sentence typed twice, so this route and
 *   the shipping screen cannot drift apart.
 * · "Zero is quiet" — the count is stated ONCE, in the same 13pt line that would
 *   carry 148, and nowhere else.
 * · NEVER ILLUSTRATED. There is no example grid, no empty hangers, no dashed
 *   placeholder tiles and no exclamation. `ExampleCloset`, which drew all of
 *   that, is retired; this is what replaced it.
 * · The filter row is ABSENT rather than present-and-disabled.
 * · One oxblood on the frame, on the one action.
 *
 * DETERMINISM: two literal strings and a constant. No clock, no random source,
 * no network, no animation and no autofocused field.
 */
export default function DevW3G3C05() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-2">
        <Text variant="eyebrow" accessibilityRole="header">
          Your closet
        </Text>
        <Text variant="note" className="mt-1">
          0 pieces
        </Text>
      </View>
      <EmptyCloset onAddClothes={() => {}} />
    </SafeAreaView>
  );
}
