import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { garmentSwatch, swatchInkOn, type SwatchColorInput } from '@/lib/color';
import { useTheme } from '@/theme/tokens';

/**
 * WHAT A GARMENT WELL SHOWS WHEN THERE IS NO PHOTOGRAPH — the social half.
 *
 * Finding #62: "Friend closets, event boards, activity details, saved looks,
 * diary days, and trips become grids of indistinguishable beige blocks."
 *
 * Every one of those surfaces had a fallback already. They were a `tshirt`
 * glyph in `hairline`, a bare `<View />`, or a plain `tray` rectangle — three
 * different ways of saying nothing. Six pictureless pieces produced six
 * identical squares, so a look was unreadable, a closet was unbrowsable, and a
 * slow signing round trip was indistinguishable from a garment that has no
 * photograph and never will.
 *
 * This is the same answer `components/today/garment-cell.tsx` already gave the
 * outfit plate, made shareable: the piece's own colour as the ground, the
 * piece's own name set on it. Both facts are real — the colour is the value the
 * palette rules actually scored, the name is the word the tagger chose — so a
 * pictureless well states what the piece IS rather than apologising for what it
 * lacks. Two of them side by side are two different tiles.
 *
 * ── IT NEVER CHANGES THE GEOMETRY ─────────────────────────────────────────
 *
 * Fills its parent absolutely, exactly like the photograph it stands in for.
 * `GarmentImage` and `GarmentWell` both draw their fallback into a box the
 * caller sized; a fallback that measured itself would reflow the grid at the
 * moment a load failed, which reads as a second bug on top of the first.
 *
 * ── IT IS HIDDEN FROM VOICEOVER BY DEFAULT ────────────────────────────────
 *
 * Every call site composes its own label for the cell ("Cognac shearling coat,
 * worn six times"), and a fallback that spoke would make VoiceOver stop twice
 * on one thing. `spoken` opts back in for the rare well that is the only thing
 * in its own row.
 */
export type GarmentFallbackProps = {
  /**
   * What the piece is called. "Shearling coat", "Cognac boots" — the same
   * string the row beneath the tile prints. Empty or null draws the tinted
   * ground on its own, which is still a colour and still not a beige block.
   */
  label?: string | null;
  /**
   * The piece's first colour, in whichever of the three shapes the surface
   * has. See `@/lib/color/swatch`.
   */
  color?: SwatchColorInput | null;
  /** Lines the name may take before it truncates. Two, in a tile of any size. */
  lines?: number;
  /**
   * Print mode, for anything `view-shot` captures: the no-colour ground comes
   * from the card's fixed paper palette rather than the live theme, so a
   * dark-mode phone cannot leak a dark swatch onto a light artifact, and type
   * stops scaling with Dynamic Type because the card's geometry is fixed.
   */
  paper?: boolean;
  /** Let VoiceOver read the name. Off by default; the cell speaks for itself. */
  spoken?: boolean;
};

/** The paper palette's tray, from `garment-cell.tsx`. Not a theme token. */
const PAPER_GROUND = '#F0ECE3';

/**
 * The word for a piece with no photograph — "Shearling coat", "Boots".
 *
 * The tagger's own `subcategory` when there is one, the five-way bucket when
 * there is not, and "Untagged piece" when even that is `other`. Same grammar as
 * `pieceWord` in the diary and `friendPieceName` in the social graph, restated
 * here because those are typed to their own projections and this is the one
 * every tile-shaped surface can reach. Capitalised, because it is printed as a
 * label rather than read inside a sentence.
 */
export function garmentKindLabel(piece: {
  subcategory?: string | null;
  category?: string | null;
}): string {
  const kind = piece.subcategory?.trim() || (piece.category === 'other' ? '' : piece.category ?? '');
  if (!kind) return 'Untagged piece';
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function GarmentFallback({
  label,
  color,
  lines = 2,
  paper = false,
  spoken = false,
}: GarmentFallbackProps) {
  const theme = useTheme();

  const swatch = garmentSwatch(color);
  const ground = swatch?.background ?? (paper ? PAPER_GROUND : theme.tray);
  const ink = swatch?.ink ?? swatchInkOn(ground);

  const name = label?.trim();

  return (
    <View
      accessible={spoken || undefined}
      accessibilityRole={spoken ? 'image' : undefined}
      accessibilityLabel={spoken ? (name ?? undefined) : undefined}
      accessibilityElementsHidden={spoken ? undefined : true}
      importantForAccessibility={spoken ? undefined : 'no-hide-descendants'}
      className="h-full w-full items-center justify-center overflow-hidden px-1.5"
      style={{ backgroundColor: ground }}>
      {name ? (
        <Text
          variant="caption"
          numberOfLines={lines}
          className="text-center"
          // The card's geometry is fixed in print mode; on screen the name
          // grows with the reader's type size like every other word.
          maxFontSizeMultiplier={paper ? 1 : undefined}
          style={{ color: ink }}>
          {name}
        </Text>
      ) : null}
    </View>
  );
}
