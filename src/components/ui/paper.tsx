import { Canvas, ColorMatrix, FractalNoise, Rect } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';

// Rec. 709 luminance in every output channel: fractal noise is RGB static,
// and coloured static reads as a screen artifact — paper grain is grey.
const DESATURATE = [
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * Printed stock, not flat colour.
 *
 * `#FAF9F6` with nothing on it is the lazy-minimalism failure — this lays one
 * static fractal-noise grain over the whole app at 2.5% opacity, which is
 * exactly enough for the canvas to read as paper and never enough to see as a
 * texture. Mounted once, in the root layout, above everything: `pointerEvents`
 * off, so it exists to the eye and not to the touch system.
 *
 * Cost: the shader rasterises once; after that it composites as a single
 * static texture. It deliberately is NOT part of the share card — view-shot
 * cannot capture a Skia canvas (documented), and the card has its own flat
 * paper ground.
 */
export function PaperGrain() {
  const { width, height } = useWindowDimensions();

  return (
    <Canvas
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: 0.025 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Rect x={0} y={0} width={width} height={height}>
        <FractalNoise freqX={0.9} freqY={0.9} octaves={3} />
        <ColorMatrix matrix={DESATURATE} />
      </Rect>
    </Canvas>
  );
}
