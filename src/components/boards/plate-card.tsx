import { Pressable, View } from 'react-native';

import { PlateTile, Skeleton, Text } from '@/components/ui';
import { plateMeta, plateTitle } from '@/features/boards/board-lines';
import type { KeptPlate } from '@/features/boards/types';
import { useTheme } from '@/theme/tokens';

/**
 * The plate at rest — the tile, the name, the meta line.
 *
 * The tile itself is the shared `PlateTile`, unchanged: a square 2×2 tray, up
 * to four pieces, a three-piece look leaving the fourth cell empty. What this
 * adds is the caption block and the card around it, which is the only part
 * that belongs to the lookbook rather than to every screen that draws a look
 * at rest.
 *
 * THE TRAY UNDERLAY. `PlateTile` rounds its own corners at 6, and this card
 * clips at 16 — so a bare tile inside it would show four slivers of white card
 * where the two radii disagree. The wrapper paints `tray` behind the tile so
 * whatever the rounding reveals is the same colour as the tile's own ground,
 * and the seam disappears. A `radius` prop on the shared tile would be the
 * proper fix; it is filed rather than taken, since the shared layer is
 * read-only to this unit.
 */
export function PlateCard({
  plate,
  boardName,
  size,
  imageUris,
  onPress,
}: {
  plate: KeptPlate;
  /** The board's name, or null for a plate that sits in All. */
  boardName: string | null;
  /** The column width. The tile is square at exactly this size. */
  size: number;
  /** Signed URLs for `plate.imagePaths`, in the same four-cell order. */
  imageUris: readonly (string | undefined)[];
  onPress?: () => void;
}) {
  const theme = useTheme();

  const title = plateTitle(plate);
  const meta = plateMeta(boardName, plate.wornCount);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'image'}
      // One label for the whole card. Read as three separate elements it comes
      // out as "image, Monday standard, Work dot worn six times" — the meta
      // line's tracked capitals and its middle dot are typography, not speech.
      accessibilityLabel={[title, meta].filter(Boolean).join(', ')}
      className="overflow-hidden rounded-lg border border-rule bg-surface active:opacity-80">
      <View style={{ width: size, height: size, backgroundColor: theme.tray }}>
        <PlateTile images={imageUris} size={size} />
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
        {/* `colophon` is literally "the data line under a plate" — tracked
            small caps, tabular figures so "worn 6×" and "worn 12×" do not
            jitter down a column.
            MUTED, NOT THE ATLAS'S #A29C90. That value is the `byline` token,
            one step lighter than `faint`, and this line carries the two facts
            the frame exists to state — which board, and how often it has been
            worn. Real content does not go below AA. */}
        <Text variant="colophon" className={title ? 'mt-1' : ''}>
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
