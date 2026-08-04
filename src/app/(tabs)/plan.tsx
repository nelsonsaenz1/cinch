import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';

/** Week planner + packing assistant — Phase 3. */
export default function PlanScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="px-gutter pb-2 pt-2">
        <Text variant="display">Plan</Text>
      </View>

      <EmptyState
        symbol="calendar"
        title="Plan the week ahead"
        body="Lay out outfits for the days coming up, or build a packing list for a trip from what you already own."
      />
    </SafeAreaView>
  );
}
