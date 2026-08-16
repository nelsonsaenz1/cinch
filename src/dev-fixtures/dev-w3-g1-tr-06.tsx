/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: TR-06.
 *
 * A walkthrough left unfinished, met on the way back in. One card, never a
 * list — there is only ever one — and the resume action is a COUNT ("Carry on
 * from 5 of 23"), never a bar. Resume is ink rather than oxblood: carrying on
 * is the obvious thing, not the persuaded thing.
 *
 * Deterministic by construction: the recorded weekday is the frozen
 * `FROZEN_WEEKDAY`, not a formatted `new Date()`, so this route photographs
 * identically on any day.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { FirstTenDoors } from '@/components/onboarding/first-ten-doors';
import { Text } from '@/components/ui/text';
import { FROZEN_WEEKDAY } from '@/features/intake/dev-fixtures';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <FirstTenDoors
        unfinished={{ heard: 23, confirmed: 4, cursor: 5, weekday: FROZEN_WEEKDAY }}
        onRoute={() => {}}
        onResume={() => {}}
        onStartAgain={() => {}}
      />
    </SafeAreaView>
  );
}
