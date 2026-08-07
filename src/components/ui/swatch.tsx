import { Image, type ImageSource } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from '@/theme/tokens';

export type SwatchProps = {
  /** The garment's colour, as a hex fill. */
  hex?: string;
  /**
   * A photo to fall back to when there is no tagged colour — the day-row's
   * only variant. Pre-resolved by the caller (`stableImageSource`), so this
   * file stays free of the closet feature's cache-key concerns.
   */
  imageSource?: ImageSource;
  /** The five sizes the app actually draws: the plate dot, the day-row cell, the review circle, the item-detail circle, the manual-tagging picker circle. */
  size: 14 | 16 | 18 | 24 | 30;
  /** `circle` (default) rings a colour in the palette rule; `square` is the day-row's clipped photo cell, no ring. */
  shape?: 'circle' | 'square';
  /**
   * The picked state of a selectable swatch — the atlas's 2px ink ring
   * (A-05's colour row). Purely visual: the pressable, its role and its
   * `accessibilityState` belong to the caller, same as `imageSource` keeps
   * this file free of the closet's concerns.
   */
  selected?: boolean;
};

/**
 * One component for the app's four colour-swatch dialects — 14/16/18/24pt,
 * circles and a square, each previously hand-typed at its own call site.
 */
export function Swatch({ hex, imageSource, size, shape = 'circle', selected = false }: SwatchProps) {
  const theme = useTheme();

  if (shape === 'square') {
    return (
      <View
        // The rule border is part of the cluster's geometry (the atlas draws
        // every 16px cell with it) — a pale garment on canvas has no edge at
        // all without one.
        className="overflow-hidden rounded-sm bg-tray dark:bg-tray-dark"
        style={{ width: size, height: size, borderWidth: 1, borderColor: theme.rule }}>
        {hex ? (
          <View style={{ flex: 1, backgroundColor: hex }} />
        ) : imageSource ? (
          <Image
            source={imageSource}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: hex,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.ink : theme.rule,
      }}
    />
  );
}
