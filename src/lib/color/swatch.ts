import { hexToOklch, oklchToHex, type Oklch } from './oklch';
import { resolveColorName } from './families';

/**
 * THE TINT A PICTURELESS GARMENT WELL TAKES.
 *
 * The audit's finding #62: "Friend closets, event boards, activity details,
 * saved looks, diary days, and trips become grids of indistinguishable beige
 * blocks. Every image surface needs a meaningful fallback (garment name/type/
 * color), not a blank tile." A tray-coloured square with a hairline tshirt
 * glyph in it is that blank tile — six of them in a row are six identical
 * beige rectangles, and the reader cannot tell a coat from a shoe, a slow
 * network from a deleted photograph, or one look from another.
 *
 * `components/today/garment-cell.tsx` already had the honest answer for the
 * outfit plate: the garment's own colour under its own name. This is that
 * answer extracted so the social surfaces can use it too, and it is pure so
 * the mapping can be tested without a renderer.
 *
 * ── COLOUR ARRIVES IN THREE SHAPES ────────────────────────────────────────
 *
 * The styling engine's `GarmentColor` carries an `oklch`. The `items.colors`
 * column, as the friend projection and the closet schema read it, carries
 * `{ hex, name }` with the hex nullable. The diary's `DiaryPiece` carries only
 * a `colorName` — "cognac", "olive green" — because the projection was written
 * for a row of type, not a swatch. All three resolve here, in that order of
 * trust: a measured value beats a parsed hex beats a name looked up in the
 * wardrobe table.
 *
 * Null when nothing resolves, which is a real outcome and not a failure: an
 * untagged piece has no colour, and the caller falls back to its own ground.
 * The NAME still gets drawn either way — a word on tray is already the
 * difference between "a garment, pictureless" and "a tile that failed".
 */
export type GarmentSwatch = {
  /** The tile's ground. A hex, always — the caller owns the no-colour case. */
  background: string;
  /**
   * Type that will pass on it. Not a token: this rides on an arbitrary garment
   * colour, so it is chosen from that colour's own lightness rather than from
   * the theme, which knows nothing about what it is being drawn over.
   */
  ink: string;
};

/**
 * Where the flip happens. OKLCH `L` is perceptual lightness, so one threshold
 * holds across every hue — the reason this is not an sRGB luminance test.
 * 0.55 is `garment-cell.tsx`'s own number, kept so a garment that reads white
 * on its Today plate reads white on a friend's grid too.
 */
const INK_FLIP_L = 0.55;

/** Warm off-white and warm near-black, at the alphas the plate already uses. */
const LIGHT_INK = '#FFFFFFCC';
const DARK_INK = '#1C1A16AA';

export type SwatchColorInput = {
  /** A measured value — the styling engine's own. Trusted first. */
  oklch?: Oklch | null;
  /** `items.colors[0].hex`. Nullable in the schema and usually present. */
  hex?: string | null;
  /** `items.colors[0].name`, or the diary's `colorName`. The last resort. */
  name?: string | null;
};

/** The OKLCH behind whichever of the three shapes the caller has, or null. */
export function swatchOklch(color: SwatchColorInput | null | undefined): Oklch | null {
  if (!color) return null;
  if (color.oklch) return color.oklch;
  if (color.hex) {
    const parsed = hexToOklch(color.hex);
    if (parsed) return parsed;
  }
  if (color.name) return resolveColorName(color.name);
  return null;
}

/** The ground and the type that goes on it, or null when there is no colour. */
export function garmentSwatch(color: SwatchColorInput | null | undefined): GarmentSwatch | null {
  const value = swatchOklch(color);
  if (!value) return null;
  return {
    background: oklchToHex(value),
    ink: value.L < INK_FLIP_L ? LIGHT_INK : DARK_INK,
  };
}

/**
 * The ink for a ground the caller chose itself — a theme token, usually
 * `tray`, for the untagged piece that resolved no colour at all.
 */
export function swatchInkOn(hex: string): string {
  const value = hexToOklch(hex);
  if (!value) return DARK_INK;
  return value.L < INK_FLIP_L ? LIGHT_INK : DARK_INK;
}
