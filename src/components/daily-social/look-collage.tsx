import { Image } from 'expo-image';
import { View } from 'react-native';

import { GRID_GAP, ROW_RATIO } from '@/components/today/plate-grid';
import { useTheme } from '@/theme/tokens';

import { collageRows } from './look-card-spec';

/**
 * One piece of a shared look, as this lane's components take it.
 *
 * **A signed URL, not a storage path.** Worker B's `DailyLookPiece` carries
 * `thumbPath` / `cutoutPath` / `platePath`; turning those into a displayable
 * link is `features/closet/use-image-urls.ts`'s job and therefore a query
 * concern. A presentational component that signed its own URLs would fetch,
 * which is the one thing this lane does not do.
 */
export type LookCollagePiece = {
  itemId: string;
  /** Already signed. `null` while the batch is still resolving. */
  imageUrl: string | null;
};

/**
 * A LOOK IS A COLLAGE, NOT A PHOTOGRAPH — §5.4, DS-03.
 *
 * The friend's own garment images, laid out in the app. There is no look
 * photo: no capture step, no upload, no storage bucket, no image-moderation
 * surface, and no camera or library permission anywhere in this unit. That is
 * not a simplification — a user-supplied photograph of themselves is a
 * different product with a different privacy contract and a different review
 * obligation under the App Store's UGC rules.
 *
 * ── The composition is borrowed, not invented ───────────────────────────────
 *
 * `plateGrid()` from `components/today/plate-grid.ts` decides how many cells
 * sit on each row, and it is reused rather than re-derived because it already
 * encodes the rule this frame needs: one grid at one scale, every row the same
 * height, cells stretching to fill the row so a short look leaves no gap, and
 * **no blank cell that could be mistaken for a failed image.** A second layout
 * function would be a second opinion about the same drawing.
 *
 * ── FEWER PIECES THAN WERE WORN ─────────────────────────────────────────────
 *
 * A piece its owner has hidden from friends never enters `friend_items`, and
 * therefore never enters this array. A shared look can legitimately arrive with
 * three pieces when five were worn, and this frame must not read as broken when
 * it does — which is exactly what `plateGrid()` buys: three pieces compose as
 * [2, 1] with no empty slot, not as a five-cell grid with two holes in it.
 *
 * **Nothing here counts, infers or hints at what is missing.** No caption, no
 * footnote, no ghost cell, no VoiceOver label. A reader must not be able to
 * subtract their way to the owner's private decision. The cue that used to say
 * so was removed from the accepted atlas after review, and this comment is
 * where it would otherwise come back.
 *
 * A look with no visible pieces at all renders nothing rather than an apology,
 * for the same reason: "no pieces to show" is a statement about what was
 * hidden.
 *
 * ── Why the geometry needs no measurement ───────────────────────────────────
 *
 * Each ROW carries `aspectRatio`, so its height is its own width times
 * `ROW_RATIO` and Yoga does the arithmetic. The alternative — reading the
 * window width and subtracting the gutters, as `plate-skeleton.tsx` does — is
 * correct only for a component that sits directly on the page, and this one has
 * a card around it. No `onLayout`, no measurement state, no first-frame jump.
 */
export function LookCollage({ pieces }: { pieces: readonly LookCollagePiece[] }) {
  const theme = useTheme();
  const rows = collageRows(pieces);
  if (rows.length === 0) return null;

  return (
    <View style={{ gap: GRID_GAP }}>
      {rows.map((slice, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={{
            flexDirection: 'row',
            gap: GRID_GAP,
            // Width ÷ height. `ROW_RATIO` is height ÷ width, so this is its
            // reciprocal — the row is as tall as `plateGrid` intends at
            // whatever measure it is handed.
            aspectRatio: 1 / ROW_RATIO,
          }}>
          {slice.map((piece) => (
            <View
              key={piece.itemId}
              style={{
                flex: 1,
                backgroundColor: theme.tray,
                borderRadius: 12,
                overflow: 'hidden',
                padding: 6,
              }}>
              {piece.imageUrl ? (
                <Image
                  source={{ uri: piece.imageUrl }}
                  // Fitted, never cropped — the app's rule for every garment
                  // well, and the reason the cell carries padding. A coat with
                  // its shoulders cut off to fill a square is a coat nobody
                  // recognises.
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
