/**
 * Plan week fixture — one accepted frame, posed inert.
 *
 * The pose comes from `features/plan/plan-week-fixtures.ts`, where every
 * callback is a no-op, so this route cannot plan a day, log a wear or write a
 * calendar row however hard it is tapped. That seam is what lets the six frames
 * be walked and photographed against the artifact without a session, a network
 * or a forecast.
 *
 * Generated shape, one file per frame: adding a state to the atlas means adding
 * a pose and a file rather than editing a switch.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanWeekBody } from '@/components/plan/plan-week-body';
import { Text } from '@/components/ui/text';
import { PLAN_WEEK_POSES } from '@/features/plan/plan-week-fixtures';

export default function DevPw01Default() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <PlanWeekBody view={PLAN_WEEK_POSES['01-default']} large={false} />
    </SafeAreaView>
  );
}
