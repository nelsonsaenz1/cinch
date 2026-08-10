import { Image } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from '@/theme/tokens';

/**
 * The plate at rest — a square 2×2 tray, up to four pieces, hairline-divided.
 *
 * The distinction this component exists to hold: Today's `Plate` is a look
 * being PROPOSED, so its pieces are stacked and shadowed as if laid on paper.
 * This is a look at rest — kept on a board, or recorded in the diary — and a
 * collection reads as a grid, not as forty overlapping still lifes. KP's own
 * words: "a square 2×2 tray at any size", and it must stay recognisable at
 * thumbnail size, which the stacked regime does not.
 *
 * Three rules taken straight from the atlas, all of them the kind that get
 * quietly broken by a later "improvement":
 *
 *   * **Up to four.** A five-piece look shows four. There is no +1 badge — the
 *     tile is a likeness, not an inventory, and the entry it leads to lists
 *     every piece.
 *   * **A three-piece look leaves the fourth cell empty** rather than
 *     stretching the other three. An empty cell reads as a look with three
 *     pieces in it; a stretched grid reads as a different look.
 *   * **Fitted, never cropped.** Same rule as every other well in the app. A
 *     coat that has had its shoulders cut off to fill a square is a coat
 *     nobody recognises.
 */
export function PlateTile({
  /**
   * Displayable image URLs, already signed, in the order the look is read.
   * Nulls are allowed and render as an empty cell — a piece whose cutout has
   * not come back yet leaves a gap rather than collapsing the grid, so the
   * tile does not reflow when it arrives.
   */
  images,
  /**
   * Side length in points. 68 is the diary row's well; the saved grid uses the
   * column width. Everything inside is derived, so there is one number to pass
   * and no way for the divider to end up off-centre.
   */
  size,
  accessibilityLabel,
}: {
  images: readonly (string | null | undefined)[];
  size: number;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();

  // Exactly four cells, always. Padding with undefined rather than filtering is
  // what keeps a three-piece look in the top-left three cells instead of
  // recentring it — the atlas's "leaves the fourth cell empty".
  const cells = [images[0], images[1], images[2], images[3]];
  const half = size / 2;

  return (
    <View
      accessible={accessibilityLabel != null}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        backgroundColor: theme.tray,
        borderRadius: 6,
        overflow: 'hidden',
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}>
      {cells.map((uri, i) => (
        <View
          key={i}
          style={{
            width: half,
            height: half,
            // The hairline division is drawn as borders on the cells that sit
            // against the centre lines, so there is exactly one line's width
            // between cells and none at the tile's edge — a border on all four
            // sides would double up in the middle and box the outside.
            borderRightWidth: i % 2 === 0 ? 1 : 0,
            borderBottomWidth: i < 2 ? 1 : 0,
            borderColor: theme.rule,
            padding: size >= 96 ? 6 : 3,
          }}>
          {uri ? (
            <Image
              source={{ uri }}
              // `contain`, never `cover`. This is the fitted-never-cropped rule
              // and it is the whole reason the cell has padding.
              contentFit="contain"
              transition={120}
              style={{ width: '100%', height: '100%' }}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
