/**
 * New Event fixture — one accepted frame, posed inert.
 *
 * The amber notice, and everything still on screen.
 *
 * The pose comes from `features/events/new-event-fixtures.ts`, where every
 * callback is a no-op, so this route cannot create an occasion, open a picker
 * or write a draft however hard it is tapped. That seam is what lets the six
 * frames be walked and photographed against the artifact without a session, a
 * network, or one writable row on the other end.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { NewEventBody } from '@/components/events/new-event-body';
import { Text } from '@/components/ui/text';
import { NEW_EVENT_POSES } from '@/features/events/new-event-fixtures';

export default function DevNe05Error() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <NewEventBody view={NEW_EVENT_POSES['05-error']} large={false} />
    </SafeAreaView>
  );
}
