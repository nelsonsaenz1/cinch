/**
 * Friends fixture — one accepted frame, posed inert. Redesign 08.
 *
 * 01 · Default — requests band, presence cards, invite footer
 *
 * The pose comes from `features/social/friends-08-fixtures.ts`, where every
 * callback is a no-op and no presence fact carries an image path — so this
 * route cannot accept a request, block anybody or reach the network however
 * hard it is tapped. That seam is what lets the accepted frames be walked and
 * photographed against the artifact without a session.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendsPage } from '@/components/social/friends-page';
import { Text } from '@/components/ui/text';
import { FRIENDS_08_POSES } from '@/features/social/friends-08-fixtures';

export default function DevFl01Default() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return <FriendsPage {...FRIENDS_08_POSES['01-default']} />;
}
