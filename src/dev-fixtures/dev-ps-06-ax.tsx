/**
 * People Search fixture — the largest accessibility text size.
 *
 * Unlike its five siblings this one does NOT hardcode `large`. It reads
 * `useWindowDimensions().fontScale` exactly as `app/people-search.tsx` does,
 * so photographing it with the simulator set to AX-XXXL exercises the real
 * derivation rather than a boolean somebody typed. Captured at a standard
 * size it is simply the resting page, which is the correct answer too.
 *
 * The pose comes from `features/social-graph/people-search-fixtures.ts`,
 * where every callback is a no-op, so this route cannot send a friend
 * request, open a profile or write a recent-search entry however hard it is
 * tapped.
 */

import { useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeopleSearchBody } from '@/components/social/people-search-body';
import { Text } from '@/components/ui/text';
import { PEOPLE_SEARCH_POSES } from '@/features/social-graph/people-search-fixtures';
import { PEOPLE_SEARCH_STACK_SCALE } from '@/features/social-graph/people-search-spec';

export default function DevPs06Ax() {
  const { fontScale } = useWindowDimensions();

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <PeopleSearchBody
        view={PEOPLE_SEARCH_POSES['06-ax']}
        large={fontScale >= PEOPLE_SEARCH_STACK_SCALE}
      />
    </SafeAreaView>
  );
}
