/**
 * Event Detail fixture — one accepted frame, posed inert. Redesign 03.
 *
 * 04 · Error — the reply did not send.
 *
 * The pose comes from `features/events/event-detail-fixtures.ts`, where every
 * callback is a no-op, so this route cannot answer an invitation, cancel an
 * occasion or remove a guest however hard it is tapped. That seam is what lets
 * the accepted frames be walked and photographed against the artifact without
 * a session, a network or a row on the other end.
 *
 * Generated shape, one file per frame: adding a state to the atlas means adding
 * a pose and a file rather than editing a switch.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { EventDetailBody } from '@/components/events/event-detail-body';
import { Text } from '@/components/ui/text';
import { EVENT_DETAIL_POSES } from '@/features/events/event-detail-fixtures';

export default function DevEd04Error() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <EventDetailBody view={EVENT_DETAIL_POSES['04-error']} large={false} />
    </SafeAreaView>
  );
}
