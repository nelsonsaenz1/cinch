import { View } from 'react-native';

import { GarmentImage } from '@/components/media/garment-image';
import { Text } from '@/components/ui/text';
import type { Item } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';

/**
 * Legibility flip for the fallback caption, mirroring GarmentCell's OKLCH
 * check. Item colours carry sRGB hex (when they carry anything), so this uses
 * plain relative luminance — close enough for a binary light-or-dark call.
 */
function isDarkHex(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.55;
}

/**
 * A single garment as a plate — the recessed tray well with the cutout floating
 * in it, at thumbnail scale.
 *
 * This is the one-garment sibling of `GarmentCell` (components/today), and it
 * follows that file's rendering idiom exactly: the shared `GarmentImage`, whose
 * cache key survives URL re-signing, `contentFit="contain"`, and an honest
 * colour swatch — never a broken-image glyph and never a blank well — when no
 * render exists. It is a separate component because `GarmentCell` consumes the styling
 * engine's `Garment` reduction; these thumbs render closet `Item`s directly,
 * and round-tripping an Item through `toGarment` just to draw a thumbnail
 * would drag the whole scoring vocabulary into a display path.
 *
 * The caller resolves plate → cutout ONLY. The mock specifies plates, so the
 * raw photograph (`thumbPath`) is deliberately not a fallback here — a photo of
 * a coat on a bed inside the profile rail would read as a bug, not a garment.
 */
export function PlateThumb({
  item,
  uri,
  size,
  /** Suppress the fallback caption at sizes where 11px type cannot fit. */
  showFallbackLabel = true,
  /**
   * Corner radius. Defaults to the card radius (16); the Plan atlas sets its
   * 44px suggestion thumbs at 8 — at that scale 16 reads as a circle-ish blob
   * rather than a plate.
   */
  radius = 16,
}: {
  item: Item;
  uri?: string;
  size: number;
  showFallbackLabel?: boolean;
  radius?: number;
}) {
  const theme = useTheme();

  return (
    <View
      style={{ width: size, height: size, borderRadius: radius }}
      className="items-center justify-center overflow-hidden bg-tray">
      <GarmentImage
        uri={uri}
        contentFit="contain"
        transition={200}
        recyclingKey={item.id}
        style={{ width: '100%', height: '100%' }}
        // No plate or cutout yet — the norm in the Simulator, where subject
        // lifting cannot run — and, since UX-06, an expired signature or a body
        // that will not decode. The tagger writes colour names without hex, so
        // unlike GarmentCell (whose engine colours always carry OKLCH) the
        // honest swatch here is usually the tray itself plus the garment's name.
        fallback={
          <View
            className="h-full w-full items-center justify-center px-1"
            style={{ backgroundColor: item.colors[0]?.hex ?? theme.tray }}>
            {showFallbackLabel ? (
              <Text
                variant="caption"
                numberOfLines={2}
                className="text-center"
                // Same flip constants GarmentCell uses, so the two swatch styles
                // cannot drift apart. Muted on the bare tray; over a real colour
                // the text follows that colour's lightness.
                style={{
                  color: item.colors[0]?.hex
                    ? isDarkHex(item.colors[0].hex)
                      ? '#FFFFFFCC'
                      : '#1C1A16AA'
                    : theme.muted,
                }}>
                {item.subcategory ?? item.category}
              </Text>
            ) : null}
          </View>
        }
      />
    </View>
  );
}
