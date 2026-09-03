import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * THE ONE FALLBACK EVERY GARMENT WELL DRAWS WHEN THERE IS NO PHOTOGRAPH.
 *
 * Audit 2026-09-02 · finding 62: "every image surface needs a meaningful
 * fallback (garment name/kind/colour on a swatch) instead of a blank beige
 * tile." Three different marks were live for the same absence — a blank
 * `bg-tray` rectangle on Today's plate, a hairline `tshirt` glyph in the closet
 * grid and its rails, and an honest colour-and-caption swatch in
 * `GarmentCell`/`PlateThumb`. Only the third says anything: a reader looking at
 * a grid of hangers cannot tell one piece from another, and a reader looking at
 * "Cream sweater" on a cream ground can.
 *
 * So the third one is now the only one, and it lives here rather than in either
 * of the two files that had it, because a fallback duplicated is a fallback
 * that drifts. `GarmentCell` (styling `Garment`s, OKLCH colour) and `PlateThumb`
 * (closet `Item`s, sRGB hex) both hand this component the two facts it needs —
 * a ground and a name — and neither has to know how the other derives them.
 *
 * ── IT IS NOT A LOADING MARK ────────────────────────────────────────────────
 *
 * `GarmentImage` draws its own ground while a URL is in flight and only reaches
 * for this once there is nothing to draw (no path, an expired signature, a body
 * that will not decode). See `mediaWell` and `tests/media-resilience.test.ts`.
 */

/** The two inks, as literals: they are printed ON an arbitrary garment colour
 *  and so cannot come from a theme that knows nothing about that colour. */
const INK_OVER_DARK = '#FFFFFFCC';
const INK_OVER_LIGHT = '#1C1A16AA';

/** The share card's fixed paper palette — a dark-mode phone must not leak a
 *  dark swatch onto a light artifact. */
const PAPER_GROUND = '#F0ECE3';

/**
 * Which ink survives on a given ground.
 *
 * Plain relative luminance, which is close enough for a binary light-or-dark
 * call and is what both former swatch implementations already did — one in
 * OKLCH lightness, one in sRGB. Callers holding OKLCH convert first
 * (`oklchToHex`), so there is one rule rather than two that agree by hand.
 */
export function swatchInk(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const n = Number.parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return null;
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.55 ? INK_OVER_DARK : INK_OVER_LIGHT;
}

export function GarmentSwatch({
  /**
   * What the piece IS — "Cream sweater", "wool coat", "trousers". Null only
   * when the caller genuinely has no name to print, which draws a plain ground
   * rather than an invented word.
   */
  label,
  /** The garment's own colour, when the row carries one. */
  hex,
  /** Suppress the caption at sizes where 11px type cannot fit. */
  showLabel = true,
  /** Print mode, for the share card: fixed palette, unscaled type. */
  paper = false,
  /** Corner radius, when the swatch is not already inside a clipped well. */
  radius,
}: {
  label: string | null;
  hex?: string | null;
  showLabel?: boolean;
  paper?: boolean;
  radius?: number;
}) {
  const theme = useTheme();
  const ground = hex ?? (paper ? PAPER_GROUND : theme.tray);
  // Over a real colour the ink follows that colour's lightness; over the bare
  // tray it is the theme's own secondary ink, which is the value the contrast
  // floor was measured against.
  const ink = swatchInk(hex) ?? (paper ? INK_OVER_LIGHT : theme.muted);

  return (
    <View
      className="h-full w-full items-center justify-center overflow-hidden px-1"
      style={{ backgroundColor: ground, borderRadius: radius }}>
      {showLabel && label ? (
        <Text
          variant="caption"
          numberOfLines={2}
          className="text-center"
          maxFontSizeMultiplier={paper ? 1 : undefined}
          style={{ color: ink }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
