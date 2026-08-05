/**
 * The native contract, mirrored by hand.
 *
 * These types describe exactly what `GarmentCutoutModule.swift` returns and
 * nothing more — no product vocabulary, no UI states. `src/lib/bg-removal.ts` is
 * where this becomes something the app understands, and it is the only file
 * allowed to import from here.
 */

/** One lifted foreground instance, written as a transparent PNG. */
export type NativeSubject = {
  /** `file://` URI in the app cache. Not durable across launches. */
  uri: string;
  width: number;
  height: number;
  /** Opaque pixels as a fraction of the whole source frame, 0..1. */
  areaFraction: number;
};

/** The largest subject, scale-normalized onto the square plate canvas. */
export type NativePlate = {
  uri: string;
  width: number;
  height: number;
};

/** A measured colour and how much of the garment it covers. */
export type NativeSwatch = {
  /** Lowercase `#rrggbb`. */
  hex: string;
  /** Share of sampled opaque pixels, 0..1. */
  share: number;
};

export type AnalyzeOutcome =
  | 'ok'
  /** Vision ran and found nothing liftable. An ordinary photo outcome. */
  | 'no-subject'
  /** iOS below 17, or the Simulator, where the Neural Engine does not exist. */
  | 'unsupported';

export type AnalyzeResult = {
  outcome: AnalyzeOutcome;
  /** Sorted by `areaFraction`, largest first. Empty unless `outcome` is `ok`. */
  subjects: NativeSubject[];
  /** Null when the render failed — survivable, the cutout still exists. */
  plate: NativePlate | null;
  colors: NativeSwatch[];
};

export type AnalyzeOptions = {
  /** Long edge the source is decoded at before Vision sees it. Default 1024. */
  maxEdge?: number;
  /** Edge of the square plate canvas. Default 1024. */
  canvasSize?: number;
  /** Fraction of the canvas edge the garment's long edge fills. Default 0.88. */
  targetFill?: number;
  /** Where the garment's bottom edge lands, from the top. Default 0.94. */
  baseline?: number;
  /** Clusters the measured palette is reduced to. Default 3. */
  colorCount?: number;
};

export type GarmentCutoutNativeModule = {
  isAvailable(): boolean;
  analyze(uri: string, options?: AnalyzeOptions): Promise<AnalyzeResult>;
};
