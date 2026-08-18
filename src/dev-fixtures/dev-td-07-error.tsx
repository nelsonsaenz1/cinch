/**
 * Trip Detail fixture — one accepted frame, posed inert. Redesign 06.
 *
 * 07 · the plate didn’t load
 *
 * The pose comes from `features/trips/trip-detail-fixtures.ts`, where every
 * callback is a no-op, so this route cannot tick a piece, write a note, re-plan
 * or delete a thing however hard it is tapped. That seam is what lets the
 * accepted frames be walked and photographed against the artifact without a
 * session, a network or a single row in `trips`.
 *
 * Generated shape, one file per frame: adding a state to the atlas means adding
 * a pose and a file rather than editing a switch.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { TripDetailBodyView } from '@/components/trips/trip-detail-body';
import { Text } from '@/components/ui/text';
import { TRIP_DETAIL_POSES } from '@/features/trips/trip-detail-fixtures';

export default function DevTd07Error() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <TripDetailBodyView view={TRIP_DETAIL_POSES['07-error']} large={false} />
    </SafeAreaView>
  );
}
