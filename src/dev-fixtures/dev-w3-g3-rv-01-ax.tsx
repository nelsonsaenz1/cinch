import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReviewCard } from '@/components/review/review-card';
import { PHOTO } from '@/components/closet/w3-g3-fixture-data';
import { Text } from '@/components/ui/text';
import type { Item } from '@/schemas/item';

/**
 * RV-01 / AX — largest Dynamic Type, the sheet fills the frame.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "Fields become ruled rows" — "the fields move under the garment as
 *   full-width ruled rows", label left and value right, at 18 and 19pt.
 * · "Three chips become one row" — "the three correction chips collapse into one
 *   Change something row that opens the same editors — three 19 pt chips could
 *   not sit in a row without wrapping into a shape nobody could scan." The row
 *   reveals the named chips rather than choosing a field for the user, because
 *   RV-01's whole argument is that "no user has to audit a form to find what is
 *   wrong."
 * · "Decision still above the fold" — accept moves ABOVE skip, "because a
 *   stacked pair has no dominant side; it is the filled one either way."
 * · "the sheet grows to 780 pt rather than the type shrinking" — this card is
 *   already full-bleed between the page insets rather than a fixed 604, so the
 *   growth the frame describes is what it does at every size.
 * · Nothing is capped: the ruled rows carry no `numberOfLines`.
 *
 * DETERMINISM: `stacked` is forced rather than read off `fontScale` — a capture
 * route cannot change the phone's type setting, and a stress frame that only
 * appears on a correctly configured device is one nobody can reproduce. The
 * shipping card reads the real setting at the threshold all three AX frames
 * share. No clock, no random source, no network, no autofocused field.
 */
const FROZEN_CREATED = '2026-07-04T09:41:00.000Z';

const BLOUSE: Item = {
  id: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000000',
  imagePath: null,
  cutoutPath: null,
  platePath: null,
  thumbPath: PHOTO.blouse,
  listingPath: null,
  status: 'tagged',
  category: 'top',
  subcategory: 'Linen blouse',
  colors: [{ name: 'White', hex: '#F4F1EA' }],
  pattern: null,
  material: 'Linen',
  brand: null,
  formalityScore: 3,
  warmthScore: 2,
  waterResistant: false,
  seasons: ['summer'],
  occasions: ['casual'],
  description: null,
  purchasePrice: null,
  purchaseDate: null,
  wearCount: 6,
  lastWornAt: null,
  isArchived: false,
  isForSale: false,
  userVerified: false,
  createdAt: FROZEN_CREATED,
};

export default function DevW3G3Rv01Ax() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The frame's own header line at this type size: a count, never a bar. */}
      <View className="px-gutter pb-1 pt-2">
        <Text variant="colophon" style={{ fontSize: 14, letterSpacing: 1.4 }}>
          2 of 3
        </Text>
      </View>
      <View className="flex-1">
        <ReviewCard
          item={BLOUSE}
          imageUri={PHOTO.blouse}
          isTop
          depth={0}
          stacked
          category="top"
          occasions={BLOUSE.occasions}
          price={null}
          onEditCategory={() => {}}
          onEditPrice={() => {}}
          onToggleOccasion={() => {}}
          onConfirm={() => {}}
          onSkip={() => {}}
        />
      </View>
    </SafeAreaView>
  );
}
