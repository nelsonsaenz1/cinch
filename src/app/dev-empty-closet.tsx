import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExampleCloset } from '@/components/closet/example-closet';
import { Text } from '@/components/ui/text';

/**
 * C-05 — the empty closet, on its own.
 *
 * `dev-closet.tsx` is a pre-redesign mock of a POPULATED closet, so it could
 * not show this state, and the real screen only reaches it on an account with
 * zero items — which meant the one branch of this screen nobody could look at
 * was the first one every new user sees. That is how its primary action
 * shipped broken: a `Pressable` carrying both a `className` and a function
 * `style` rendered nothing at all, and typecheck, lint and 230 tests all
 * passed, because none of them run a layout pass.
 *
 * So the state gets a door. The eyebrow above the tile is the real screen's,
 * reproduced here because the component deliberately does not draw its own.
 */
export default function DevEmptyClosetScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <ScrollView contentContainerClassName="pb-10">
        <View className="px-gutter pt-2">
          <Text variant="eyebrow">Your closet</Text>
        </View>
        <View className="mt-3">
          <ExampleCloset onAddPieces={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
