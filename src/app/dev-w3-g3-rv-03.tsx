import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReviewCard } from '@/components/review/review-card';
import { PHOTO } from '@/components/closet/w3-g3-fixture-data';
import { Text } from '@/components/ui/text';
import type { Item, ItemCategory } from '@/schemas/item';

/**
 * RV-03 — editing category, then a failed save.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "The editor is the same sheet at the same height with its own back title,
 *   and the source photograph stays on screen so the correction is made against
 *   the thing being corrected." The editor is a composition of the card, not a
 *   second surface pushed over it — which is also what makes "returning from the
 *   editor lands back on the same card in the same position" true by
 *   construction rather than by restoring anything.
 * · "Selection: ring + tick + weight" — three channels on the held option, so
 *   the state survives greyscale and a colour-blind reading.
 * · "No correction lost on failure" — the notice states that the change is held
 *   on this phone, that it will be sent later, and offers an immediate retry. In
 *   the shipping deck that is literally true: a failed confirm unresolves the
 *   id, the card returns to its queue position, and the local `edits` for it are
 *   keyed by id and survive.
 * · "the save failure is drawn IN PLACE on the editor rather than as an alert."
 *   The warning banner that used to sit above the deck is gone with it.
 *
 * PROGRESS IS A COUNT. The line above the card is the same one `review.tsx` now
 * prints; the segmented pip row that used to sit beside it is retired.
 *
 * DETERMINISM: the editor is open and the failure is set from the first render
 * rather than reached by tapping, so the captured viewport is this exact state.
 * No clock, no random source, no network, no autofocused field — the price
 * editor is the one autofocusing control on this card and it is closed here.
 */
const FROZEN_CREATED = '2026-07-04T09:41:00.000Z';

const SKIRT: Item = {
  id: '00000000-0000-4000-8000-000000000003',
  userId: '00000000-0000-4000-8000-000000000000',
  imagePath: null,
  cutoutPath: null,
  platePath: null,
  // The fixture stores the asset URI directly; the card is handed a signed URL
  // in production and a plain one here, and neither is fetched over a network.
  thumbPath: PHOTO.skirt,
  listingPath: null,
  status: 'tagged',
  category: 'bottom',
  subcategory: 'Corduroy skirt',
  colors: [{ name: 'Beige', hex: '#C9B394' }],
  pattern: null,
  material: 'Corduroy',
  brand: null,
  formalityScore: 3,
  warmthScore: 3,
  waterResistant: false,
  seasons: ['fall'],
  occasions: ['casual'],
  description: null,
  purchasePrice: null,
  purchaseDate: null,
  wearCount: 0,
  lastWornAt: null,
  isArchived: false,
  isForSale: false,
  userVerified: false,
  createdAt: FROZEN_CREATED,
};

export default function DevW3G3Rv03() {
  const [category, setCategory] = useState<ItemCategory>('bottom');

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pb-1 pt-2">
        <Text variant="colophon">Review · 3 of 3 to review</Text>
      </View>
      <View className="flex-1">
        <ReviewCard
          item={SKIRT}
          imageUri={PHOTO.skirt}
          isTop
          depth={0}
          // The editor is open from the first frame. `ReviewCard` opens it from
          // a chip; this route reaches the same composition by starting there,
          // which is what makes the capture reproducible.
          openEditorInitially="category"
          category={category}
          occasions={SKIRT.occasions}
          price={null}
          onEditCategory={setCategory}
          onEditPrice={() => {}}
          onToggleOccasion={() => {}}
          onConfirm={() => {}}
          onSkip={() => {}}
          unsaved={{ onRetry: () => {} }}
        />
      </View>
    </SafeAreaView>
  );
}
