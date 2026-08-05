import { Image } from 'expo-image';
import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { spring } from '@/theme/tokens';

/**
 * Plate 01 — the welcome screen's hero, and the app's visual thesis.
 *
 * A real flat-lay, not an abstraction: overcoat, crew knit, trousers, scarf and
 * derbies drawn as paper-cutout vector art in the styling engine's own wardrobe
 * neutrals (assets/plates/plate-01*.svg, rendered natively by expo-image). The
 * caption underneath is set exactly like an outfit colophon on Today, so the
 * first screen teaches the plate grammar before a single word of UI copy.
 *
 * Each garment ships as its own full-canvas SVG layer. Stacked absolutely, they
 * compose the scene — and they can land one at a time, the way a stylist lays
 * out a look: coat first, then knit, trousers, shoes, scarf last.
 */

const CANVAS = { w: 1040, h: 660 };

const LAYERS = [
  { name: 'coat', src: require('@/assets/plates/plate-01-coat.svg') },
  { name: 'knit', src: require('@/assets/plates/plate-01-knit.svg') },
  { name: 'trousers', src: require('@/assets/plates/plate-01-trousers.svg') },
  { name: 'shoes', src: require('@/assets/plates/plate-01-shoes.svg') },
  { name: 'scarf', src: require('@/assets/plates/plate-01-scarf.svg') },
] as const;

function Layer({ src, index, still }: { src: number; index: number; still: boolean }) {
  const progress = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) return;
    // The last garment (the scarf — the finishing touch) is the app's single
    // bouncy moment. Everything before it lands smooth.
    const last = index === LAYERS.length - 1;
    progress.value = withDelay(
      160 + index * 90,
      withSpring(1, last ? spring.bouncy : spring.smooth),
    );
  }, [index, progress, still]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value * 1.6, 1),
    transform: [
      { translateY: (1 - progress.value) * 14 },
      { scale: 0.97 + progress.value * 0.03 },
    ],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', inset: 0 }, style]}>
      <Image source={src} style={{ width: '100%', height: '100%' }} contentFit="contain" />
    </Animated.View>
  );
}

export function PlateHero() {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();

  // Full measure: screen minus the 20pt gutters. The plate is a 6-column image.
  const plateW = width - 40;
  const artH = Math.round((plateW - 16) * (CANVAS.h / CANVAS.w));

  return (
    <View>
      <View
        accessibilityRole="image"
        accessibilityLabel="Plate 1. A flat-lay outfit: navy overcoat, cream crew-neck knit, camel trousers, burgundy scarf and charcoal derby shoes."
        className="rounded-plate bg-tray dark:bg-tray-dark"
        style={{ padding: 8 }}>
        <View style={{ height: artH }}>
          {LAYERS.map((l, i) => (
            <Layer key={l.name} src={l.src} index={i} still={reduced} />
          ))}
        </View>
      </View>

      {/* The legend line — identical grammar to an outfit colophon on Today. */}
      <View
        className="mt-3 border-t border-rule dark:border-rule-dark"
        style={{ paddingTop: 8 }}>
        <Text variant="colophon">Plate 01 · Navy / Camel / Cream / Burgundy / Charcoal</Text>
      </View>
    </View>
  );
}
