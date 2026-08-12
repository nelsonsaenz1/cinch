import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { resolveColorName } from '@/lib/color';
import type { Garment } from '@/lib/styling';

/**
 * DEV ONLY — the fixtures behind the `dev-w3-g2-*` routes, one per Wave 3
 * atlas state in the Today and Plate group.
 *
 * WHY DETERMINISM IS A REQUIREMENT AND NOT A NICETY. These routes are what the
 * screenshot matrix photographs and diffs byte for byte, so anything that
 * changes between two launches of unchanged code turns the baseline red for a
 * reason that has nothing to do with the code. Everything here obeys the same
 * four rules:
 *
 *   * No clock. `FIXTURE_NOW` is a literal, and every component that would
 *     otherwise read `new Date()` takes it as a prop.
 *   * No network. `noImages` returns undefined for every path, so each cell is
 *     the honest colour-swatch fallback rather than a byte fetched from the
 *     asset server.
 *   * No unsettled motion. Plates are passed `still`, which freezes the
 *     landing on its final frame — the same frame Reduce Motion produces, so
 *     one capture serves both.
 *   * No spinner and no autofocus. A spinner cannot reproduce its own bytes;
 *     an autofocused field opens a keyboard that is not part of the frame.
 *
 * The plates are also given `index={1}` rather than 0. The "Hold to share"
 * hint is printed on the day's FIRST card until AsyncStorage says it has been
 * retired, and whether that read beats the shutter is exactly the kind of race
 * a byte-diff cannot survive.
 */

/** 09:41 on the atlas's own Thursday. Apple's screenshot convention. */
export const FIXTURE_NOW = new Date(2026, 7, 6, 9, 41, 0);
/** The Saturday T-12 is drawn on — a cold day the closet cannot answer. */
export const FIXTURE_COLD_NOW = new Date(2026, 7, 8, 9, 41, 0);

/** Every image path resolves to nothing: no request, no cache, no race. */
export const noImages = () => undefined;

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
    platePath: null,
    thumbPath: null,
  }) as unknown as Garment;

/** The five-piece look T-01 draws: every piece priced, so the line prints. */
export const FIVE_PIECES: Garment[] = [
  g('w1', 'outerwear', 'cream', 'outerwear', 'shearling coat', 1.35, 480, 60),
  g('w2', 'mid_layer', 'cream', 'top', 'mohair sweater', 1.0, 240, 48),
  g('w3', 'bottom', 'charcoal', 'bottom', 'tailored trousers', 1.1, 180, 72),
  g('w4', 'footwear', 'cognac', 'shoes', 'penny loafers', 0.85, 210, 90),
  g('w5', 'bag', 'cognac', 'bag', 'leather tote', 0.4, 140, 120),
];

/** T-02's four-up: the same look with the coat left off. */
export const FOUR_PIECES = FIVE_PIECES.filter((p) => p.slot !== 'outerwear');

/**
 * T-03's three pieces — and the boots carry NO PRICE, which is the whole
 * point of the state: the cost-per-wear line is absent rather than dashed.
 */
export const THREE_PIECES: Garment[] = [
  g('r1', 'outerwear', 'olive', 'outerwear', 'overshirt jacket', 1.2, 165, 33),
  g('r2', 'bottom', 'camel', 'bottom', 'corduroy skirt', 1.1, 95, 24),
  g('r3', 'footwear', 'brown', 'shoes', 'leather boots', 0.85, null, 40),
];

/** A closet under the engine's floor — six pieces, no bottom and no shoes. */
export const PARTIAL_CLOSET: Garment[] = [
  g('p1', 'base_top', 'white', 'top', 'linen blouse', 1.0, 68, 5),
  g('p2', 'base_top', 'navy', 'top', 'oxford shirt', 1.0, 75, 9),
  g('p3', 'mid_layer', 'cream', 'top', 'mohair sweater', 1.05, 240, 12),
  g('p4', 'outerwear', 'navy', 'outerwear', 'wool coat', 1.35, 320, 14),
  g('p5', 'base_top', 'charcoal', 'top', 'silk shell', 0.95, 88, 3),
  g('p6', 'bag', 'cognac', 'bag', 'leather tote', 0.4, 140, 21),
];

/** An autumn closet on a snowing day: what T-12 refuses to dress. */
export const AUTUMN_CLOSET: Garment[] = [
  ...FIVE_PIECES.filter((p) => p.slot !== 'outerwear'),
  g('a1', 'base_top', 'olive', 'top', 'cotton shirt', 1.0, 70, 30),
  g('a2', 'bottom', 'camel', 'bottom', 'linen trousers', 1.1, 110, 26),
  g('a3', 'footwear', 'white', 'shoes', 'canvas sneakers', 0.85, 65, 88),
];

const outfit = (name: string, reasoning: string, items: Garment[]) =>
  ({
    name,
    reasoning,
    swapNote: null,
    source: 'engine' as const,
    candidate: { items, score: 0.87 },
  }) as never;

export const FIVE_PIECE_OUTFIT = outfit(
  'Quiet authority',
  'Cognac and cream anchor the look while the charcoal trousers ground it. Structured enough for the dinner, soft enough for after.',
  FIVE_PIECES,
);

export const FOUR_PIECE_OUTFIT = outfit(
  'Quiet authority',
  'Cognac and cream anchor the look while the charcoal trousers ground it.',
  FOUR_PIECES,
);

export const THREE_PIECE_OUTFIT = outfit(
  'Wet morning, dry ankles',
  'Rain until noon, so the boots lead and the overshirt takes the weather. The corduroy is the warmest thing in the wardrobe that is still clean.',
  THREE_PIECES,
);

/** The occasion T-02 interrupts with — a real occasion shape, frozen. */
export const FIXTURE_OCCASION = {
  id: 'fixture-occasion',
  title: 'Dinner',
  venueName: 'Bar Ilios',
  startsAt: new Date(2026, 7, 6, 19, 0, 0),
  memberCount: 4,
  occasion: 'dinner',
};

/**
 * The frame every fixture route renders into: the safe area and the canvas,
 * scrolling, with the tab bar's clearance at the foot. No dev chrome and no
 * state caption — a capture of this route is meant to be comparable with the
 * atlas frame, not with a contact sheet.
 */
export function W3Frame({ children }: { children: React.ReactNode }) {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <View>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}
