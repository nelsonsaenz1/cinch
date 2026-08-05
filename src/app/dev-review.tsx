import { Asset } from 'expo-asset';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ReviewCard } from '@/components/review/review-card';
import type { Item, ItemCategory } from '@/schemas/item';

/**
 * Review fixture — `cinch://dev-review`.
 *
 * Mirrors (tabs's sibling) `review.tsx`: the same colophon progress header
 * over the same `ReviewCard`, but with one hardcoded item and no query, no
 * mutation, no auth. `plate-01-knit.svg` stands in for the "cleaned-up
 * photo" the tagger would normally have produced, the same placeholder
 * convention `dev-closet.tsx` uses for garment art.
 *
 * Dev-only, like dev-closet and dev-screens: __DEV__-gated in the auth gate.
 */
const MOCK_ITEM: Item = {
  id: 'dev-review-cream-knit',
  userId: 'dev-user',
  imagePath: null,
  cutoutPath: null,
  thumbPath: null,
  status: 'needs_review',
  category: 'top',
  subcategory: 'Knitwear',
  colors: [{ hex: '#E3DBCB', name: 'Cream' }],
  // `pattern` is repurposed here to land the "crew neck" detail — the schema
  // has no dedicated neckline field, and `ReviewCard`'s own `detailsValue`
  // logic joins `material` + `pattern` (see review-card.tsx), so this is the
  // one honest way to reach the handoff's exact "Fine-knit · crew neck".
  pattern: 'crew neck',
  material: 'Fine-knit',
  brand: null,
  formalityScore: 3,
  warmthScore: 3,
  waterResistant: false,
  fit: 'regular',
  patternScale: 'none',
  seasons: ['fall', 'winter'],
  occasions: ['casual', 'office'],
  description: null,
  purchasePrice: null,
  purchaseDate: null,
  wearCount: 0,
  lastWornAt: null,
  isArchived: false,
  isForSale: false,
  userVerified: false,
  createdAt: new Date(2026, 6, 20).toISOString(),
};

const TOTAL_STEPS = 5;
const CURRENT_STEP = 0; // 0-based — "1 of 5", matching Frame 08 exactly.

export default function DevReviewScreen() {
  const knitUri = useMemo(() => Asset.fromModule(require('@/assets/plates/plate-01-knit.svg')).uri, []);

  const [category, setCategory] = useState<ItemCategory>(MOCK_ITEM.category);
  const [occasions, setOccasions] = useState<string[]>(MOCK_ITEM.occasions);

  const item = useMemo<Item>(() => ({ ...MOCK_ITEM, thumbPath: knitUri }), [knitUri]);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <View className="flex-row items-center justify-end px-gutter pt-2">
        <Button title="Close" variant="ghost" onPress={() => {}} />
      </View>

      <View className="flex-row items-center justify-between px-gutter pb-1 pt-1">
        <Text variant="colophon">
          Review · {CURRENT_STEP + 1} of {TOTAL_STEPS}
        </Text>
        <View className="flex-row items-center gap-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              className={`h-1 rounded-full ${i === CURRENT_STEP ? 'bg-accent dark:bg-accent-dark' : 'bg-sand dark:bg-sand-dark'}`}
              style={{ flex: 1, maxWidth: 16 }}
            />
          ))}
        </View>
      </View>

      <View className="flex-1">
        <ReviewCard
          item={item}
          isTop
          depth={0}
          category={category}
          occasions={occasions}
          onEditCategory={setCategory}
          onToggleOccasion={(occ) =>
            setOccasions((prev) => (prev.includes(occ) ? prev.filter((o) => o !== occ) : [...prev, occ]))
          }
          onConfirm={() => {}}
          onSkip={() => {}}
        />
      </View>
    </SafeAreaView>
  );
}
