import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { C08_PIECES } from '@/components/closet/w3-g3-fixture-data';
import { Text } from '@/components/ui/text';

/**
 * C-08 — a closet built entirely through Describe.
 *
 * Two things are on trial here. First, that an unphotographed closet is drawn
 * as a NORMAL closet: the silhouette sits in the same well at the same scale,
 * on the sand ground with a 2pt stroke, so a piece with no picture "reads as
 * filed, not as missing". Second, that "Never worn" is printed as words on the
 * camel overcoat — "a zero here would read as a score."
 *
 * GARMENT IMAGERY: none, deliberately. The licensed set in `assets/garments`
 * holds no navy sweater, straight jeans, white trainers or camel overcoat, and
 * this is the one frame where that is not a shortfall — the silhouette IS the
 * state under test. The silhouette itself is the shipping fallback (an SF
 * Symbol), not the atlas's per-category drawing, which the deviation ledger
 * marks unresolved: "Silhouette set must be produced as assets."
 */
export default function DevW3G3C08() {
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
          11 pieces · described in words
        </Text>
      </View>
      <View className="mt-2 flex-1">
        <ClosetGrid items={C08_PIECES} />
      </View>
    </SafeAreaView>
  );
}
