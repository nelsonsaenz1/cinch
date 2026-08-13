/**
 * The native contract for the measurements, mirrored by hand.
 *
 * Exactly what `GarmentVisionModule.swift` and `LocalSpeechModule.swift`
 * return, and nothing more — no product vocabulary, no thresholds, no UI
 * states. `src/features/intake/photo-evidence.ts` is where these become
 * something the app understands, and it is the only file allowed to import
 * from here. Same rule the cutout's own types file states, for the same reason.
 */

// ---------------------------------------------------------------------------
// Vision
// ---------------------------------------------------------------------------

export type VisionCapabilities = {
  ocr: boolean;
  featurePrint: boolean;
  quality: boolean;
  duplicateHash: boolean;
  /** Needs the Neural Engine, so false in the Simulator. */
  subjectLift: boolean;
  /** Two prints from different revisions are different spaces. Never compared. */
  featurePrintRevision: number;
  simulator: boolean;
};

export type NativeFeaturePrint = {
  values: number[];
  revision: number;
};

/**
 * Raw measurements. Numbers, never verdicts.
 *
 * The thresholds that turn these into "too blurry" live in JavaScript, so a
 * recalibration is an OTA rather than a store build — which matters, because a
 * threshold is the thing most likely to be wrong first.
 */
export type NativeQuality = {
  /** Variance of the Laplacian over a 256px-short-edge grey plane. */
  sharpness: number;
  /** 0..1. */
  meanLuminance: number;
  /** Share of pixels pinned at 255 / at 0. */
  clippedHighlights: number;
  clippedShadows: number;
};

export type MeasureResult = {
  /** Joined label text, or null when nothing was read. */
  ocrText: string | null;
  featurePrint: NativeFeaturePrint | null;
  quality: NativeQuality | null;
  /** 16 hex characters. See `differenceHash` for why it is deliberately weak. */
  duplicateHash: string | null;
};

export type MeasureOptions = {
  ocr?: boolean;
  featurePrint?: boolean;
  quality?: boolean;
  duplicateHash?: boolean;
  maxEdge?: number;
};

export type GarmentVisionNativeModule = {
  capabilities(): VisionCapabilities;
  measure(uri: string, options?: MeasureOptions): Promise<MeasureResult>;
};

// ---------------------------------------------------------------------------
// Speech
// ---------------------------------------------------------------------------

export type SpeechAuthorization = 'authorized' | 'denied' | 'restricted' | 'not_determined';

export type SpeechSupport = {
  simulator: boolean;
  locale: string;
  /** A recogniser exists for this locale at all. */
  localeSupported: boolean;
  /** The service is usable right now. */
  available: boolean;
  /**
   * The device holds an on-device model for this locale.
   *
   * The one that decides whether a local transcript is possible, and false on
   * plenty of real hardware — which is why the cloud path is offered
   * explicitly rather than reached silently.
   */
  onDeviceSupported: boolean;
  authorization: SpeechAuthorization;
};

/** Why a local transcript could not be produced. Each is a distinct offer. */
export type SpeechFailureReason =
  | 'not_authorized'
  | 'locale_unsupported'
  | 'unavailable'
  | 'on_device_unsupported'
  | 'recognition_failed';

export type SpeechResult =
  | { ok: true; transcript: string; confidence: number; onDevice: true }
  | { ok: false; reason: SpeechFailureReason; detail: string | null; onDevice: false };

export type LocalSpeechNativeModule = {
  support(locale?: string | null): SpeechSupport;
  requestAuthorization(): Promise<SpeechAuthorization>;
  transcribe(uri: string, locale?: string | null): Promise<SpeechResult>;
};
