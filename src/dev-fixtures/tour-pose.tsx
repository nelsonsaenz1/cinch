import { useLocalSearchParams } from 'expo-router';
import { Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  TOUR_COMPOSITIONS,
  composedMeasure,
  type TourComposition,
} from '@/features/onboarding/tour-fixtures';
import { type TourFrameId } from '@/features/onboarding/tour-copy';
import { TourFrameView } from '@/features/onboarding/tour-frames';
import { frameAt, indexOfFrame } from '@/features/onboarding/tour-state';

/**
 * DEV ONLY — the one frame the redesign-20 fixtures each pose.
 *
 * Deliberately NOT named `dev-*`: everything matching that pattern in this
 * directory is a route, and `tests/dev-route-index.test.ts` requires every one
 * of them to appear in the fixture index. This is a component the routes
 * import, not a frame anybody opens. It is still reached through the `@/`
 * alias, so a fixture copied alone into `src/app/` for a simulator pass keeps
 * working.
 *
 * Every handler is a no-op on purpose. The real screen's exits mark the account
 * toured and replace the route; a fixture that did either would be a frame you
 * can look at exactly once, and it would write a server column from a dev tool.
 */
export function TourPose({ id }: { id: TourFrameId }) {
  const params = useLocalSearchParams<{ composition?: string }>();
  const composition: TourComposition = (TOUR_COMPOSITIONS as readonly string[]).includes(
    params.composition ?? '',
  )
    ? (params.composition as TourComposition)
    : 'standard';

  if (!__DEV__) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <RNText>Not available.</RNText>
      </SafeAreaView>
    );
  }

  const index = indexOfFrame(id);

  return (
    <View style={{ flex: 1 }}>
      <TourFrameView
        frame={frameAt(index)}
        index={index}
        measure={composedMeasure(composition)}
        onNext={() => {}}
        onSkip={() => {}}
        onCamera={() => {}}
        onLookAround={() => {}}
      />
    </View>
  );
}
