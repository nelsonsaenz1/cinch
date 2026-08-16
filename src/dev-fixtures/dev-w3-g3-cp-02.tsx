import { Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraAsk } from '@/components/ingest/camera-ask';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/** The 55% ink scrim CP-01/CP-02 set every piece of stage chrome on. */
const CHROME_SCRIM = 'rgba(28,26,22,0.55)';

/**
 * CP-02 — the permission ask, before the system sheet.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "Pre-prompt names the next screen" — the card says the following prompt is
 *   the phone's, not Cinch's, and that it asks only for the camera.
 * · "Alternative door offered" — "The second action is a real alternative rather
 *   than a decline, so refusing does not end the intake."
 * · "Nothing is oxblood: this frame asks, it does not sell." The primary is ink.
 *
 * THE CARD IS THE SHIPPING COMPONENT. `CameraAsk` is what `capture.tsx` renders
 * when the camera has never been asked for, so this route cannot drift from the
 * words that ship — which matters more here than on most frames, because these
 * are sentences about a permission and where a photograph goes.
 *
 * WHAT IS POSED: the stage around the card. The real screen is a dark stage with
 * a Close pill on it, and there is nothing else on it in this state — no
 * viewfinder, because that is the state.
 *
 * DETERMINISM: no camera is mounted, no permission is read and nothing is
 * requested. Every string is the component's own; there is no clock, no random
 * source, no network and no autofocused field.
 */
export default function DevW3G3Cp02() {
  const theme = useTheme();

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ink">
      <StatusBar style="light" />
      <View className="flex-row items-center justify-start px-gutter pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ minHeight: 44, backgroundColor: CHROME_SCRIM }}
          className="items-center justify-center rounded-md px-3">
          <Text variant="body" style={{ fontSize: 16, color: theme.canvas }}>
            Close
          </Text>
        </Pressable>
      </View>

      <CameraAsk onAsk={() => {}} onLibrary={() => {}} />
    </SafeAreaView>
  );
}
