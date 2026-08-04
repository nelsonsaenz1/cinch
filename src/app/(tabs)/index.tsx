import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';

/**
 * Today — the home tab and the app's activation moment.
 *
 * Phase 2 fills this with the weather strip, today's events, and three outfit
 * collage cards. Until then it ships a designed empty state rather than a
 * placeholder, because this screen must never look broken: it is the first
 * thing a new user sees.
 */
export default function TodayScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="px-gutter pb-2 pt-2">
        <Text variant="display">Today</Text>
      </View>

      <EmptyState
        symbol="sparkles"
        title="Your first outfit is close"
        body="Add about ten pieces and Cinch can start styling you — weather, plans, and everything already in your closet."
        actionTitle="Add clothes"
        onAction={() => router.push('/capture')}
      />
    </SafeAreaView>
  );
}
