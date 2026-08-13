/**
 * The photo-evidence harness, and the photographs it does not have.
 *
 * ── The blocker is the headline, not a footnote ───────────────────────────
 *
 * Workstream 9 asks for 40–50 permissioned real photographs with hand-verified
 * tags, and says what to do when they do not exist: build the harness, use
 * every representative sample available, and record the missing count as an
 * explicit founder/input blocker rather than pretending catalogue imagery
 * proves camera-photo quality. This repository has ZERO permissioned user
 * photographs, so this suite reports `0/40` as a blocker on every run and the
 * runner exits non-zero because of it. That is the intended behaviour: a green
 * scorecard here would be a claim nobody has evidence for.
 *
 * What the synthetic vectors below genuinely establish is narrower than what
 * the plan wants, and the difference is worth stating precisely. They prove the
 * DECISION LOGIC is correct given a measurement: that 59 sharpness is refused
 * and 61 accepted, that five hash bits apart is one photograph and six is two,
 * that the fast path cannot be reached on brand, colour and class alone. They
 * prove nothing whatever about CALIBRATION — whether 60 is the right sharpness
 * floor for a phone camera in a bedroom is a question only photographs answer,
 * and no arrangement of made-up numbers can stand in for them.
 *
 * ── How the real photographs will arrive ──────────────────────────────────
 *
 * Never through this repository. `CINCH_EVAL_PHOTO_MANIFEST` names a path,
 * outside the working tree, to a JSON manifest of authenticated storage
 * references and their hand-verified tags:
 *
 *   { "references": [ { "ref": "<private storage key>", "tags": { … } }, … ] }
 *
 * The suite reads only the COUNT of entries unless the reader is running with
 * the storage credentials, so an absent manifest degrades to a shortfall rather
 * than an error. Committing images, signed URLs or storage paths would put user
 * photographs in git history, which the plan forbids outright and which no
 * later deletion undoes.
 *
 * ── Imports ───────────────────────────────────────────────────────────────
 *
 * `photo-evidence-rules.ts` rather than `photo-evidence.ts`, and `photo-match`
 * rather than anything that touches the camera: the first reaches the native
 * module and therefore React Native, which the esbuild bundle cannot parse.
 * Same precedent as `local-speech-policy.ts`. The split already existed; this
 * suite only depends on it.
 */

import {
  isProbableDuplicate,
  hashDistance,
  qualityFromMeasurements,
  type NativePhotoQuality,
} from '@/features/intake/photo-evidence-rules';
import {
  clearsFastPath,
  photoQuality,
  rankCandidates,
  type FeaturePrint,
  type LocalPhotoEvidence,
  type PhotoQuality,
  type UserCorrection,
} from '@/features/intake/photo-match';
import type { CatalogueFamily } from '@/features/catalogue/types';
import {
  MAX_DIAGNOSTICS,
  corpusPath,
  rate,
  type EvalSuite,
  type SuiteResult,
  type Threshold,
} from '../harness.ts';
import { readFileSync } from 'node:fs';

/** The plan's floor. Not a target we chose — the number it asks for. */
const REQUIRED_PERMISSIONED_PHOTOGRAPHS = 40;

/** Where a founder-supplied manifest of private references is named. */
const MANIFEST_ENV = 'CINCH_EVAL_PHOTO_MANIFEST';

type QualityCase = {
  id: string;
  sharpness: number | null;
  meanLuminance: number | null;
  clippedHighlights: number | null;
  clippedShadows: number | null;
  coverage: number | null;
  expected: NativePhotoQuality;
};

type CoverageCase = { id: string; coverage: number | null; expected: PhotoQuality };

type DuplicateCase = {
  id: string;
  a: string | null;
  b: string | null;
  expectedDistance: number | null;
  expectedDuplicate: boolean;
};

type MatchCase = {
  id: string;
  evidence: {
    ocrText: string | null;
    colours: { name: string; share: number }[];
    subjectCoverage: number | null;
    featurePrint: FeaturePrint | null;
  };
  garmentClass: string | null;
  correction: UserCorrection | null;
  prints: Record<string, FeaturePrint>;
  expectedTop: string | null;
  expectedFastPath: boolean;
};

type Corpus = {
  quality: QualityCase[];
  coverage: CoverageCase[];
  duplicates: DuplicateCase[];
  families: CatalogueFamily[];
  matches: MatchCase[];
};

function loadCorpus(): Corpus {
  return JSON.parse(readFileSync(corpusPath('vision-measurements.json'), 'utf8')) as Corpus;
}

/**
 * How many permissioned photographs are actually available.
 *
 * Reads a count and nothing else. The manifest is deliberately outside the
 * repository, so the common answer is zero and the honest report of zero is the
 * point of the function.
 */
function permissionedPhotographCount(): number {
  const manifestPath = process.env[MANIFEST_ENV];
  if (!manifestPath) return 0;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { references?: unknown[] };
    return Array.isArray(manifest.references) ? manifest.references.length : 0;
  } catch {
    // Absent, unreadable or malformed all land here and all mean the same
    // thing: no evidence. Reported as a shortfall rather than thrown, because
    // the harness's job is to say what is missing, not to refuse to run.
    // (`existsSync` would have been the obvious guard; the repository's
    // `node:fs` ambient declaration deliberately exposes only the three calls
    // the tests use, and widening it is not this workstream's business.)
    return 0;
  }
}

const thresholds: readonly Threshold[] = [
  {
    metric: 'qualityVerdictAccuracy',
    // Twenty synthetic vectors either side of every boundary in
    // `photo-evidence-rules.ts`. These are the module's own constants read back
    // as behaviour, so anything below one is an off-by-one in a gate that
    // decides whether somebody is asked to retake a photograph.
    min: 1,
    why: 'Each vector sits one unit either side of a declared constant; a miss is an off-by-one in a user-facing gate.',
  },
  {
    metric: 'duplicateAccuracy',
    // Includes the non-hex case that once compared as sixteen zeroes because
    // `NaN ^ n` is 0 in JavaScript. That bug read as a plausible distance,
    // which is why the corpus feeds it rubbish deliberately.
    min: 1,
    why: 'Covers the non-hex hash that once coerced to distance zero; a silent wrong distance merges two garments.',
  },
  {
    metric: 'matchRankingAccuracy',
    // The top candidate, and whether the fast path opens. Both are arithmetic
    // over declared weights, so there is no honest slack here.
    min: 1,
    why: 'Ranking is a weighted sum of declared signals; every case is exactly computable.',
  },
  {
    metric: 'fastPathPrecisionWithoutPrint',
    // The one that would cost real money if it slipped: a candidate clearing
    // the threshold on brand, colour and class alone would show a user a
    // licensed product as an identification of THEIR garment, on evidence that
    // cannot tell three white t-shirts apart.
    min: 1,
    why: 'Brand, colour and class cannot identify a garment; a fast path opening without a print is a false identification.',
  },
];

function run(): SuiteResult {
  const corpus = loadCorpus();
  const diagnostics: string[] = [];

  let qualityChecked = 0;
  let qualityCorrect = 0;
  for (const kase of corpus.quality) {
    qualityChecked += 1;
    const measurements =
      kase.sharpness === null
        ? null
        : {
            sharpness: kase.sharpness,
            meanLuminance: kase.meanLuminance!,
            clippedHighlights: kase.clippedHighlights!,
            clippedShadows: kase.clippedShadows!,
          };
    const got = qualityFromMeasurements(measurements, kase.coverage);
    if (got === kase.expected) qualityCorrect += 1;
    else diagnostics.push(`${kase.id}: quality expected ${kase.expected}, got ${got}`);
  }

  for (const kase of corpus.coverage) {
    qualityChecked += 1;
    const evidence: LocalPhotoEvidence = {
      ocrText: null,
      featurePrint: null,
      colours: [],
      subjectCoverage: kase.coverage,
    };
    const got = photoQuality(evidence);
    if (got === kase.expected) qualityCorrect += 1;
    else diagnostics.push(`${kase.id}: coverage verdict expected ${kase.expected}, got ${got}`);
  }

  let duplicateCorrect = 0;
  for (const kase of corpus.duplicates) {
    const distance = hashDistance(kase.a, kase.b);
    const duplicate = isProbableDuplicate(kase.a, kase.b);
    if (distance === kase.expectedDistance && duplicate === kase.expectedDuplicate) {
      duplicateCorrect += 1;
    } else if (diagnostics.length < MAX_DIAGNOSTICS) {
      diagnostics.push(
        `${kase.id}: distance ${distance} / duplicate ${duplicate}, expected ${kase.expectedDistance} / ${kase.expectedDuplicate}`,
      );
    }
  }

  let matchCorrect = 0;
  let printlessChecked = 0;
  let printlessRefused = 0;
  for (const kase of corpus.matches) {
    const evidence: LocalPhotoEvidence = {
      ocrText: kase.evidence.ocrText,
      featurePrint: kase.evidence.featurePrint,
      colours: kase.evidence.colours,
      subjectCoverage: kase.evidence.subjectCoverage,
    };
    const ranked = rankCandidates({
      families: corpus.families,
      evidence,
      garmentClass: kase.garmentClass,
      correction: kase.correction ?? undefined,
      prints: new Map(Object.entries(kase.prints)),
    });
    const top = ranked[0]?.colourway.externalId ?? null;
    const fast = clearsFastPath(ranked);

    if (top === kase.expectedTop && fast === kase.expectedFastPath) matchCorrect += 1;
    else if (diagnostics.length < MAX_DIAGNOSTICS) {
      diagnostics.push(
        `${kase.id}: top ${top} / fastPath ${fast}, expected ${kase.expectedTop} / ${kase.expectedFastPath}`,
      );
    }

    if (!kase.evidence.featurePrint) {
      printlessChecked += 1;
      if (!fast) printlessRefused += 1;
      else diagnostics.push(`${kase.id}: fast path opened with no feature print`);
    }
  }

  const available = permissionedPhotographCount();
  const shortfall = Math.max(0, REQUIRED_PERMISSIONED_PHOTOGRAPHS - available);

  return {
    id: 'garment-vision',
    title: 'Garment vision — photo evidence rules',
    caseCount:
      corpus.quality.length + corpus.coverage.length + corpus.duplicates.length + corpus.matches.length,
    metrics: {
      qualityVerdictAccuracy: rate(qualityCorrect, qualityChecked),
      duplicateAccuracy: rate(duplicateCorrect, corpus.duplicates.length),
      matchRankingAccuracy: rate(matchCorrect, corpus.matches.length),
      fastPathPrecisionWithoutPrint: rate(printlessRefused, printlessChecked),
    },
    counters: {
      syntheticVectors: corpus.quality.length + corpus.coverage.length + corpus.duplicates.length,
      permissionedPhotographs: available,
      requiredPermissionedPhotographs: REQUIRED_PERMISSIONED_PHOTOGRAPHS,
      sampleShortfall: shortfall,
      /**
       * Every case, because the fast path never opens without a feature print
       * and prints arrive with the native packet. This is the measured AI spend
       * of the photo path today: one call per import.
       */
      importsSpendingAnAiCall: printlessChecked,
    },
    diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS),
    blockers: shortfall
      ? [
          `${available}/${REQUIRED_PERMISSIONED_PHOTOGRAPHS} permissioned photographs — founder input blocker. ` +
            `Synthetic vectors verify the decision logic; they cannot calibrate a threshold against a real camera. ` +
            `Supply a manifest path in ${MANIFEST_ENV}; never commit images or signed URLs.`,
        ]
      : [],
  };
}

export const suite: EvalSuite = {
  id: 'garment-vision',
  title: 'Garment vision — photo evidence rules',
  thresholds,
  run,
};
