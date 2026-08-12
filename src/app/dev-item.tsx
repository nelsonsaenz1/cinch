import { Asset } from 'expo-asset';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddTagSheet } from '@/components/item/add-tag-sheet';
import { DeleteSheet } from '@/components/item/delete-sheet';
import { ItemEditSheet } from '@/components/item/item-edit-sheet';
import { ItemChips } from '@/components/item/item-chips';
import { ItemHero } from '@/components/item/item-hero';
import { ItemMissing } from '@/components/item/item-missing';
import { ItemSkeleton } from '@/components/item/item-skeleton';
import { ItemStats } from '@/components/item/item-stats';
import { MaintenancePlate } from '@/components/item/maintenance-plate';
import { WearsWellWith, type RailPiece } from '@/components/item/wears-well-with';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';

/**
 * Item detail fixture — `cinch://dev-item`.
 *
 * Renders the four frames of the Item Detail State Atlas (I-01…I-04) from the
 * atlas's own numbers and its own licensed photographs, so each state can be
 * held against the PNG side by side. The REAL components are fed mock props —
 * this is not a redrawing of their look, same contract as dev-plan and
 * dev-closet.
 *
 * It exists because item detail cannot otherwise be judged on a simulator: the
 * screen needs a signed-in session with a tagged closet and worn outfit history
 * behind it, and the simulator has no keychain to sign in with.
 *
 * Dev-only, like every other `dev-` route: the auth gate in `app/_layout.tsx`
 * refuses the whole prefix outside `__DEV__`, so a deep link to this in a
 * release build goes nowhere.
 */

const COAT = Asset.fromModule(require('@/assets/garments/cognac-shearling-coat.jpg')).uri;
const KNIT = Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg')).uri;
const TROUSERS = Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')).uri;
const LOAFERS = Asset.fromModule(require('@/assets/garments/brown-leather-loafers.jpg')).uri;
const TOTE = Asset.fromModule(require('@/assets/garments/cognac-leather-tote.jpg')).uri;
const BLOUSE = Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')).uri;
const SKIRT = Asset.fromModule(require('@/assets/garments/beige-corduroy-skirt.jpg')).uri;
const BOOTS = Asset.fromModule(require('@/assets/garments/brown-leather-boots.jpg')).uri;
const BAG = Asset.fromModule(require('@/assets/garments/brown-leather-crossbody-bag.jpg')).uri;

/**
 * The rail the atlas draws: four visible tiles out of nine, with the counts
 * from I-01. The remaining five carry real photographs and descending counts so
 * the header's total is the length of the list rather than a typed number.
 */
const RAIL: RailPiece[] = [
  { id: '1', name: 'Mohair sweater', imageUri: KNIT, coWearCount: 11 },
  { id: '2', name: 'Tailored trousers', imageUri: TROUSERS, coWearCount: 8 },
  { id: '3', name: 'Penny loafers', imageUri: LOAFERS, coWearCount: 6 },
  { id: '4', name: 'Leather tote', imageUri: TOTE, coWearCount: 4 },
  { id: '5', name: 'Linen blouse', imageUri: BLOUSE, coWearCount: 4 },
  { id: '6', name: 'Corduroy skirt', imageUri: SKIRT, coWearCount: 3 },
  { id: '7', name: 'Leather boots', imageUri: BOOTS, coWearCount: 2 },
  { id: '8', name: 'Crossbody bag', imageUri: BAG, coWearCount: 2 },
  { id: '9', name: 'Linen blouse', imageUri: BLOUSE, coWearCount: 1 },
];

/**
 * The last two have no frame in the atlas — they are what the pencil and the
 * dashed "+ Tag" chip open, both of which I-01 draws without saying what is
 * behind them. Listed here so they are still looked at before they ship.
 */
const FRAMES = [
 'I-01 full',
 'I-02 delete',
 'I-03 loading',
 'I-04 missing',
 'Edit',
 'Tag',
] as const;
type Frame = (typeof FRAMES)[number];

export default function DevItem() {
  const [frame, setFrame] = useState<Frame>('I-01 full');

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style={frame === 'I-01 full' || frame === 'I-02 delete' ? 'light' : 'dark'} />

      {frame === 'I-01 full' || frame === 'I-02 delete' || frame === 'Edit' || frame === 'Tag' ? (
        <Full />
      ) : null}
      {frame === 'I-03 loading' ? <ItemSkeleton onBack={() => {}} /> : null}
      {frame === 'I-04 missing' ? (
        <SafeAreaView className="flex-1" edges={['top']}>
          <ItemMissing onBack={() => {}} onBackToCloset={() => {}} onCheckStorage={() => {}} />
        </SafeAreaView>
      ) : null}

      <DeleteSheet
        visible={frame === 'I-02 delete'}
        wears={38}
        onStore={() => setFrame('I-01 full')}
        onDeleteForever={() => setFrame('I-04 missing')}
        onCancel={() => setFrame('I-01 full')}
      />

      <ItemEditSheet
        visible={frame === 'Edit'}
        initial={{ name: 'Cognac shearling coat', price: '346', category: 'outerwear' }}
        onSave={() => setFrame('I-01 full')}
        onCancel={() => setFrame('I-01 full')}
        onStore={() => setFrame('I-01 full')}
      />

      <AddTagSheet
        visible={frame === 'Tag'}
        initial={{ occasions: ['casual', 'outdoor'], seasons: ['fall', 'winter'] }}
        onSave={() => setFrame('I-01 full')}
        onCancel={() => setFrame('I-01 full')}
      />

      {/* The switcher, pinned over the frame so every state is one tap away.
          Deliberately ugly-simple — it is scaffolding, not a design surface. */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-rule bg-canvas px-3 pb-8 pt-2.5">
        <View className="flex-row flex-wrap gap-2">
          {FRAMES.map((f) => (
            <Chip
              key={f}
              label={f}
              selected={frame === f}
              selectedGround="ink"
              onPress={() => setFrame(f)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** I-01, in the same order and with the same wrappers `item/[id].tsx` uses. */
function Full() {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 140 }}
      contentInsetAdjustmentBehavior="never">
      <ItemHero imageUri={COAT} label="Cognac shearling coat" onBack={() => {}} onEdit={() => {}} />

      <View className="px-gutter pt-5">
        <Text variant="display" style={{ fontSize: 36, lineHeight: 47 }}>
          Cognac shearling coat
        </Text>
        <Text variant="label" className="mt-1.5 text-muted">
          Added 14 Mar 2025 · $346
        </Text>
      </View>

      <View className="pt-4">
        <ItemChips
          category="outerwear"
          colors={[
            { name: 'cognac', hex: '#9A5B33' },
            { name: 'cream', hex: '#E4D9C4' },
          ]}
          occasions={['weekend', 'travel']}
          seasons={['autumn', 'winter']}
          onAddTag={() => {}}
        />
      </View>

      <View className="pt-5">
        <ItemStats wears={38} costPerWear="$9.10" sinceLast="6d" />
      </View>

      <BorrowablePreview />

      <View className="pt-6">
        <WearsWellWith pieces={RAIL} mode="coWear" onPressPiece={() => {}} />
      </View>

      <View className="pt-6">
        <MaintenancePlate
          rows={[
            {
              label: 'Send back to review',
              caption: 'Returns it to the tag queue for a second pass. Nothing is re-read.',
              onPress: () => {},
            },
            {
              label: 'Re-read this piece',
              caption: 'Cinch re-describes the photo and refreshes tags. It goes back in the review deck.',
              onPress: () => {},
            },
            {
              label: 'Delete this piece',
              caption: 'Storage first — outfit history is kept either way.',
              onPress: () => {},
              tone: 'accent',
            },
          ]}
        />
      </View>
    </ScrollView>
  );
}

/**
 * The lending card, copied from `item/[id].tsx` rather than imported — it is
 * private to that screen, and a fixture is not a reason to widen its surface.
 * If it ever moves into `components/item/`, this should import it instead.
 */
function BorrowablePreview() {
  return (
    <View
      className="mx-gutter mt-4 flex-row items-center gap-3 bg-tray px-3.5 py-3"
      style={{ borderRadius: 14 }}>
      <View className="flex-1">
        <Text variant="body" style={{ fontSize: 14, fontWeight: '600' }}>
          Borrowable
        </Text>
        <Text variant="caption" className="mt-0.5 text-muted">
          Friends following you can ask for this piece.
        </Text>
      </View>
      <View className="h-[30px] w-[50px] justify-center rounded-full bg-ink p-[3px]">
        <View className="h-6 w-6 self-end rounded-full bg-canvas" />
      </View>
    </View>
  );
}
