/**
 * New Trip fixture — one accepted frame, posed inert. Redesign 05.
 *
 * 04 · Loading — the plate building
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

import { PackingPlateBody } from '@/components/plan/packing-plate-body';
import { Text } from '@/components/ui/text';
import { PACKING_PLATE_POSES } from '@/features/plan/new-trip-fixtures';

export default function DevNt04Loading() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <PackingPlateBody view={PACKING_PLATE_POSES['04-loading']} large={false} />
    </SafeAreaView>
  );
}
