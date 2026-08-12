import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { TenTile } from '@/components/onboarding/ten-tile';
import { TEN_GAP, tenTileHeight, tenTileWidth } from '@/features/onboarding/ten-layout';
import { type TenSlot } from '@/features/onboarding/ten-slots';

/**
 * The Ten's grid — ten cells, all on screen unscrolled at the default type
 * scale (T-01: "all ten tiles are on screen before any scrolling, which is what
 * makes 'order is guidance' legible rather than merely stated").
 *
 * Column width is measured rather than guessed, so the grid holds its geometry
 * at every device width the way the atlas's fixed 393pt frame does, and the
 * column count and cell shape both come from `ten-layout.ts` so the AX
 * recomposition is a tested rule rather than a magic number in a component.
 */
export function TenGrid({
  slots,
  foregroundedId,
  garmentNames,
  imageUris,
  onSlotPress,
  /** Overridable so a fixture can photograph the AX layout without the OS. */
  fontScale: fontScaleOverride,
}: {
  slots: readonly TenSlot[];
  foregroundedId: number | null;
  /** Real garment name once tagged, keyed by slot id. Spoken, not printed. */
  garmentNames?: Record<number, string | null>;
  /** Resolved photo URL, keyed by slot id. */
  imageUris?: Record<number, string | undefined>;
  onSlotPress?: (slotId: number) => void;
  fontScale?: number;
}) {
  const window = useWindowDimensions();
  const fontScale = fontScaleOverride ?? window.fontScale;
  const [width, setWidth] = useState(0);
  const tileSize = width > 0 ? tenTileWidth(width, fontScale) : 0;
  const tileHeight = tenTileHeight(tileSize, fontScale);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {tileSize > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: TEN_GAP }}>
          {slots.map((slot) => (
            <TenTile
              key={slot.id}
              slot={slot}
              height={tileHeight}
              size={tileSize}
              foregrounded={slot.id === foregroundedId}
              garmentName={garmentNames?.[slot.id]}
              imageUri={imageUris?.[slot.id]}
              onPress={
                onSlotPress && slot.status !== 'filled' ? () => onSlotPress(slot.id) : undefined
              }
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
