import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockedList } from '@/components/social/BlockedList';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';

/**
 * Blocked — its own room now, off the Friends page.
 *
 * The list used to sit at the foot of Friends, on the argument that the
 * unhappy path shouldn't get its own room in the house. The rebuilt Friends
 * page evicts it entirely, which is the stronger version of the same
 * argument: a page about your circle should not end on the people you removed
 * from it. Guideline 1.2 still requires blocks to be manageable somewhere
 * findable, so Profile's "Blocked people" row now lands here directly instead
 * of deep-linking to a section that no longer exists.
 *
 * The screen is a frame; `BlockedList` owns the states (loading, failed,
 * empty, rows) and their claims discipline. The one line this page adds is
 * the promise the row-level UI has no room for — what a block actually does —
 * because on its own route the list no longer inherits context from the
 * sections above it.
 */
export default function BlockedScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Your circle" />

      <View className="px-gutter pt-3">
        <Text variant="display" trim accessibilityRole="header">
          Blocked
        </Text>
        <Text variant="caption" className="mt-2 text-muted">
          Blocked people can’t find you, message you, or see your closet — and they aren’t told.
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-24 pt-6">
        <Card>
          <BlockedList />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
