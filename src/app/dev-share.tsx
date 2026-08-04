import { useLocalSearchParams } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FIXTURE_OUTFIT } from '@/components/dev/fixtures';
import { PlateCard } from '@/components/share/plate-card';
import { Text } from '@/components/ui/text';
import { sharePlate } from '@/features/share/capture-plate';

/**
 * DEV ONLY — the 360×640 share card rendered on-screen at cinch://dev-share,
 * so the artifact can be reviewed and screenshotted without opening the share
 * sheet. What appears here is exactly what view-shot captures.
 *
 * cinch://dev-share?share=1 additionally runs the real capture pipeline on
 * mount — captureRef → system share sheet — and logs the captured file's URI,
 * so the true 1080×1920 artifact can be pulled from the simulator container
 * and inspected pixel-for-pixel. No finger required, which matters when the
 * only hands available are a CLI's.
 */
export default function DevShareScreen() {
  const { share } = useLocalSearchParams<{ share?: string }>();
  const cardRef = useRef<View>(null);

  const handleReady = useCallback(() => {
    void sharePlate(cardRef)
      .then((uri) => console.log(`[dev-share] captured ${uri}`))
      .catch((err) => console.log(`[dev-share] capture failed: ${String(err)}`));
  }, []);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <ScrollView contentContainerClassName="items-center py-6">
        {/* Border outside the ref so the review chrome never enters the capture. */}
        <View className="border border-rule dark:border-rule-dark">
          <View ref={cardRef} collapsable={false}>
            <PlateCard
              outfit={FIXTURE_OUTFIT}
              occasion="dinner at 7"
              colophon={{ city: 'Brooklyn', feelsLikeC: 17 }}
              resolveImage={() => undefined}
              onReady={share === '1' ? handleReady : undefined}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
