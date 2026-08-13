/**
 * Native measurements, turned into the contract Packet 4 already wrote.
 *
 * `photo-match.ts` defined `LocalPhotoEvidence` with `ocrText` and
 * `featurePrint` typed and permanently null, because Apple Vision needs native
 * code. This file is the native code arriving: nothing in `photo-match.ts`
 * changed, and nothing needed to. That was the point of writing the contract
 * first.
 *
 * ── The one thing this file owns ───────────────────────────────────────────
 *
 * THE THRESHOLDS. The native side returns numbers — a Laplacian variance, a
 * mean luminance, a clipping fraction — and deliberately no verdicts. Turning
 * those into "too blurry to file" happens here, in JavaScript, so a
 * recalibration ships in an OTA rather than a store build. A threshold is the
 * single thing in this pipeline most likely to be wrong first, and it should
 * not be welded into a binary.
 *
 * The numbers below are starting points, chosen from the measure's own
 * behaviour rather than from a study: a 256px-short-edge Laplacian variance
 * sits in the low hundreds for a sharp garment photograph and in the low tens
 * for a smeared one. They are named constants for exactly that reason — the
 * evaluation packet is where they get calibrated against real photographs, and
 * a magic number buried in a conditional cannot be.
 */

import { GarmentVision } from '../../../modules/garment-cutout';

import type { FeaturePrint, LocalPhotoEvidence } from './photo-match';
import { qualityFromMeasurements, type NativePhotoQuality } from './photo-evidence-rules';

export * from './photo-evidence-rules';

// ---------------------------------------------------------------------------
// Thresholds — JS-side, deliberately
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Gathering
// ---------------------------------------------------------------------------

export type PhotoEvidence = LocalPhotoEvidence & {
  /** 16 hex characters, or null. Compared only against this user's own imports. */
  duplicateHash: string | null;
  /** The verdict, from the thresholds above. */
  quality: NativePhotoQuality;
};

/**
 * Measure one photograph.
 *
 * Never throws and never blocks intake. Every field degrades to null, which the
 * contract already models as "we did not measure this" — the same shape it had
 * when the native module did not exist. A device without Vision, an
 * unreadable file and a Simulator all land in the same honest place.
 *
 * `colours` and `subjectCoverage` come from the CUTOUT, which already ran; they
 * are passed in rather than re-measured so one photograph is decoded twice at
 * most across the whole pipeline.
 */
export async function gatherPhotoEvidence(
  uri: string,
  fromCutout: { colours: readonly { name: string; share: number }[]; subjectCoverage: number | null },
): Promise<PhotoEvidence> {
  const empty: PhotoEvidence = {
    ocrText: null,
    featurePrint: null,
    colours: fromCutout.colours,
    subjectCoverage: fromCutout.subjectCoverage,
    duplicateHash: null,
    quality: 'unmeasured',
  };

  if (!GarmentVision) return empty;

  try {
    const measured = await GarmentVision.measure(uri, {
      ocr: true,
      featurePrint: true,
      quality: true,
      duplicateHash: true,
    });

    return {
      ocrText: measured.ocrText,
      featurePrint: measured.featurePrint as FeaturePrint | null,
      colours: fromCutout.colours,
      subjectCoverage: fromCutout.subjectCoverage,
      duplicateHash: measured.duplicateHash,
      quality: qualityFromMeasurements(measured.quality, fromCutout.subjectCoverage),
    };
  } catch {
    // A measurement failure must never cost somebody their photograph.
    return empty;
  }
}

