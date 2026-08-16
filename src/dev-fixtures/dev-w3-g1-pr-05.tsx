/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: PR-05.
 *
 * A dropped card, and the way back. The confirmation is a TRAY BAND that stays
 * until the next decision, never a toast that vanishes on a timer — no
 * dismissal in this group is delayed and none is hidden. Undo in the masthead
 * is the same control that was already there; it goes Medium ink now that it is
 * live, so the header does not reflow.
 *
 * Deterministic by construction: the dropped state is produced by dispatching a
 * real `reject` through `processionReducer`, not by faking the band — so what
 * is photographed is the state the reducer actually produces.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentCard } from '@/components/intake/GarmentCard';
import { Text } from '@/components/ui/text';
import { DEV_DRAFTS } from '@/features/intake/dev-fixtures';
import { initProcession, processionReducer } from '@/features/intake/procession';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  // Open on the ambiguous card and drop it, which lands on the next card with
  // the band above it — exactly the transition the atlas draws.
  const dropped = processionReducer(initProcession([...DEV_DRAFTS], 3), { type: 'reject' });

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <GarmentCard
          procession={dropped}
          dispatch={() => {}}
          showUndo
          onCorrect={() => {}}
        />
      </SafeAreaView>
    </View>
  );
}
