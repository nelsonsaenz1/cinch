import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { oklchToHex } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * THE STACK — the single geometry the outfit is laid out by.
 *
 * The old flat-lay was a flex ROW: garments side by side, sized by how much of
 * the look they occupied. It read as a tray of parts. A lookbook does not print
 * a tray; it prints the look, body-ordered — trousers low, top over them,
 * coat over that, shoes on the ground line, the small things at the margin.
 *
 * This table is that composition, and it lives HERE rather than in either
 * consumer because the in-app plate and the exported poster must be the same
 * picture. Parity is not a convention anyone has to remember: both call
 * `stackLayout()` with their own canvas width and get the identical rectangles
 * back, scaled. Change a number here and both surfaces move together.
 *
 * Every value is a fraction of the stack box's WIDTH — including the vertical
 * ones — so the composition is resolution-independent and the box's own height
 * is just `width × STACK_ASPECT`.
 */

/** Height ÷ width of the stack box. Portrait, because a dressed figure is. */
export const STACK_ASPECT = 0.95;

/**
 * Where the ingest pipeline anchors a garment's hem inside its square plate
 * (1024² transparent PNG, scale-normalized, bottom-anchored at 0.94). Layout
 * places HEMS, so this is what converts a hem line into the image's top edge.
 */
const PLATE_HEM = 0.94;

/**
 * The two regimes this geometry serves.
 *
 * `plate` — every garment has a plate render: transparent cutouts at a shared
 * scale, overlapping like worn clothes. This is the picture the design is for.
 *
 * `tile` — at least one garment has no plate yet, so each piece is a photo in
 * a rounded rect. Same slots, same hems, but an opaque rectangle cannot be
 * layered the way a cutout can: a coat tile sitting where a coat sits would
 * simply erase the top beneath it. The `fan` offsets step each tile out of the
 * stack far enough to stay legible, so the composition still reads as a stack
 * of layers rather than a grid of thumbnails.
 */
export type StackRegime = 'plate' | 'tile';

type SlotGeometry = {
  /** Paint order. Low draws first, i.e. furthest from the viewer. */
  z: number;
  /** Centre of the garment's column, as a fraction of box width. */
  cx: number;
  /** Where the garment's hem lands, measured down from the box's top edge. */
  hem: number;
  /** Side of the square the plate PNG is drawn into. */
  plate: number;
  /** Side of the photo tile in the fallback regime. */
  tile: number;
  /** How far the tile steps out of the stack so the layer beneath survives. */
  fanX: number;
  fanY: number;
};

/**
 * The core square — one size for everything worn ON the body.
 *
 * This is the load-bearing decision. The pipeline already normalized scale
 * across the closet, so a coat's PNG is genuinely taller than a shoe's inside
 * an identically sized square. Drawing every body garment into the SAME square
 * is therefore what preserves that work; giving each slot its own scale would
 * quietly undo it and put a handbag and an overcoat at the same size.
 */
const CORE = 0.72;

const STACK: Record<Garment['slot'], SlotGeometry> = {
  // Shoes stand on the ground line at the foot of the box, and go down FIRST so
  // the trouser hem breaks over them the way a real hem does.
  footwear: { z: 10, cx: 0.5, hem: 0.94, plate: CORE, tile: 0.36, fanX: 0.12, fanY: 0 },
  // Trousers/skirt: the lower zone, hem stopping just above the shoe so the
  // overlap is visible rather than exact.
  bottom: { z: 20, cx: 0.48, hem: 0.82, plate: CORE, tile: 0.4, fanX: -0.07, fanY: 0 },
  // A dress spans both zones on its own — same hem as a bottom, but nothing is
  // layered under it, so it sits at the same depth the two-piece core would.
  dress: { z: 25, cx: 0.48, hem: 0.82, plate: CORE, tile: 0.4, fanX: -0.06, fanY: -0.08 },
  // The shirt: hem at the hip, over the waistband of whatever is below.
  base_top: { z: 30, cx: 0.47, hem: 0.57, plate: CORE, tile: 0.4, fanX: -0.14, fanY: 0 },
  // A knit or cardigan rides a touch higher and a touch right of the shirt, so
  // the shirt's shoulder still shows — that sliver is what says "layered".
  mid_layer: { z: 40, cx: 0.49, hem: 0.555, plate: CORE, tile: 0.4, fanX: -0.02, fanY: -0.03 },
  // The coat goes over everything and sits deliberately off-centre: worn open,
  // with the look underneath peeking out on the left.
  outerwear: { z: 50, cx: 0.52, hem: 0.63, plate: CORE, tile: 0.4, fanX: 0.14, fanY: 0 },
  // A hat belongs above the shoulders. Its hem is high in the box; most of its
  // square is empty air above the box edge, which costs nothing.
  headwear: { z: 55, cx: 0.46, hem: 0.16, plate: CORE, tile: 0.26, fanX: 0, fanY: 0.16 },
  // Bag and accessory are the two slots that DON'T take the core square: they
  // are carried, not worn, and the design prints them as marginalia — small,
  // at the edge, the way a lookbook insets a detail shot.
  bag: { z: 60, cx: 0.82, hem: 0.55, plate: 0.34, tile: 0.28, fanX: -0.02, fanY: 0 },
  accessory: { z: 65, cx: 0.14, hem: 0.42, plate: 0.28, tile: 0.26, fanX: 0.02, fanY: 0.02 },
};

/** One garment placed in the stack, in points, ready to draw. */
export type StackedPiece = {
  garment: Garment;
  x: number;
  y: number;
  /** Square: plates are square by construction, and tiles are square by choice. */
  size: number;
};

/**
 * The composition, in points, painted back-to-front.
 *
 * Callers render the returned array in order — array order IS z-order, which
 * is the only stacking primitive both Skia and React Native agree on.
 */
export function stackLayout(
  pieces: Garment[],
  width: number,
  regime: StackRegime,
): StackedPiece[] {
  return [...pieces]
    .sort((a, b) => STACK[a.slot].z - STACK[b.slot].z)
    .map((garment) => {
      const g = STACK[garment.slot];
      if (regime === 'plate') {
        const size = g.plate * width;
        // The plate's hem sits at PLATE_HEM of its own square, so the square's
        // top edge is that much above the hem line the table asked for.
        return {
          garment,
          size,
          x: (g.cx - g.plate / 2) * width,
          y: g.hem * width - PLATE_HEM * size,
        };
      }
      const size = g.tile * width;
      // A tile has no internal anchor — the photograph fills it — so the tile's
      // own bottom edge is the hem, fanned out of the stack.
      return {
        garment,
        size,
        x: (g.cx + g.fanX - g.tile / 2) * width,
        y: (g.hem + g.fanY) * width - size,
      };
    });
}

/**
 * The plate render for a garment, if there is one.
 *
 * `Garment` is the styling engine's reduction of an item row and the plate
 * column landed after it was written, so the field is read structurally —
 * exactly the widening `toGarment` already does for `fit` and `pattern_scale`.
 * The day the projection carries `platePath` outright, this keeps working.
 */
export function platePathOf(garment: Garment): string | null {
  return (garment as Garment & { platePath?: string | null }).platePath ?? null;
}

/**
 * Which regime a look renders in. All or nothing, on purpose: a stack that is
 * half ghost-mannequin cutout and half photo tile does not read as a style, it
 * reads as a bug. One missing plate and the whole look falls back to tiles.
 */
export function stackRegime(
  pieces: Garment[],
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined,
): StackRegime {
  return pieces.length > 0 && pieces.every((g) => resolveImage(platePathOf(g)))
    ? 'plate'
    : 'tile';
}

/**
 * One garment in a stack tile — the cutout photograph when one exists,
 * otherwise an honest colour swatch. Shared between the in-app plate and the
 * share card so the artifact is pixel-for-pixel the thing the user saw.
 *
 * This is the FALLBACK regime's content. When a garment has a plate render the
 * stack draws it in Skia instead, where the shadow can be derived from the
 * cutout's own alpha — the studio ghost-mannequin effect this comment used to
 * promise and only a rectangular shadow could deliver.
 *
 * `paper` is print mode, for the share card: the no-colour fallback uses the
 * card's fixed paper palette instead of the live theme (a dark-mode phone must
 * not leak a dark swatch onto the light artifact), text does not scale with
 * Dynamic Type (the card's geometry is fixed), and the image fade is disabled
 * (view-shot would otherwise capture garments mid-transition, at partial
 * opacity).
 */
export function GarmentCell({
  garment,
  uri,
  paper = false,
}: {
  garment: Garment;
  uri?: string;
  paper?: boolean;
}) {
  const theme = useTheme();

  if (uri) {
    return (
      <Image
        source={stableImageSource(uri)}
        contentFit="contain"
        transition={paper ? 0 : 200}
        cachePolicy="memory-disk"
        style={{ width: '100%', height: '100%' }}
        accessibilityIgnoresInvertColors
      />
    );
  }

  // No cutout yet — background removal needs a native module that cannot run
  // in the Simulator, so this path is the norm right now. The garment's real
  // colour is honest: it is the value the palette rules actually scored. Text
  // flips using OKLCH lightness — the perceptual space is exactly for this.
  return (
    <View
      className="h-full w-full items-center justify-center overflow-hidden px-1"
      style={{
        backgroundColor: garment.colors[0]
          ? oklchToHex(garment.colors[0].oklch)
          : paper
            ? '#F0ECE3'
            : theme.tray,
      }}>
      <Text
        variant="caption"
        numberOfLines={2}
        className="text-center"
        maxFontSizeMultiplier={paper ? 1 : undefined}
        style={{
          color: (garment.colors[0]?.oklch.L ?? 1) < 0.55 ? '#FFFFFFCC' : '#1C1A16AA',
        }}>
        {garment.subcategory ?? garment.category}
      </Text>
    </View>
  );
}
