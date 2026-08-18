/**
 * New Trip fixture — one accepted frame, posed inert. Redesign 05.
 *
 * 07 · Largest accessibility text — step 3 recomposed
 *
 * The pose comes from `features/plan/new-trip-fixtures.ts`, where every
 * callback is a no-op, so this route cannot search a place, answer a question
 * or write a trip however hard it is tapped. That seam is what lets the
 * accepted frames be walked and photographed against the artifact without a
 * session, a network or a single row in `trips`.
 *
 * Generated shape, one file per frame: adding a state to the atlas means adding
 * a pose and a file rather than editing a switch.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { NewTripBody } from '@/components/plan/new-trip-body';
import { Text } from '@/components/ui/text';
import { NEW_TRIP_POSES } from '@/features/plan/new-trip-fixtures';
import { progressDots } from '@/features/plan/new-trip-spec';

export default function DevNt07Ax() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <NewTripBody
        view={NEW_TRIP_POSES['03-default']}
        dots={progressDots(NEW_TRIP_POSES['03-default'].index, NEW_TRIP_POSES['03-default'].total)}
        large={true}
      />
    </SafeAreaView>
  );
}
