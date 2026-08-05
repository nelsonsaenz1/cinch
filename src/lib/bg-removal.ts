import { GarmentCutout } from '../../modules/garment-cutout';

/**
 * Background removal — the single swap point for the cutout provider.
 *
 * Behind this interface is `modules/garment-cutout`, a local Expo module wrapping
 * Apple Vision's `VNGenerateForegroundInstanceMaskRequest` — the model behind
 * "Copy Subject" in Photos. It is local rather than a dependency because the
 * published wrappers for this API are single-maintainer packages a few weeks old
 * and this sits on the app's primary screen; the Swift involved is ~400 lines and
 * owning it costs less than owning the risk. Nothing outside this file may import
 * the module. Swapping to a server-side matting service is then a change to one
 * function rather than to three screens.
 *
 * Constraints that shaped this API, all still true:
 *  - Subject lifting is iOS 17+, and does NOT run in the Simulator — it needs the
 *    Neural Engine. `isSupported()` must be checked before every batch, and the
 *    UI needs a real fallback rather than an empty grid.
 *  - Vision is trained on *salient subjects*, not garments. It will sometimes
 *    lift the hanger, a hand, or the mannequin. So the result carries every
 *    detected subject, and the caller is expected to offer a "wrong one, retry"
 *    affordance. Subjects are ordered by mask area, largest first, which is a
 *    much better default than Vision's own index order — but it is a default,
 *    not a guarantee.
 *  - The native pass decodes at a bounded resolution and releases every pixel
 *    buffer before it returns, so there is nothing for callers to dispose. That
 *    is the reason this returns file URIs rather than native handles: three
 *    concurrent jobs holding full-resolution buffers is what gets a 60-photo
 *    import killed by jetsam.
 *
 * What the same pass now also produces, because it already has the pixels:
 *  - `plate`: the largest subject scale-normalized onto a fixed transparent
 *    square canvas (see `PLATE_TARGET_FILL`), so stacked garments share a scale.
 *  - `colors`: real measured colours, clustered in OKLab from pixels the mask
 *    calls fully opaque. The tagging model only ever returns colour *names*.
 */

/** A lifted subject, written as a transparent PNG in the app cache. */
export type Cutout = {
  /** file:// URI of a transparent PNG. */
  uri: string;
  width: number;
  height: number;
  /** Opaque pixels as a fraction of the source frame, 0..1. Drives the ordering. */
  areaFraction: number;
};

/** The plate-ready render: one garment, known scale, known baseline. */
export type PlateRender = {
  uri: string;
  width: number;
  height: number;
};

/** A measured colour and the share of the garment it covers. */
export type Swatch = {
  /** Lowercase `#rrggbb`. */
  hex: string;
  /** 0..1, summing to 1 across the returned swatches. */
  share: number;
};

export type RemoveResult =
  | {
      ok: true;
      subjects: Cutout[];
      /** Null when the render failed. The cutout is still usable on its own. */
      plate: PlateRender | null;
      colors: Swatch[];
    }
  /**
   * Not an exception — an unliftable photo is an ordinary outcome (a flat-lay
   * on a patterned rug, white-on-white, sheer fabric). The item still saves
   * with its original photo; it just has no cutout yet.
   */
  | { ok: false; reason: 'unsupported-device' | 'no-subject' | 'failed'; message?: string };

export type RemoveOptions = {
  /**
   * Fraction of the plate canvas the garment's long edge should fill. Defaults
   * to `DEFAULT_PLATE_TARGET_FILL`; pass a value from `PLATE_TARGET_FILL` once
   * the garment's category is known.
   */
  targetFill?: number;
};

export interface BackgroundRemover {
  isSupported(): Promise<boolean>;
  remove(imageUri: string, options?: RemoveOptions): Promise<RemoveResult>;
}

// ---------------------------------------------------------------------------
// Plate geometry
// ---------------------------------------------------------------------------

/**
 * How much of the plate canvas each kind of garment should fill.
 *
 * These numbers are the entire reason a plate reads as an outfit rather than as
 * clip art. A raw cutout carries the photographer's distance, not the garment's
 * size, so a ring shot at 20cm and a trench coat shot across a room arrive at
 * comparable pixel dimensions. Filling the canvas equally would render the ring
 * as large as the coat.
 *
 * The ratios are relative *body* presence, not literal garment measurements:
 * outerwear and dresses dominate, tops and bottoms are the middle register,
 * and shoes, bags and jewellery are punctuation. Nudge them together or the
 * relationships break.
 *
 * Keyed by the `items.category` vocabulary (`src/schemas/item.ts`) but typed
 * locally: this file sits below the schema layer and must stay importable by
 * the native module boundary and by renderers alike. `plateTargetFill` is the
 * intended entry point — it handles the two categories with no entry here.
 */
export type PlateSlot =
  | 'outerwear'
  | 'dress'
  | 'top'
  | 'bottom'
  | 'footwear'
  | 'bag'
  | 'accessory'
  | 'headwear';

export const PLATE_TARGET_FILL: Record<PlateSlot, number> = {
  outerwear: 0.92,
  dress: 0.92,
  top: 0.85,
  bottom: 0.85,
  footwear: 0.6,
  bag: 0.55,
  accessory: 0.45,
  headwear: 0.5,
};

/**
 * Used when the category is unknown — which at ingest it always is, because
 * tagging runs after the upload. Sits between the top/bottom register and the
 * outerwear one, so a mis-scaled item is wrong by a little in either direction
 * rather than wrong by a lot in one.
 */
export const DEFAULT_PLATE_TARGET_FILL = 0.88;

/** Edge of the square plate canvas, in pixels. Renderers should assume this. */
export const PLATE_CANVAS_SIZE = 1024;

/**
 * Where a garment's bottom edge sits, as a fraction of canvas height from the
 * top. A shared floor line rather than a shared centre is what lets a jacket
 * stack over trousers without either floating.
 */
export const PLATE_BASELINE = 0.94;

/** Resolve a raw `items.category` to its fill fraction. */
export function plateTargetFill(category: string | null | undefined): number {
  if (!category) return DEFAULT_PLATE_TARGET_FILL;
  // `jewelry` and `accessory` are separate tags but the same visual register;
  // `other` is a genuine unknown and takes the neutral default.
  const key = category === 'jewelry' ? 'accessory' : category;
  return PLATE_TARGET_FILL[key as PlateSlot] ?? DEFAULT_PLATE_TARGET_FILL;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/** Long edge Vision sees on the first attempt. Matches the upload resolution. */
const BASE_MAX_EDGE = 1024;

/**
 * Long edge for the single retry.
 *
 * Vision's saliency is genuinely scale-sensitive: the model has a fixed input
 * size, so the amount of context a garment occupies changes what it considers
 * foreground. A shirt missed at 1024px is sometimes found at 1536px. One retry
 * only — a second Vision pass roughly doubles the cutout cost of an import, and
 * the measured yield beyond the first retry does not pay for a third.
 */
const RETRY_MAX_EDGE = 1536;

const UNSUPPORTED_MESSAGE =
  'Cutouts need a development build on a physical iPhone running iOS 17 or later.';

class VisionRemover implements BackgroundRemover {
  async isSupported(): Promise<boolean> {
    return GarmentCutout?.isAvailable() ?? false;
  }

  async remove(imageUri: string, options?: RemoveOptions): Promise<RemoveResult> {
    if (!GarmentCutout) {
      return { ok: false, reason: 'unsupported-device', message: UNSUPPORTED_MESSAGE };
    }

    const shared = {
      targetFill: options?.targetFill ?? DEFAULT_PLATE_TARGET_FILL,
      canvasSize: PLATE_CANVAS_SIZE,
      baseline: PLATE_BASELINE,
    };

    try {
      let result = await GarmentCutout.analyze(imageUri, { ...shared, maxEdge: BASE_MAX_EDGE });

      if (result.outcome === 'no-subject') {
        result = await GarmentCutout.analyze(imageUri, { ...shared, maxEdge: RETRY_MAX_EDGE });
      }

      if (result.outcome === 'unsupported') {
        return { ok: false, reason: 'unsupported-device', message: UNSUPPORTED_MESSAGE };
      }
      if (result.outcome !== 'ok' || result.subjects.length === 0) {
        return { ok: false, reason: 'no-subject' };
      }

      return { ok: true, subjects: result.subjects, plate: result.plate, colors: result.colors };
    } catch (err) {
      return {
        ok: false,
        reason: 'failed',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/**
 * FOLLOW-UPS, deliberately not in this round:
 *
 *  - SALIENCY CROP. `VNGenerateAttentionBasedSaliencyImageRequest` gives a
 *    heat map even when instance segmentation finds no discrete object, so a
 *    garment lying flat on a busy duvet could still be cropped to roughly the
 *    right region and shown as a tighter thumbnail. It produces a crop, not a
 *    matte, so it cannot feed the plate — a different result shape and a
 *    different UI promise, which is why it is not bolted on here.
 *  - HUMAN DETECTION. `VNDetectHumanRectanglesRequest` would let a worn-outfit
 *    photo be handled honestly (crop to the person, decline the cutout) rather
 *    than lifting the wearer and calling them a garment. Needs a product
 *    decision about what the app says when it sees a person, not just code.
 *  - SERVER-SIDE MATTING FALLBACK. Whether this is needed at all is what the
 *    `cutout_result` event measures. If `no-subject` stays under a few percent
 *    of imports, paying for a hosted matting model would be spending money to
 *    fix a problem the device already solved.
 */
export const backgroundRemover: BackgroundRemover = new VisionRemover();
