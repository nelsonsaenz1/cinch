/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: PR-01.
 *
 * A confident card. The spoken phrase stays on the card and sits ABOVE the
 * name, so a correction is judged against what was actually said rather than
 * against the guess alone. Drop is a peer, not a destructive red action — it
 * marks the row rejected and Undo brings it back — and "Change something"
 * confirms, because correcting a card IS the confirmation.
 *
 * Undo is drawn quiet here: nothing has been decided yet, so the control is
 * present but not live. It changes WEIGHT rather than appearing, so the header
 * never reflows.
 *
 * Deterministic by construction: a literal draft list and a literal cursor.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentCard } from '@/components/intake/GarmentCard';
import { Text } from '@/components/ui/text';
import { DEV_DRAFTS } from '@/features/intake/dev-fixtures';
import { initProcession } from '@/features/intake/procession';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  // The first card of twenty-three — the atlas draws this card's content
  // (the white linen shirt and its phrase); the position figure is whatever
  // the reducer says it is, never typed.
  const state = initProcession([...DEV_DRAFTS], 0);

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <GarmentCard
          procession={state}
          dispatch={() => {}}
          showUndo={false}
          onCorrect={() => {}}
        />
      </SafeAreaView>
    </View>
  );
}
