/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: PR-03.
 *
 * The ambiguous quantity. The primary action CARRIES THE CHOSEN NUMBER —
 * "Keep three" — so the decision is readable without looking back up at the
 * stepper. The range is clamped 1–12 exactly as the reducer clamps it, and the
 * minus cell at the floor is disabled with its reason on hold rather than
 * silently inert.
 *
 * Deterministic by construction: the stepper seeds from the draft's own literal
 * quantity, so it opens on the same figure every time.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountStepper } from '@/components/intake/CountStepper';
import { Text } from '@/components/ui/text';
import { DEV_DRAFTS } from '@/features/intake/dev-fixtures';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const draft = DEV_DRAFTS.find((d) => d.state === 'ambiguous')!;

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <CountStepper
          draft={draft}
          index={4}
          total={DEV_DRAFTS.length}
          canUndo={false}
          onBack={() => {}}
          onUndo={() => {}}
          onDrop={() => {}}
          onConfirm={() => {}}
        />
      </SafeAreaView>
    </View>
  );
}
