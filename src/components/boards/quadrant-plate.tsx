import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { QUADRANT_CELLS } from '@/features/boards/board-lines';
import { useTheme } from '@/theme/tokens';

/**
 * The quadrant plate — audit 98's whole subject.
 *
 * NO TILE THAT LOOKS LIKE A MISSING ASSET. That is the rule, and it turns on
 * one observation: a failed image is a blank photograph well with NO TYPE IN
 * IT. So every deliberately empty cell in this grid carries type, and the one
 * cell that carries no type is the one that is genuinely waiting on a
 * photograph. A reader can tell them apart without being told.
 *
 * The grid is FIXED at 2×2 with 3pt gaps whatever the look holds:
 *
 *   * **Four pieces** — four photographs, and nothing else to decide.
 *   * **Three pieces** — the fourth cell is DESIGNED. It is a sand cell with
 *     the piece count set in it ("3 pieces"), which is a statement about the
 *     look rather than a hole in it. The other resolution audit 98 allows is a
 *     silhouette, and this component draws that too — see below.
 *   * **A piece with no photograph** — a silhouette, not a blank. The piece
 *     exists; it is its picture that does not, and the two are different facts.
 *   * **Five or more** — four are shown and the TOTAL is stated in the metadata
 *     under the tile (`plateMetaLine`), never crammed in as a fifth cell or a
 *     "+1" badge. The tile is a likeness, not an inventory.
 *
 * Why not `components/ui/plate-tile.tsx`: that tile leaves its fourth cell
 * genuinely blank, which is precisely the drawing audit 98 rejects, and it is
 * the shared object the diary and Today also render. This is the lookbook's own
 * quadrant — the atlas lists it as a NEW primitive — so the change lands here
 * rather than under every other screen that draws a look at rest.
 */

/** The atlas's gap. Three points, inside a tile of any size. */
const GAP = 3;

/** The fixed grid, from the one constant every surface in this unit reads. */
const CELLS = Array.from({ length: QUADRANT_CELLS }, (_, i) => i);

export type QuadrantPlateProps = {
  /**
   * Signed URLs per cell, in the look's own order. `undefined` or `null` means
   * this piece has no photograph — which is NOT the same as there being no
   * piece, and is drawn differently.
   */
  imageUris: readonly (string | null | undefined)[];
  /**
   * How many pieces the look actually holds — `plate.itemIds.length`, not the
   * number of images. This is the number that decides whether a cell is a
   * missing photograph or an empty cell by design, and it is the one thing
   * `imagePaths` alone cannot tell you.
   */
  pieceCount: number;
  /** Side length in points. Everything inside is derived from it. */
  size: number;
};

export function QuadrantPlate({ imageUris, pieceCount, size }: QuadrantPlateProps) {
  const theme = useTheme();

  // Exactly four cells, always, in the top-left order the look was built in.
  const cell = (size - GAP) / 2;

  return (
    <View
      // One element to a screen reader. The plate's own label is composed by
      // the card above it ("Linen and corduroy, three pieces, saved in June,
      // worn twice"); the designed fourth cell is never announced as an image.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        backgroundColor: theme.tray,
        borderRadius: 6,
        overflow: 'hidden',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP,
      }}>
      {CELLS.map((i) => (
        <Cell
          key={i}
          size={cell}
          uri={imageUris[i] ?? null}
          hasPiece={i < pieceCount}
          // The count goes in the FIRST empty cell and nowhere else — one
          // statement per tile. A three-piece look has one empty cell anyway; a
          // two-piece look gets the count in the third and a plain sand cell in
          // the fourth, so the tile still reads as one designed object.
          countLabel={i === pieceCount ? pieceLabel(pieceCount) : null}
        />
      ))}
    </View>
  );
}

/** `3 pieces` — the type that keeps a designed cell from reading as a failure. */
function pieceLabel(pieceCount: number): string {
  return `${pieceCount} ${pieceCount === 1 ? 'piece' : 'pieces'}`;
}

function Cell({
  size,
  uri,
  hasPiece,
  countLabel,
}: {
  size: number;
  uri: string | null;
  hasPiece: boolean;
  countLabel: string | null;
}) {
  const theme = useTheme();

  // A piece with a photograph. Fitted, never cropped — a coat whose shoulders
  // have been cut off to fill a square is a coat nobody recognises.
  if (hasPiece && uri) {
    return (
      <View style={{ width: size, height: size, backgroundColor: theme.surface, padding: 4 }}>
        <Image
          source={{ uri }}
          contentFit="contain"
          transition={120}
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }

  // A piece whose photograph is not there. A SILHOUETTE, which says "a garment,
  // pictureless" — where a blank well would say "an image that failed".
  if (hasPiece) {
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: theme.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <GarmentSilhouette size={Math.round(size * 0.42)} color={theme.rule} />
      </View>
    );
  }

  // A cell with no piece behind it. Sand, and — for the first one — the count,
  // because type is the whole difference between a designed cell and a failure.
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: theme.sand,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
      }}>
      {countLabel ? (
        <Text variant="note" numberOfLines={1} style={{ fontSize: 12 }}>
          {countLabel}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A garment, reduced to its outline — the shape of a hanging top.
 *
 * Drawn in `rule` rather than in an ink: it is furniture standing in for a
 * photograph, not content. Deliberately not an SF Symbol: this sits inside a
 * plate at thumbnail size, and the symbol set's clothing glyphs read as icons
 * at that scale rather than as a garment's shape.
 */
function GarmentSilhouette({ size, color }: { size: number; color: string }) {
  const shoulder = size * 0.34;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size,
          height: shoulder,
          borderTopLeftRadius: size * 0.3,
          borderTopRightRadius: size * 0.3,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: size * 0.66,
          height: size - shoulder,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
