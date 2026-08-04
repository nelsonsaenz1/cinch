import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { oklchToHex, resolveColorName } from '@/lib/color';

/**
 * The one thing someone remembers about this screen.
 *
 * Five blocks in the app's own wardrobe neutrals, assembling left to right like
 * a flat-lay being laid out. It states what Cinch does before a word is read,
 * and it is the product's actual visual language rather than decoration bolted
 * on top — the Today screen renders outfits as exactly this shape.
 *
 * The colours are resolved through the styling engine's own colour table, so
 * these are literally the values the palette rules reason about. Navy, camel,
 * cream, burgundy and charcoal are the neutrals the engine most often anchors
 * an outfit on.
 *
 * Widths are uneven on purpose: equal blocks read as a chart, uneven ones read
 * as garments of different visual weight.
 */
const RAIL = [
  { name: 'navy', flex: 1.35 },
  { name: 'camel', flex: 0.85 },
  { name: 'cream', flex: 1.1 },
  { name: 'burgundy', flex: 0.7 },
  { name: 'charcoal', flex: 1 },
] as const;

const SWATCHES = RAIL.map((r) => {
  const c = resolveColorName(r.name);
  return { ...r, hex: c ? oklchToHex(c) : '#CCCCCC' };
});

function Swatch({ hex, flex, index, still }: { hex: string; flex: number; index: number; still: boolean }) {
  const progress = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) return;
    progress.value = withDelay(
      120 + index * 70,
      // ease-out-quart. Real objects decelerate; they do not bounce, and an
      // overshoot here would read as a toy rather than a wardrobe.
      withTiming(1, { duration: 620, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    );
  }, [index, progress, still]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 18 },
      // Starts at 0.94 rather than 0 — nothing in the real world appears from
      // nothing, and scaling from zero is the tell of a generated animation.
      { scaleY: 0.94 + progress.value * 0.06 },
    ],
  }));

  return (
    <Animated.View
      style={[{ flex, height: '100%', backgroundColor: hex, borderRadius: 5 }, style]}
    />
  );
}

export function GarmentRail() {
  // Respects the system Reduce Motion setting: the composition still lands,
  // it just arrives already assembled.
  const reduced = useReducedMotion();

  return (
    // Deliberately the outfit card's own container — tray background, same
    // radius, same inner padding, same flex-weighted blocks. A row of bare
    // squares reads as a paint-chip palette; inside the tray it reads as an
    // outfit, which is a preview of the actual product rather than decoration.
    <View
      accessibilityRole="image"
      accessibilityLabel="An outfit laid out: navy, camel, cream, burgundy and charcoal"
      className="w-full flex-row gap-1.5 rounded-card bg-tray p-2.5 dark:bg-tray-dark"
      style={{ height: 104 }}>
      {SWATCHES.map((s, i) => (
        <Swatch key={s.name} hex={s.hex} flex={s.flex} index={i} still={reduced} />
      ))}
    </View>
  );
}
