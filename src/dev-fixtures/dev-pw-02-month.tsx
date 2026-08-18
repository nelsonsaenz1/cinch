/**
 * Plan week fixture — the month grid, opened on the artifact's September.
 *
 * The sheet is drawn over the resting week rather than over a blank screen, so
 * the frame shows what the reader actually sees: the scrim, the lip of the
 * sheet, and the page it came from underneath.
 *
 * `PLAN_MONTH_POSE` carries no-op callbacks, so this route cannot jump, dismiss
 * or write anything however hard it is tapped — the month and the armed day are
 * the sheet's own local state and still move, which is the half worth checking.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanMonthSheet } from '@/components/plan/plan-month-sheet';
import { PlanWeekBody } from '@/components/plan/plan-week-body';
import { Text } from '@/components/ui/text';
import { PLAN_MONTH_POSE, PLAN_WEEK_POSES } from '@/features/plan/plan-week-fixtures';

export default function DevPw02Month() {
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
      <PlanMonthSheet view={PLAN_MONTH_POSE} />
    </SafeAreaView>
  );
}
