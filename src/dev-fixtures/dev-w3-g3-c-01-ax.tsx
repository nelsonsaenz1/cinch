import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { C01_PIECES } from '@/components/closet/w3-g3-fixture-data';
import { Text } from '@/components/ui/text';

const resolve = (...paths: (string | null | undefined)[]) =>
  paths.find((p): p is string => typeof p === 'string' && p.length > 0);

/**
 * C-01 / AX — the same closet at the largest Dynamic Type.
 *
 * CAPTURE THIS ROUTE WITH THE SIMULATOR AT ITS LARGEST ACCESSIBILITY TEXT SIZE.
 * There is no way to force Dynamic Type from JavaScript, and faking it with a
 * hard-coded multiplier would prove nothing about what the system actually
 * does. `ClosetGrid` reads the real `fontScale` and, at or above 1.5, turns the
 * two-column grid into one row per piece with the garment at 140×170 on the
 * leading edge — so at the default size this route is deliberately identical to
 * `dev-w3-g3-c-01`, and the difference between the two captures IS the frame.
 *
 * What a reviewer checks: composition changed rather than shrank, the metadata
 * wrapped instead of truncating, and nothing is capped or ellipsised.
 */
export default function DevW3G3C01Ax() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-2">
        <Text variant="eyebrow" accessibilityRole="header">
          Your closet
        </Text>
        <Text variant="note" className="mt-1">
          148 pieces
        </Text>
        <Text variant="note">41 worn this year</Text>
      </View>
      <View className="mt-2 flex-1">
        <ClosetGrid items={C01_PIECES} resolveImage={resolve} />
      </View>
    </SafeAreaView>
  );
}
