import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';

/** Stylist chat — built in Phase 2 (OUT-21). */
export default function StylistScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="px-gutter pb-2 pt-2">
        <Text variant="display">Stylist</Text>
      </View>

      <EmptyState
        symbol="bubble.left.and.bubble.right"
        title="Ask for anything"
        body="Dinner at 7 and drinks after? A trip to pack for? Once your closet is in, ask here and Cinch answers using only clothes you actually own."
      />
    </SafeAreaView>
  );
}
