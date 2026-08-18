import { useLocalSearchParams } from 'expo-router';
import { Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { composedMeasure } from '@/features/onboarding/tour-fixtures';
import { TourFrameView } from '@/features/onboarding/tour-frames';
import { frameAt, indexOfFrame } from '@/features/onboarding/tour-state';
import { type TourFrameId } from '@/features/onboarding/tour-copy';

/**
 * DEV ONLY · TR-04 — the largest accessibility text size, forced.
 *
 * Deep-linkable: `cinch:///dev-tr-04-ax?frame=TR-03`.
 *
 * The composition change, forced rather than waited for. Above
 * `AX_STACK_SCALE` the shipping screen moves Skip out of the corner into a full
 * row above the action, drops the progress marks, and shrinks every plate; here
 * that is drawn unconditionally, because the iOS text slider cannot be set from
 * a deep link and a frame nobody can reach on demand is a frame nobody checks.
 *
 * Set the device slider to AX-XXXL as well to see the real thing: this fixture
 * pins the LAYOUT decision, and the type only grows for real when the system
 * says so.
 */
const FRAMES: readonly TourFrameId[] = ['TR-01', 'TR-02', 'TR-03'];

export default function DevTr04Ax() {
  const params = useLocalSearchParams<{ frame?: string }>();
  const id = (FRAMES as readonly string[]).includes(params.frame ?? '')
    ? (params.frame as TourFrameId)
    : 'TR-01';

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
        measure={composedMeasure('large')}
        onNext={() => {}}
        onSkip={() => {}}
        onCamera={() => {}}
        onLookAround={() => {}}
      />
    </View>
  );
}
