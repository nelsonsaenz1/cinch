/**
 * New Event fixture — the largest accessibility text size.
 *
 * Unlike its five siblings this one does NOT hardcode `large`. It reads
 * `useWindowDimensions().fontScale` exactly as `app/event/new.tsx` does, so
 * photographing it with the simulator set to AX-XXXL exercises the real
 * derivation rather than a boolean somebody typed. Captured at a standard size
 * it is simply the answered sheet, which is the correct answer too.
 *
 * This is the descender check the brief names: "Alexandria's birthday" carries
 * g, y and p, and no row on this page has a fixed height for them to be cut by.
 *
 * The pose comes from `features/events/new-event-fixtures.ts`, where every
 * callback is a no-op, so this route cannot create an occasion, open a picker
 * or write a draft however hard it is tapped.
 */

import { useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NewEventBody } from '@/components/events/new-event-body';
import { Text } from '@/components/ui/text';
import { NEW_EVENT_POSES } from '@/features/events/new-event-fixtures';
import { newEventStacked } from '@/features/events/new-event-spec';

export default function DevNe06Ax() {
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
      <NewEventBody view={NEW_EVENT_POSES['06-ax']} large={newEventStacked(fontScale)} />
    </SafeAreaView>
  );
}
