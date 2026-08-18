/**
 * Plan week fixture — the plate building — the strip above it stays live and swipeable.
 *
 * The pose comes from `features/plan/plan-week-fixtures.ts`, where every
 * callback is a no-op, so this route cannot plan a day, log a wear or write a
 * calendar row however hard it is tapped.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanWeekBody } from '@/components/plan/plan-week-body';
import { Text } from '@/components/ui/text';
import { PLAN_WEEK_POSES } from '@/features/plan/plan-week-fixtures';

export default function DevPw04Loading() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <PlanWeekBody view={PLAN_WEEK_POSES['04-loading']} large={false} />
    </SafeAreaView>
  );
}
