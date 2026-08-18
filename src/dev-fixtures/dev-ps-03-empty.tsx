/**
 * People Search fixture — one accepted frame, posed inert.
 *
 * The pose comes from `features/social-graph/people-search-fixtures.ts`,
 * where every callback is a no-op, so this route cannot send a friend
 * request, open a profile or write a recent-search entry however hard it is
 * tapped. That seam is what lets the six frames be walked and photographed
 * against the artifact without a session or a network.
 *
 * Generated shape, one file per frame: adding a state to the atlas means
 * adding a pose and a file rather than editing a switch.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { PeopleSearchBody } from '@/components/social/people-search-body';
import { Text } from '@/components/ui/text';
import { PEOPLE_SEARCH_POSES } from '@/features/social-graph/people-search-fixtures';

export default function DevPs03Empty() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <PeopleSearchBody view={PEOPLE_SEARCH_POSES['03-empty']} large={false} />
    </SafeAreaView>
  );
}
