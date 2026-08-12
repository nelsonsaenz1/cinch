import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyCloset } from '@/components/closet/empty-closet';
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
 * The tile it used to draw was `ExampleCloset`, an illustrated example grid.
 * C-05 refuses that outright — see the docblock on `EmptyCloset` — so this
 * route now shows what the frame actually draws. The eyebrow and the count line
 * above it are the real screen's, reproduced here because the component
 * deliberately does not draw its own.
 *
 * Superseded by `dev-w3-g3-c-05`, which is the canonical capture route; this
 * one is kept because it is the door the older fixture index already links to.
 */
export default function DevEmptyClosetScreen() {
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
        <Text variant="eyebrow">Your closet</Text>
        <Text variant="note" className="mt-1">
          0 pieces
        </Text>
      </View>
      <EmptyCloset onAddClothes={() => {}} />
    </SafeAreaView>
  );
}
