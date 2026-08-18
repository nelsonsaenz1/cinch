/**
 * Trips list fixture — one accepted frame, posed inert. Redesign 04.
 *
 * 01 · Default — upcoming and past
 *
 * The pose comes from `features/trips/trips-list-fixtures.ts`, where every
 * callback is a no-op, so this route cannot plan a trip, open one or refetch a
 * thing however hard it is tapped. That seam is what lets the accepted frames
 * be walked and photographed against the artifact without a session, a network
 * or a single row in `trips`.
 *
 * Generated shape, one file per frame: adding a state to the atlas means adding
 * a pose and a file rather than editing a switch.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { TripsListBody } from '@/components/trips/trips-list-body';
import { Text } from '@/components/ui/text';
import { TRIPS_LIST_POSES } from '@/features/trips/trips-list-fixtures';

export default function DevTl01Default() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <TripsListBody view={TRIPS_LIST_POSES['01-default']} large={false} />
    </SafeAreaView>
  );
}
