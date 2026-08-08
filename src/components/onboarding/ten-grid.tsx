import { useState } from 'react';
import { View } from 'react-native';

import { TenTile } from '@/components/onboarding/ten-tile';
import { settledCount, type TenSlot } from '@/features/onboarding/ten-slots';

const COLUMNS = 3;
const GAP = 8;

/**
 * Tile height as a share of column width.
 *
 * The atlas draws each cell 80 tall inside a 393-wide frame whose grid columns
 * work out to ~112 — so the cells are landscape, not square. Kept as a ratio
 * rather than a hard 80 for the same reason the column width is measured: the
 * shape should survive a narrower phone instead of only matching on the one
 * the atlas was drawn at.
 *
 * Squaring them, which is what shipped first, costs ~44% more height than the
 * grid has and pushes the tenth slot and the reasoning card below the fold —
 * breaking the single rule T-01 states outright.
 */
const TILE_ASPECT = 80 / 112.33;

/**
 * The Ten's grid — ten tiles, three columns, all on screen unscrolled
 * (free-tier-contract.md §2: "the ten slots are visible from the first
 * second"). Column width is measured, not guessed, so the grid holds its
 * geometry at every device width the way the atlas's fixed 393pt frame does.
 */
export function TenGrid({
  slots,
  foregroundedId,
  garmentNames,
  imageUris,
  onSlotPress,
}: {
  slots: readonly TenSlot[];
  foregroundedId: number | null;
  /** Real garment name once tagged, keyed by slot id. */
  garmentNames?: Record<number, string | null>;
  /** Resolved photo URL, keyed by slot id. */
  imageUris?: Record<number, string | undefined>;
  onSlotPress?: (slotId: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const tileSize = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;
  const tileHeight = Math.round(tileSize * TILE_ASPECT);

  // Only one slot is ever left, and that is the only moment a tile reads
  // "Last" instead of "Next".
  const isLastSlot = settledCount(slots) === slots.length - 1;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {tileSize > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {slots.map((slot) => (
            <TenTile
              key={slot.id}
              slot={slot}
              height={tileHeight}
              size={tileSize}
              foregrounded={slot.id === foregroundedId}
              isLast={isLastSlot}
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
