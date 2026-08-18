import { Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { composedMeasure } from '@/features/onboarding/tour-fixtures';
import { TourFrameView } from '@/features/onboarding/tour-frames';
import { frameAt, indexOfFrame } from '@/features/onboarding/tour-state';

/**
 * DEV ONLY · TR-05 — the short device, forced.
 *
 * The 667pt SE class, drawn on whatever screen is to hand. TR-03 is the frame
 * that proves it: it is the only one carrying two actions, so it is the one
 * where the miniature, the headline and both choices have to fit above the home
 * area or nothing does.
 *
 * The plate goes compact and the type steps down one size — and only because
 * the SCREEN is short. That step never fires from the text setting: shrinking
 * type in response to somebody asking for larger type is the one move the
 * accessibility note forbids outright.
 */
export default function DevTr05Short() {
  if (!__DEV__) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <RNText>Not available.</RNText>
      </SafeAreaView>
    );
  }

  const index = indexOfFrame('TR-03');

  return (
    <View style={{ flex: 1 }}>
      <TourFrameView
        frame={frameAt(index)}
        index={index}
        measure={composedMeasure('short')}
        onNext={() => {}}
        onSkip={() => {}}
        onCamera={() => {}}
        onLookAround={() => {}}
      />
    </View>
  );
}
