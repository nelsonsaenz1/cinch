/**
 * Finding a photographed garment in the licensed catalogue, with the half of
 * the evidence that exists today.
 *
 * ── What this packet can and cannot do ─────────────────────────────────────
 *
 * The plan's fast path has four steps: OCR a visible label, query the catalogue
 * deterministically, rank bounded candidate thumbnails by feature-print
 * distance, and fall back to consent-gated vision when that is inconclusive.
 *
 * TWO OF THOSE FOUR NEED APPLE VISION, which needs native code, which is the
 * next packet. This file implements the other two and defines the contract the
 * native half will satisfy — as types and a pure ranking function that already
 * work, rather than as a plan. `LocalPhotoEvidence` below is that contract: it
 * is filled in today by the shipping cutout module (subject coverage, measured
 * colours) and gains `ocrText` and `featurePrint` when the native packet lands,
 * with nothing else changing.
 *
 * WHAT IT DELIBERATELY DOES NOT DO IS FAKE THE MISSING HALF. There is no
 * JS "OCR" here reading pixels, and no similarity metric invented out of colour
 * distance and called a feature print. Either would produce a number that looks
 * like the real one and behaves nothing like it, and the calibrated threshold
 * this path turns on would then be calibrated against a fiction.
 *
 * ── The rule that outranks everything ──────────────────────────────────────
 *
 * A user correction wins. Not as a tie-break — as a short circuit, evaluated
 * before any evidence is weighed, because a person looking at their own garment
 * is better evidence than any measurement of a photograph of it.
 */

import type { CatalogueColourway, CatalogueFamily } from '@/features/catalogue/types';

// ---------------------------------------------------------------------------
// The evidence contract — half implemented today, half in the native packet
// ---------------------------------------------------------------------------

/**
 * A non-reversible visual fingerprint of one photograph.
 *
 * Opaque by design: a float vector from Apple Vision, compared only to other
 * vectors from the same device and the same model version. It is NEVER sent
 * anywhere, never written to analytics, and never compared across users — the
 * plan's own line is "never a global cross-user photo index", and the way to
 * keep that true is for this type to exist only on the device.
 */
export type FeaturePrint = {
  /** Opaque vector. Length depends on the Vision revision that produced it. */
  values: readonly number[];
  /** The Vision revision, so two prints from different models are never compared. */
  revision: number;
};

export type LocalPhotoEvidence = {
  /**
   * Text lifted from a visible label, or null when there is no OCR available.
   *
   * NULL UNTIL THE NATIVE PACKET, and null is honest: it means "we did not
   * read a label", which is exactly what is true today.
   */
  ocrText: string | null;
  /** Null until the native packet, for the same reason. */
  featurePrint: FeaturePrint | null;
  /**
   * Colours measured from the actual pixels, largest share first.
   *
   * AVAILABLE TODAY — `modules/garment-cutout` already returns these, measured
   * on-device from the lifted subject rather than named by a model.
   */
  colours: readonly { name: string; share: number }[];
  /**
   * How much of the frame the lifted garment fills, 0..1. Available today.
   *
   * Used as a quality signal rather than a match signal: a subject filling 4%
   * of the frame is a photograph of a room with a shirt in it.
   */
  subjectCoverage: number | null;
};

/** What the user typed, which beats every measurement below. */
export type UserCorrection = {
  brand?: string | null;
  category?: string | null;
  colour?: string | null;
};

// ---------------------------------------------------------------------------
// Quality gates — deterministic, and available now
// ---------------------------------------------------------------------------

/**
 * A photograph too far from a garment to be worth matching.
 *
 * Coverage is the one framing measure the shipping module already gives us.
 * Blur and exposure need native buffers and arrive with the native packet;
 * their absence is why this returns a REASON rather than a score — a caller
 * must not be able to mistake "we only checked one thing" for "it passed".
 */
export type PhotoQuality = 'ok' | 'subject_too_small' | 'no_subject' | 'unmeasured';

/** The fraction below which the garment is a detail in a picture of a room. */
export const MIN_SUBJECT_COVERAGE = 0.12;

export function photoQuality(evidence: LocalPhotoEvidence): PhotoQuality {
  if (evidence.subjectCoverage === null) return 'unmeasured';
  if (evidence.subjectCoverage <= 0) return 'no_subject';
  if (evidence.subjectCoverage < MIN_SUBJECT_COVERAGE) return 'subject_too_small';
  return 'ok';
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Cosine distance between two feature prints, 0 (identical) to 1.
 *
 * Written now, unused until the native packet supplies prints, and tested
 * against hand-built vectors — so the day Vision starts returning them the only
 * new thing is the data. Refuses to compare across revisions: two prints from
 * different Vision models are different spaces, and a number computed between
 * them would be meaningless and confident.
 */
export function featureDistance(a: FeaturePrint, b: FeaturePrint): number | null {
  if (a.revision !== b.revision) return null;
  if (a.values.length !== b.values.length || a.values.length === 0) return null;

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.values.length; i += 1) {
    dot += a.values[i]! * b.values[i]!;
    magA += a.values[i]! * a.values[i]!;
    magB += b.values[i]! * b.values[i]!;
  }
  if (magA === 0 || magB === 0) return null;
  const cosine = dot / (Math.sqrt(magA) * Math.sqrt(magB));
  return Math.min(1, Math.max(0, (1 - cosine) / 2));
}

export type MatchCandidate = {
  family: CatalogueFamily;
  colourway: CatalogueColourway;
  /** 0..1, higher is better. Composed only from evidence that exists. */
  score: number;
  /** Which signals actually contributed. Printed nowhere; asserted in tests. */
  signals: ('brand' | 'colour' | 'class' | 'feature_print')[];
};

/**
 * The calibrated threshold above which candidates are shown without vision AI.
 *
 * DELIBERATELY UNREACHABLE without a feature print. The plan says a local match
 * that clears the threshold skips the model; with only brand, colour and class
 * agreeing, a "match" is a search result, not an identification — three cotton
 * t-shirts from the same maker in the same colour are indistinguishable on
 * those three fields alone. Rather than lower the bar to what today's evidence
 * can reach, the bar stays where the measurement will be and the fallback runs.
 * `tests/photo-match.test.ts` pins that this is unreachable today.
 */
export const FAST_PATH_THRESHOLD = 0.82;

const SIGNAL_WEIGHT = {
  /** Only ever from OCR or a correction — never a model's guess. */
  brand: 0.3,
  colour: 0.15,
  class: 0.1,
  /** The one that can actually identify a garment. Native. */
  feature_print: 0.45,
} as const;

/**
 * Rank bounded catalogue candidates against what we measured.
 *
 * `candidates` is already bounded by the caller — the plan says download only
 * bounded thumbnails, and the bound belongs at the fetch, not here.
 */
export function rankCandidates({
  families,
  evidence,
  garmentClass,
  correction,
  prints,
}: {
  families: readonly CatalogueFamily[];
  evidence: LocalPhotoEvidence;
  /** The validated class from tagging, when there is one. */
  garmentClass: string | null;
  correction?: UserCorrection;
  /** Feature prints for candidate thumbnails, by `externalId`. Native. */
  prints?: ReadonlyMap<string, FeaturePrint>;
}): MatchCandidate[] {
  // The short circuit. A brand the user typed is not weighed against a
  // measurement — it replaces the question.
  const brandTruth = correction?.brand?.trim()?.toLowerCase() ?? null;
  const ocr = evidence.ocrText?.toLowerCase() ?? null;
  const measured = evidence.colours[0]?.name?.toLowerCase() ?? null;
  const colourTruth = correction?.colour?.trim()?.toLowerCase() ?? measured;

  const out: MatchCandidate[] = [];

  for (const family of families) {
    const familyBrand = family.brand?.toLowerCase() ?? null;

    for (const colourway of family.colours) {
      const signals: MatchCandidate['signals'] = [];
      let score = 0;

      /**
       * Brand, from a correction or from OCR — never from the family alone,
       * which would be scoring a candidate against itself.
       *
       * WHEN THE USER HAS TYPED A BRAND, OCR STOPS SCORING ENTIRELY. Not
       * "ranks lower": a correction is the person telling us what the garment
       * is, and letting a label reading still push a different maker up the
       * list means the correction can lose to a photograph of a swing tag. The
       * fixture that caught this had a user typing Uniqlo over OCR reading
       * "james perse", and the James Perse family came back first.
       */
      if (brandTruth) {
        if (familyBrand && familyBrand.includes(brandTruth)) {
          score += SIGNAL_WEIGHT.brand;
          signals.push('brand');
        }
      } else if (familyBrand && ocr && ocr.includes(familyBrand)) {
        score += SIGNAL_WEIGHT.brand;
        signals.push('brand');
      }

      if (colourTruth && colourway.label.toLowerCase().includes(colourTruth)) {
        score += SIGNAL_WEIGHT.colour;
        signals.push('colour');
      }

      if (garmentClass && family.productClass === garmentClass) {
        score += SIGNAL_WEIGHT.class;
        signals.push('class');
      }

      const mine = evidence.featurePrint;
      const theirs = prints?.get(colourway.externalId);
      if (mine && theirs) {
        const distance = featureDistance(mine, theirs);
        if (distance !== null) {
          score += SIGNAL_WEIGHT.feature_print * (1 - distance);
          signals.push('feature_print');
        }
      }

      if (signals.length) out.push({ family, colourway, score, signals });
    }
  }

  return out.sort(
    (a, b) => b.score - a.score || a.colourway.externalId.localeCompare(b.colourway.externalId),
  );
}

/**
 * Whether the local evidence is enough to skip the vision model.
 *
 * Today this is always false, and that is the honest answer rather than a
 * limitation to work around — see `FAST_PATH_THRESHOLD`. When it is true the
 * caller shows licensed candidates and spends NO AI quota, which is the whole
 * point of the path.
 */
export function clearsFastPath(ranked: readonly MatchCandidate[]): boolean {
  const top = ranked[0];
  if (!top) return false;
  // A feature print is required, not merely helpful: without it the score is
  // agreement about a category, not an identification.
  if (!top.signals.includes('feature_print')) return false;
  return top.score >= FAST_PATH_THRESHOLD;
}
