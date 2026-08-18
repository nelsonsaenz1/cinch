import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoGroupsState } from '@/components/circles';
import { Text } from '@/components/ui/text';
import { GROUPS_TITLE } from '@/features/circles/copy';

/**
 * GR-03 · redesign 27 — no groups yet, which is the only real emptiness here.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · It is `EmptyState`, unchanged, so it inherits that component's claims
 *   discipline: an empty state describes the DATA and only renders once you
 *   know there is none. `resolveCircleState` puts `loading` and `offline` ahead
 *   of `no_groups` for exactly that reason — this composition carries a Create
 *   button, and drawn over a pending read it invites somebody to make a second
 *   copy of the group they already have.
 * · The action is pinned to the foot with the discoverability promise attached
 *   to it, which is PC-01's own composition: the two sentences that describe
 *   the thing are read together in the middle, and the commitment sits under
 *   the thumb.
 * · One oxblood, and it is this. The screen has nothing else on it to compete.
 *
 * Compare with GR-05, which is the state this one is most often confused with:
 * a group with one member is not empty, and drawing it here would tell somebody
 * who just succeeded that they have nothing.
 */
export default function DevGr03() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-3">
        <Text variant="display" trim accessibilityRole="header">
          {GROUPS_TITLE}
        </Text>
      </View>
      <NoGroupsState onCreate={() => undefined} />
    </SafeAreaView>
  );
}
