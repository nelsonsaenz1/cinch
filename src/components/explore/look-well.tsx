import { Image } from 'expo-image';
import { View } from 'react-native';

import { WELL_GAP, WELL_RATIO, wellRows } from '@/features/explore/explore-spec';
import { useTheme } from '@/theme/tokens';

/**
 * One piece as the well takes it — a signed URL and nothing else.
 *
 * A storage path is not a URL; turning one into the other is
 * `features/closet/use-image-urls.ts`'s job and therefore a query concern. A
 * presentational component that signed its own would fetch, which is the one
 * thing this lane does not do.
 */
export type LookWellPiece = {
  itemId: string;
  /** Already signed. `null` while the batch is still resolving. */
  imageUrl: string | null;
};

/**
 * THE PHOTOGRAPH AT THE TOP OF A LOOK CARD — redesign 17's photo-first entry.
 *
 * A look is a collage of the friend's own garment images. There is no look
 * photo: no capture step, no upload, no bucket, no image-moderation surface,
 * and no camera or library permission anywhere in this unit. That is not a
 * simplification — a user-supplied photograph of a person is a different
 * product with a different privacy contract and a different review obligation.
 *
 * ── FEWER PIECES THAN WERE WORN ─────────────────────────────────────────────
 *
 * A garment its owner has hidden from friends never enters `friend_items`, and
 * therefore never enters this array. A shared look can legitimately arrive
 * with one piece when three were worn, and this frame must not read as broken
 * when it does: `wellRows` puts every piece it is given into exactly one cell
 * and leaves no cell empty, so a short look is a complete frame at a larger
 * scale rather than a grid with holes in it.
 *
 * **Nothing here counts, infers or hints at what is missing.** No caption, no
 * footnote, no ghost cell, no VoiceOver label. A reader must not be able to
 * subtract their way to somebody's private decision — which is also why a look
 * with no visible pieces at all draws NOTHING rather than an apology. The card
 * above decides that: see `look-entry-card.tsx`, where the whole well is
 * conditional so no empty ground is left behind for a reader to notice.
 *
 * ── Why it needs no measurement ─────────────────────────────────────────────
 *
 * The well carries `aspectRatio`, so its height is its own width times
 * `WELL_RATIO` and Yoga does the arithmetic. No `onLayout`, no measurement
 * state, no first-frame jump — which matters on a scroll of cards where a
 * late-arriving height would move every card below it.
 */
export function LookWell({
  pieces,
  radius,
}: {
  pieces: readonly LookWellPiece[];
  /** The card's radius. The well is the card's top, so it shares its curve. */
  radius: number;
}) {
  const theme = useTheme();
  const rows = wellRows(pieces);
  if (rows.length === 0) return null;

  return (
    // Hidden from VoiceOver by name, not merely by sitting inside the card's
    // `accessible` wrapper. The atlas marks the collage `aria-hidden` and says
    // why: the visible pieces are read from the outfit line instead, so no
    // per-tile label can hint at an omitted garment. A tile a reader can focus
    // is a tile they can count.
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        aspectRatio: 1 / WELL_RATIO,
        backgroundColor: theme.tray,
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        overflow: 'hidden',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: WELL_GAP,
        padding: 18,
      }}>
      {rows.map((slice, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={{
            flex: 1,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: WELL_GAP,
          }}>
          {slice.map((piece) => (
            <View key={piece.itemId} style={{ flex: 1, height: '100%' }}>
              {piece.imageUrl ? (
                <Image
                  source={{ uri: piece.imageUrl }}
                  // Fitted, never cropped — the app's rule for every garment
                  // well. A coat with its shoulders cut off to fill a rectangle
                  // is a coat nobody recognises.
                  contentFit="contain"
                  transition={120}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
