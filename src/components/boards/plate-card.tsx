import { Pressable, View } from 'react-native';

import { QuadrantPlate } from '@/components/boards/quadrant-plate';
import { Skeleton, Text } from '@/components/ui';
import { plateMetaLine, plateTitle } from '@/features/boards/board-lines';
import type { KeptPlate } from '@/features/boards/types';
import { useTheme } from '@/theme/tokens';

/**
 * The plate at rest — the tile, the name, the meta line.
 *
 * The tile is `QuadrantPlate` — the lookbook's own 2×2, whose fourth cell is
 * designed rather than left blank (audit 98). What this adds is the caption
 * block and the card around it, which is the only part that belongs to the
 * lookbook rather than to every screen that draws a look at rest.
 *
 * THE TRAY UNDERLAY. The tile rounds its own corners at 6, and this card
 * clips at 16 — so a bare tile inside it would show four slivers of white card
 * where the two radii disagree. The wrapper paints `tray` behind the tile so
 * whatever the rounding reveals is the same colour as the tile's own ground,
 * and the seam disappears. A `radius` prop on the shared tile would be the
 * proper fix; it is filed rather than taken, since the shared layer is
 * read-only to this unit.
 */
export function PlateCard({
  plate,
  size,
  imageUris,
  onPress,
  now,
}: {
  plate: KeptPlate;
  /** The column width. The tile is square at exactly this size. */
  size: number;
  /** Signed URLs for `plate.imagePaths`, in the same four-cell order. */
  imageUris: readonly (string | undefined)[];
  onPress?: () => void;
  /** Injectable so a fixture route can print a fixed month. */
  now?: Date;
}) {
  const theme = useTheme();

  const title = plateTitle(plate);
  const meta = plateMetaLine(plate, now);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'image'}
      // One label for the whole card. Read as three separate elements it comes
      // out as "image, Monday standard, saved in June dot worn twice" — the
      // meta line's middle dot is typography, not speech. The designed fourth
      // cell is never announced as an image; the quadrant hides its own
      // descendants so this label is the whole of what is spoken.
      accessibilityLabel={[title, meta].filter(Boolean).join(', ')}
      className="overflow-hidden rounded-lg border border-rule bg-surface active:opacity-80">
      <View style={{ width: size, height: size, backgroundColor: theme.tray }}>
        {/* AUDIT 98 — the lookbook's own quadrant, whose fourth cell is
            designed rather than left blank. `pieceCount` comes from `itemIds`
            and not from the image array, because "no piece here" and "this
            piece has no photograph" are different facts and are drawn
            differently. See quadrant-plate.tsx. */}
        <QuadrantPlate imageUris={imageUris} pieceCount={plate.itemIds.length} size={size} />
      </View>

      <View className="px-3 pb-3 pt-2.5">
        {/* The name is the card's own voice: ink, regular, one line. Set with
            an inline colour rather than a second `text-*` class — NativeWind
            resolves two colour utilities on one element by key order, not by
            intent (see button.tsx). */}
        {title ? (
          <Text variant="note" numberOfLines={1} style={{ color: theme.ink }}>
            {title}
          </Text>
        ) : null}
        {/* 13pt REGULAR secondary — audit 98's "saved state and wear count are
            visually distinct" is carried by ORDER and by words, not by a second
            typographic voice. `colophon` set this in tracked uppercase Medium,
            which turned two plain facts into a label.
            MUTED, NOT THE ATLAS'S #A29C90: that is the `byline` token, lighter
            even than `faint`, and this line is content. */}
        <Text variant="note" numberOfLines={2} className={title ? 'mt-1' : ''}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The same geometry with nothing in it — KP-05's square skeleton.
 *
 * Square, and exactly the card's own shape, because that is the whole point of
 * the state: "so board chips and the first row do not move when plates
 * arrive". A skeleton of a different height makes the grid jump, which reads
 * as a bug rather than as content landing.
 */
export function PlateCardSkeleton({ size, delay = 0 }: { size: number; delay?: number }) {
  return (
    <View className="overflow-hidden rounded-lg border border-rule bg-surface">
      <Skeleton style={{ width: size, height: size }} delay={delay} />
      <View className="gap-2 px-3 pb-3 pt-2.5">
        <Skeleton className="rounded-chip" style={{ width: '68%', height: 13 }} delay={delay} />
        <Skeleton className="rounded-chip" style={{ width: '44%', height: 10 }} delay={delay} />
      </View>
    </View>
  );
}
