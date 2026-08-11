import { useMemo } from 'react';
import { View } from 'react-native';

import { GarmentCell } from '@/components/today/garment-cell';
import { lookCells, lookColumns } from '@/features/event-outfits/look-layout';
import { Text } from '@/components/ui/text';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * A posted look, as the board draws it.
 *
 * ── Why this is NOT `stackLayout` ─────────────────────────────────────────
 *
 * Today's plate overlaps its garments on a z-ordered hem line, which reads
 * beautifully at one look per screen. The board is five looks judged against
 * each other, and the Share a Look atlas draws the composed object as a GRID
 * of contained plates instead — `1fr 1fr` to four pieces, `repeat(3,1fr)`
 * beyond. That is a designed difference, not an inconsistency: an overlapping
 * stack hides the very pieces a voter is comparing, and the board's entire
 * premise is that one person's options are judged against each other.
 *
 * What stays identical to Today is the grammar the atlas actually names — oat
 * tray behind, a light plate under each garment, contained and never cropped,
 * rendered through the same `GarmentCell` so the fallback rules (cutout, then
 * an honest colour swatch, never a broken image) cannot drift apart.
 *
 * ── One object, four sizes ────────────────────────────────────────────────
 *
 * "Stored once and rendered at four sizes — 96pt card thumb, 224pt board
 * poster, full-bleed detail, share card — with no re-composition anywhere."
 * Hence `width` is the only size input and everything else is derived from it:
 * a caller that wants a thumbnail passes 96 and gets the same composition the
 * poster prints, not a different one tuned for small.
 */

export type ResolveImage = (...paths: (string | null | undefined)[]) => string | undefined;

export function LookPlate({
  pieces,
  width,
  resolveImage,
  gap = 8,
  padding = 10,
}: {
  /**
   * In stack order. Piece one is the look's face — the atlas makes this
   * load-bearing ("it fills the thumbnail in Lately, the Event page and any
   * share card"), so the caller must not re-sort by visual weight here.
   */
  pieces: readonly Garment[];
  width: number;
  resolveImage: ResolveImage;
  gap?: number;
  padding?: number;
}) {
  const theme = useTheme();
  const cells = useMemo(() => lookCells(pieces), [pieces]);
  const columns = lookColumns(pieces.length);

  const inner = width - padding * 2;
  const cellSize = (inner - gap * (columns - 1)) / columns;

  if (pieces.length === 0 || cellSize <= 0) {
    return <View style={{ width, height: width }} className="rounded-lg bg-tray" />;
  }

  return (
    <View
      className="rounded-lg bg-tray"
      style={{ width, padding, flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {cells.map((cell) =>
        cell.kind === 'garment' ? (
          <View
            key={cell.garment.id}
            className="overflow-hidden rounded-md bg-surface"
            style={{ width: cellSize, height: cellSize }}>
            <GarmentCell
              garment={cell.garment}
              uri={resolveImage(
                cell.garment.platePath,
                cell.garment.cutoutPath,
                cell.garment.thumbPath,
              )}
            />
          </View>
        ) : (
          <View
            key="more"
            className="items-center justify-center overflow-hidden rounded-md bg-surface"
            style={{ width: cellSize, height: cellSize }}>
            {/* `muted`, not `faint`: this is a real count of the user's own
                garments, and the contrast refusal applies to it like any other
                text. */}
            <Text variant="label" style={{ color: theme.muted }}>{`+${cell.count}`}</Text>
          </View>
        ),
      )}
    </View>
  );
}
