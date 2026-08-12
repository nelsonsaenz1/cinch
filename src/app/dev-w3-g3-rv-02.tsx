import { useAssets } from 'expo-asset';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReviewCard } from '@/components/review/review-card';
import { Text } from '@/components/ui/text';
import { piece } from '@/components/closet/w3-g3-fixture-data';

const SKIRT = [require('@/assets/garments/beige-corduroy-skirt.jpg')];

/**
 * RV-02 — a low-confidence guess, hedged in the VALUES.
 *
 * "Uncertainty is written into the values themselves — probably, or, not clear
 * — and explained once above them in regular prose. There is no confidence
 * score, no percentage, no amber warning colour and no icon: a number would
 * imply a precision the model cannot claim."
 *
 * SO THE HEDGE IS DATA, NOT A BADGE. This fixture poses it the only honest way
 * available: the item's own fields carry the hedged words, which is exactly
 * what the shipping card renders when the tagger returns them. Nothing on the
 * card computes a confidence, and nothing draws one.
 *
 * The hedge is `muted`, never `faint` — a hedge nobody can read is not a hedge.
 */
const ITEM = piece({
  category: 'bottom',
  subcategory: 'Corduroy skirt',
  colors: [{ name: 'Beige or camel', hex: '#C4AF8C' }],
  material: 'Not clear',
  status: 'needs_review',
});

export default function DevW3G3Rv02() {
  const [assets] = useAssets(SKIRT);
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
          <Text variant="colophon">3 of 3 to review</Text>
          <Text variant="label" className="text-accent">
            Undo
          </Text>
        </View>
        <View className="flex-1">
          <ReviewCard
            item={ITEM}
            imageUri={uri}
            gapNote="The photograph is folded, so this is a guess. Correct anything that is wrong."
            isTop
            depth={0}
            onConfirm={() => {}}
            onSkip={() => {}}
            category="bottom"
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
