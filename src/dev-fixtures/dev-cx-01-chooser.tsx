import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FirstTenDoors } from '@/components/onboarding/first-ten-doors';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';

/**
 * CX-01 / CX-02 — the first-10 chooser, in its initial state.
 *
 * ONE ROUTE, TWO FRAMES. CX-01 is this composition at 393×852 and CX-02 is the
 * same composition at 375×667; the difference is the simulator, not the
 * fixture, and building two routes that differ only in a comment would be two
 * things to keep in step. The screen reads `useWindowDimensions` and gives
 * back four points of eyebrow gap and six of row height below 700pt tall, so
 * the short cut is genuinely a different render — just not a different file.
 *
 * The AX pass is the same route again with the simulator's own text size
 * raised: nothing here caps a type size or truncates, so AX3+ reflows and the
 * page scrolls.
 *
 * INERT. `unfinished` is null — this is the branch a brand-new account sees —
 * and every callback is a no-op, so the fixture cannot open a camera, spend a
 * catalogue request or push a route out from under a screenshot. The real
 * screen's `ScreenHeader` is drawn above it because the back button is part of
 * what CX-01 adds and has to be visible in the capture.
 */
export default function DevCx01Chooser() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader align="leading" title="Today" backLabel="Today" />
      <View className="flex-1">
        <FirstTenDoors
          unfinished={null}
          onRoute={() => {}}
          onResume={() => {}}
          onStartAgain={() => {}}
        />
      </View>
    </SafeAreaView>
  );
}
