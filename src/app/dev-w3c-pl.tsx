import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExampleEvents, ExampleTrip, ExampleWeek } from '@/components/plan/plan-examples';
import { Text } from '@/components/ui/text';

/**
 * PL-C1 / PL-C2 / PL-C3 — the three Plan examples, on one route.
 *
 * The three together are the thing to look at: they have to read as one family
 * of cards rather than three designers' takes on "example". Same badge, same
 * caption grammar, same tray, same photographs.
 *
 * The week is given a FIXED start so the capture is byte-stable — in the app it
 * follows the selected week, which is the one dynamic value any example in this
 * app carries.
 */
const MONDAY = new Date('2026-08-10T00:00:00');

export default function DevW3cPl() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-16">
        <Text variant="eyebrow" className="px-gutter pt-4">
          PL-C1 · Week
        </Text>
        <ExampleWeek weekStart={MONDAY} />

        <View className="border-t border-rule">
          <Text variant="eyebrow" className="px-gutter pt-4">
            PL-C2 · Events
          </Text>
          <ExampleEvents />
        </View>

        <View className="border-t border-rule px-gutter pt-4">
          <Text variant="eyebrow">PL-C3 · Travel, above the gate</Text>
          <View className="mt-2">
            <ExampleTrip />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
