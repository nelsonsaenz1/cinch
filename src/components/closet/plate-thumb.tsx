import { View } from 'react-native';

import { GarmentImage } from '@/components/media/garment-image';
import { GarmentSwatch } from '@/components/media/garment-swatch';
import { pieceName } from '@/features/closet/item-name';
import type { Item } from '@/schemas/item';

/**
 * A single garment as a plate — the recessed tray well with the cutout floating
 * in it, at thumbnail scale.
 *
 * This is the one-garment sibling of `GarmentCell` (components/today), and it
 * follows that file's rendering idiom exactly: the shared `GarmentImage`, whose
 * cache key survives URL re-signing, `contentFit="contain"`, and — through the
 * `GarmentSwatch` both of them now draw — an honest colour swatch carrying the
 * piece's own name when no render exists. Never a broken-image glyph and never
 * a blank well. It stays a separate component because `GarmentCell` consumes
 * the styling engine's `Garment` reduction; these thumbs render closet `Item`s
 * directly, and round-tripping an Item through `toGarment` just to draw a
 * thumbnail would drag the whole scoring vocabulary into a display path.
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
        // that will not decode. The tagger writes colour NAMES without hex, so
        // the ground here is usually the bare tray; what keeps the well
        // meaningful either way is `pieceName`, which puts the colour back into
        // the caption ("Cream sweater") when it could not go into the ground.
        fallback={
          <GarmentSwatch
            label={pieceName(item)}
            hex={item.colors[0]?.hex}
            showLabel={showFallbackLabel}
          />
        }
      />
    </View>
  );
}
