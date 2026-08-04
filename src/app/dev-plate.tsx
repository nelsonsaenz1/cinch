import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Plate } from '@/components/today/plate';
import { Text } from '@/components/ui/text';
import { resolveColorName } from '@/lib/color';
import type { Garment } from '@/lib/styling';

/**
 * DEV ONLY — a signed-out preview of the signature component.
 *
 * The Plate normally exists behind auth + a populated closet, which makes
 * design iteration on it absurdly slow (sign in, add ten garments, wait for
 * generation). This route renders one from fixture data at cinch://dev-plate.
 * It ships nothing: outside __DEV__ it renders a refusal.
 */

const g = (
  id: string,
  slot: Garment['slot'],
  colorName: string,
  category: string,
  subcategory: string,
  visualWeight: number,
  purchasePrice: number | null,
  wearCount: number,
): Garment =>
  ({
    id,
    slot,
    category,
    subcategory,
    colors: [{ name: colorName, oklch: resolveColorName(colorName)! }],
    visualWeight,
    purchasePrice,
    wearCount,
    warmth: 5,
    formality: 3,
    cutoutPath: null,
    thumbPath: null,
  }) as unknown as Garment;

const ITEMS: Garment[] = [
  g('1', 'outerwear', 'navy', 'outerwear', 'overcoat', 1.35, 289, 41),
  g('2', 'base_top', 'cream', 'top', 'crew knit', 1.0, 95, 62),
  g('3', 'bottom', 'camel', 'bottom', 'pleated trousers', 1.1, 120, 38),
  g('4', 'footwear', 'charcoal', 'shoes', 'derbies', 0.85, 210, 55),
  g('5', 'accessory', 'burgundy', 'accessory', 'scarf', 0.4, 45, 12),
];

const OUTFIT = {
  name: 'Quiet authority',
  reasoning:
    'Navy and camel anchor the look while the burgundy scarf picks up the warmth of the trousers. Structured enough for the dinner, soft enough for after.',
  swapNote: null,
  source: 'engine' as const,
  candidate: { items: ITEMS, score: 0.87 },
} as never;

export default function DevPlateScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <ScrollView contentContainerClassName="pt-6">
        <Plate
          outfit={OUTFIT}
          index={0}
          occasion="dinner at 7"
          colophon={{ city: 'Brooklyn', feelsLikeC: 17 }}
          resolveImage={() => undefined}
          onWear={() => {}}
          onReact={() => {}}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
