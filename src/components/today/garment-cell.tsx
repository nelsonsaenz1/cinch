import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { oklchToHex } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * One garment in a flat-lay tray — the cutout photograph when one exists,
 * otherwise an honest colour swatch. Shared between the in-app plate and the
 * share card so the artifact is pixel-for-pixel the thing the user saw.
 *
 * `paper` is print mode, for the share card: the no-colour fallback uses the
 * card's fixed paper palette instead of the live theme (a dark-mode phone must
 * not leak a dark swatch onto the light artifact), text does not scale with
 * Dynamic Type (the card's geometry is fixed), and the image fade is disabled
 * (view-shot would otherwise capture garments mid-transition, at partial
 * opacity).
 */
export function GarmentCell({
  garment,
  uri,
  paper = false,
}: {
  garment: Garment;
  uri?: string;
  paper?: boolean;
}) {
  const theme = useTheme();

  if (uri) {
    return (
      // Warm contact shadow. iOS derives it from the cutout's alpha, which is
      // what turns a bed-photo cutout into a studio ghost-mannequin shot.
      <View
        style={{
          flex: 1,
          shadowColor: '#141310',
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}>
        <Image
          source={uri}
          contentFit="contain"
          transition={paper ? 0 : 200}
          cachePolicy="memory-disk"
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  // No cutout yet — background removal needs a native module that cannot run
  // in the Simulator, so this path is the norm right now. The garment's real
  // colour is honest: it is the value the palette rules actually scored. Text
  // flips using OKLCH lightness — the perceptual space is exactly for this.
  return (
    <View
      // concentric(20, 12) = 8
      className="h-full w-full items-center justify-center overflow-hidden rounded px-1"
      style={{
        backgroundColor: garment.colors[0]
          ? oklchToHex(garment.colors[0].oklch)
          : paper
            ? '#F2F0EA'
            : theme.tray,
      }}>
      <Text
        variant="caption"
        numberOfLines={garment.visualWeight < 0.6 ? 1 : 2}
        className="text-center"
        maxFontSizeMultiplier={paper ? 1 : undefined}
        style={{
          color: (garment.colors[0]?.oklch.L ?? 1) < 0.55 ? '#FFFFFFCC' : '#141310AA',
          // A narrow column cannot fit a word horizontally, and mid-word
          // wrapping ("sca / rf") is worse than turning the label sideways —
          // which is also exactly what a woven garment label does in a seam.
          ...(garment.visualWeight < 0.6 ? { transform: [{ rotate: '90deg' }], width: 120 } : null),
        }}>
        {garment.subcategory ?? garment.category}
      </Text>
    </View>
  );
}
