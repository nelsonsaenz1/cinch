import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { C01_PIECES } from '@/components/closet/w3-g3-fixture-data';
import { Text } from '@/components/ui/text';

/** Paths are already URIs in the fixture, so the resolver just picks the first. */
const resolve = (...paths: (string | null | undefined)[]) =>
  paths.find((p): p is string => typeof p === 'string' && p.length > 0);

/**
 * C-01 — populated closet, mixed photograph and silhouette.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 60 — the name is the only LABEL on a card; the count under the title,
 *   the chips and the metadata are all lighter, and no metadata uses Medium.
 * · audit 62 — a 168pt well, so the garment is the largest useful thing on the
 *   card, at the same scale whether it is photographed or not.
 * · audit 63 — wear count and cost-per-wear are ONE sentence in one place, and
 *   the price half drops for the linen blouse, whose price is unknown.
 * · "No oxblood spent": the never-worn accent badge is gone from the well.
 *
 * DETERMINISM: every figure is a literal in `w3-g3-fixture-data`, the
 * photographs are the repo's own licensed set, and nothing on this route reads
 * a clock, a random source or a network.
 */
export default function DevW3G3C01() {
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
        {/* The count line the frame draws under the title: 13pt regular, a
            fact rather than a headline of its own (audit 60). Both figures are
            frozen literals — nothing here counts a live closet. */}
        <Text variant="note" className="mt-1">
          148 pieces · 41 worn this year
        </Text>
      </View>
      <View className="mt-2 flex-1">
        <ClosetGrid items={C01_PIECES} resolveImage={resolve} />
      </View>
    </SafeAreaView>
  );
}
