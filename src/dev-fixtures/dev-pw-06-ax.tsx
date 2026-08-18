/**
 * Plan week fixture — the largest accessibility text size.
 *
 * Unlike its siblings this one does NOT hardcode `large`. It reads
 * `useWindowDimensions().fontScale` exactly as `app/(tabs)/plan.tsx` does, so
 * photographing it with the simulator set to AX-XXXL exercises the real
 * derivation rather than a boolean somebody typed. Captured at a standard size
 * it is simply the resting page, which is the correct answer too.
 *
 * The pose comes from `features/plan/plan-week-fixtures.ts`, where every
 * callback is a no-op.
 */

import { useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanWeekBody } from '@/components/plan/plan-week-body';
import { Text } from '@/components/ui/text';
import { PLAN_WEEK_POSES } from '@/features/plan/plan-week-fixtures';
import { PLAN_WEEK_STACK_SCALE } from '@/features/plan/plan-week-spec';

export default function DevPw06Ax() {
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
      <PlanWeekBody
        view={PLAN_WEEK_POSES['06-ax']}
        large={fontScale >= PLAN_WEEK_STACK_SCALE}
      />
    </SafeAreaView>
  );
}
