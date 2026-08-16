import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyCloset } from '@/components/closet/empty-closet';
import { ExampleCloset } from '@/components/closet/example-closet';
import { Text } from '@/components/ui/text';
import { PLANS } from '@/features/billing/plans';

/**
 * CX-03 — the closet at zero, with the example restored.
 *
 * The real screen only reaches this branch on an account with no items, which
 * is how its primary action once shipped rendering nothing at all: typecheck,
 * lint and the whole suite passed, because none of them run a layout pass.
 *
 * What this frame is evidence for:
 *
 * · the count reads "0 of 10 pieces" rather than a bare nought — the same
 *   grammar `CapacityColophon` prints from the first piece onward;
 * · the photographic example is back, above the invitation, carrying its
 *   EXAMPLE badge and the sentence that names it as fiction;
 * · the invitation's title, body and action are CX-03's exact words, and the
 *   approved positioning line survives underneath them.
 *
 * DETERMINISM: four bundled photographs, no clock, no network, no closet read.
 * The eyebrow and count above the example are the real screen's, reproduced
 * here because the components deliberately do not draw their own.
 */
export default function DevCx03ClosetEmpty() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 }}>
        <View className="px-gutter pt-2">
          <Text variant="eyebrow">Your closet</Text>
          <Text variant="note" className="mt-1">
            {`0 of ${PLANS.free.items} pieces`}
          </Text>
        </View>
        <View className="mt-5">
          <ExampleCloset variant="full" />
        </View>
        <EmptyCloset onAddClothes={() => {}} />
      </ScrollView>
    </SafeAreaView>
  );
}
