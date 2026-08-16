import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetSkeleton } from '@/components/closet/closet-skeleton';
import { Text } from '@/components/ui/text';

/**
 * C-06 — the closet loading.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "Skeleton geometry = final geometry". The wells are 168pt, the name bars
 *   15pt, the metadata bars 13pt in the lighter tray tone, and the chips carry
 *   their real widths at their real 38pt height — every figure read off the
 *   shipping `ItemCard` rather than typed from the picture of it.
 * · "no shimmer sweep in either case, and no spinner." The shared `Skeleton`
 *   primitive is a SWEEP and is deliberately not used here; the bars breathe at
 *   6% amplitude over 380ms instead.
 * · "under Reduce Motion they hold at their mid value."
 * · The title is PRINTED rather than skeletonised, "since it is known before the
 *   query returns."
 *
 * DETERMINISM: `still` holds every bar at the mid value and starts no animation
 * at all, which is the same frame Reduce Motion reaches. A running loop cannot
 * be captured twice to the same bytes, so the fixture is the settled frame — and
 * because Reduce Motion arrives at exactly this composition, the still capture
 * is also the accessibility evidence.
 */
export default function DevW3G3C06() {
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
      </View>
      <ClosetSkeleton still />
    </SafeAreaView>
  );
}
