import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FIXTURE_OUTFIT } from '@/components/dev/fixtures';
import { Plate } from '@/components/today/plate';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY — a signed-out preview of the signature component at
 * cinch://dev-plate. Fixtures live in src/components/dev/fixtures.ts.
 * It ships nothing: outside __DEV__ it renders a refusal.
 */
export default function DevPlateScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <ScrollView contentContainerClassName="pt-6">
        <Plate
          outfit={FIXTURE_OUTFIT}
          index={0}
          occasion="dinner at 7"
          colophon={{ city: 'Brooklyn', feelsLikeC: 17 }}
          resolveImage={() => undefined}
          onWear={() => {}}
          onReact={() => {}}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
