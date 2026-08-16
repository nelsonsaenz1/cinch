import { useAssets } from 'expo-asset';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReviewCard } from '@/components/review/review-card';
import { Text } from '@/components/ui/text';
import { piece } from '@/components/closet/w3-g3-fixture-data';

const BLOUSE = [require('@/assets/garments/white-linen-blouse.jpg')];

const ITEM = piece({
  category: 'top',
  subcategory: 'Linen blouse',
  colors: [{ name: 'White', hex: '#F4F1EA' }],
  material: 'Linen',
  status: 'needs_review',
});

/**
 * RV-01 — a confident guess, with the decision beside the garment.
 *
 * AUDIT 72 IN ONE GEOMETRY CHANGE. "The garment and its three guessed fields
 * sit side by side rather than stacked, which buys back 116 pt, and the two
 * actions land 68 pt under the last field instead of at the bottom of a tall
 * sheet." Skip and Looks right are both 52pt full half-width peers; only the
 * accepting one is filled; and the consequence of skipping is printed under
 * them rather than discovered afterwards.
 *
 * "Progress reads 2 of 3 to review, a count with its denominator, never a bar."
 * THAT LINE LIVES ON `src/app/review.tsx`, WHICH THIS LANE DOES NOT OWN — the
 * screen still draws a segmented pip bar above the deck. It is raised as a
 * serialization request in the report; the header strip below poses what the
 * frame asks for so the two can be compared.
 *
 * DETERMINISM: no clock, no random, no network. The card's swipe is a gesture,
 * so the deck is at rest and nothing animates in the captured viewport.
 */
export default function DevW3G3Rv01() {
  const [assets] = useAssets(BLOUSE);
  const uri = assets?.[0]?.localUri ?? assets?.[0]?.uri;

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <View className="flex-row items-center justify-between px-gutter pt-2">
          <Text variant="label">Close</Text>
          {/* The count, with its denominator. A count, never a bar. */}
          <Text variant="colophon">2 of 3 to review</Text>
          <Text variant="label" className="text-accent">
            Undo
          </Text>
        </View>
        <View className="flex-1">
          <ReviewCard
            item={ITEM}
            imageUri={uri}
            isTop
            depth={0}
            onConfirm={() => {}}
            onSkip={() => {}}
            category="top"
            occasions={[]}
            price={null}
            onEditCategory={() => {}}
            onToggleOccasion={() => {}}
            onEditPrice={() => {}}
          />
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
