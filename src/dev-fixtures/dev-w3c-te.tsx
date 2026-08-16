import { Asset } from 'expo-asset';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetFloor } from '@/components/today/closet-floor';
import { Text } from '@/components/ui/text';
import type { Garment } from '@/lib/styling';

/**
 * TE-01 and TE-02 — the two Today states that now carry an example.
 *
 * Both drawn on one route because the whole point of the pair is the
 * DIFFERENCE between them: TE-01's example is three pieces and none of them the
 * reader's; TE-02's is four and the leading two are borrowed from the closet
 * they already have, which is what its caption counts.
 *
 * The second frame passes real `Garment` fixtures with resolvable images, so
 * the substitution path is the one under review rather than the fallback.
 */

const PHOTOS = {
  blouse: Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')),
  poncho: Asset.fromModule(require('@/assets/garments/cream-crochet-poncho.jpg')),
  overshirt: Asset.fromModule(require('@/assets/garments/beige-overshirt-jacket.jpg')),
} as const;

type PhotoId = keyof typeof PHOTOS;

const resolve = (...paths: (string | null | undefined)[]): string | undefined => {
  const path = paths.find(Boolean);
  if (!path) return undefined;
  const id = String(path).replace('fixture/', '') as PhotoId;
  return PHOTOS[id]?.uri;
};

function owned(id: PhotoId, subcategory: string, slot: Garment['slot']): Garment {
  return {
    id,
    slot,
    category: slot === 'footwear' ? 'footwear' : 'top',
    subcategory,
    colors: [],
    visualWeight: 1,
    fit: 'regular',
    pattern: null,
    patternScale: 'none',
    material: null,
    brand: null,
    formality: 3,
    warmth: 3,
    waterResistant: false,
    seasons: [],
    occasions: [],
    wearCount: 2,
    lastWornAt: null,
    purchasePrice: null,
    thumbPath: `fixture/${id}`,
    cutoutPath: `fixture/${id}`,
    platePath: `fixture/${id}`,
  } as unknown as Garment;
}

const SIX = [
  owned('blouse', 'linen blouse', 'base_top'),
  owned('poncho', 'crochet poncho', 'mid_layer'),
  owned('overshirt', 'overshirt jacket', 'outerwear'),
];

export default function DevW3cTe() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-16">
        <Text variant="eyebrow" className="px-gutter pt-4">
          TE-01 · empty closet
        </Text>
        <ClosetFloor items={[]} remaining={8} resolveImage={resolve} onStart={() => {}} onDescribe={() => {}} />

        <View className="mt-12 border-t border-rule pt-4">
          <Text variant="eyebrow" className="px-gutter">
            TE-02 · under the floor, example built around their pieces
          </Text>
          <ClosetFloor items={SIX} remaining={2} resolveImage={resolve} onStart={() => {}} onDescribe={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
