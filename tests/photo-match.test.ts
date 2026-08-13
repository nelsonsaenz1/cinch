/**
 * Workstream 7's fast path — the half that exists without native code.
 *
 * The plan lists thirteen acceptance photographs. Some of them are decidable
 * today from the shipping cutout module's own measurements; the rest need Apple
 * Vision OCR, feature prints, and blur/exposure buffers, and those are named
 * explicitly at the bottom of this file rather than approximated.
 *
 * THE MOST IMPORTANT ASSERTION HERE IS A NEGATIVE ONE: the fast path cannot
 * clear its threshold today. Brand, colour and class agreeing is a search
 * result, not an identification — three cotton t-shirts from one maker in one
 * colour are identical on those fields — so the bar stays where the measurement
 * will be and the consent-gated fallback runs. Lowering it to what today's
 * evidence can reach is the one shortcut that would look like progress and ship
 * a wrong garment.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  clearsFastPath,
  featureDistance,
  photoQuality,
  rankCandidates,
  FAST_PATH_THRESHOLD,
  MIN_SUBJECT_COVERAGE,
  type FeaturePrint,
  type LocalPhotoEvidence,
} from '../src/features/intake/photo-match.ts';
import type { CatalogueFamily } from '../src/features/catalogue/types.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function family(id: string, brand: string | null, klass: string, colours: string[]): CatalogueFamily {
  return {
    familyId: id,
    brand,
    title: `${brand ?? ''} thing`.trim(),
    productClass: klass,
    category: null,
    gender: null,
    merchants: ['shop.example'],
    nearMissCut: null,
    colours: colours.map((label, i) => ({
      label,
      resolved: true,
      imageUrl: `https://img.example/${id}-${i}.jpg`,
      alternateImageUrl: null,
      externalId: `${id}-${i}`,
      sourceHost: 'shop.example',
      pageUrl: `https://shop.example/${id}-${i}`,
    })),
  };
}

const FAMILIES = [
  family('f1', 'James Perse', 'top', ['White', 'Navy']),
  family('f2', 'Uniqlo', 'top', ['White']),
  family('f3', 'James Perse', 'bottom', ['Black']),
];

const evidence = (over: Partial<LocalPhotoEvidence> = {}): LocalPhotoEvidence => ({
  ocrText: null,
  featurePrint: null,
  colours: [{ name: 'white', share: 0.8 }],
  subjectCoverage: 0.5,
  ...over,
});

const print = (values: number[], revision = 1): FeaturePrint => ({ values, revision });

// ---------------------------------------------------------------------------
// 1 · Photo quality, from the one framing measure that ships today
// ---------------------------------------------------------------------------

test('a garment filling the frame is fine', () => {
  assert.equal(photoQuality(evidence({ subjectCoverage: 0.6 })), 'ok');
});

test('a garment that is a detail in a photograph of a room is refused', () => {
  assert.equal(photoQuality(evidence({ subjectCoverage: 0.04 })), 'subject_too_small');
  assert.ok(MIN_SUBJECT_COVERAGE > 0.04);
});

test('no subject at all is its own outcome', () => {
  assert.equal(photoQuality(evidence({ subjectCoverage: 0 })), 'no_subject');
});

test('unmeasured is never reported as ok', () => {
  // The Simulator and iOS below 17 return no coverage. "We did not check" must
  // not be indistinguishable from "it passed".
  assert.equal(photoQuality(evidence({ subjectCoverage: null })), 'unmeasured');
});

// ---------------------------------------------------------------------------
// 2 · Feature-print distance, written now, unused until the native packet
// ---------------------------------------------------------------------------

test('an identical print is distance zero', () => {
  assert.equal(featureDistance(print([1, 0, 0]), print([1, 0, 0])), 0);
});

test('an opposite print is distance one', () => {
  assert.equal(featureDistance(print([1, 0]), print([-1, 0])), 1);
});

test('an orthogonal print is half way', () => {
  assert.equal(featureDistance(print([1, 0]), print([0, 1])), 0.5);
});

test('prints from different Vision revisions are never compared', () => {
  assert.equal(featureDistance(print([1, 0], 1), print([1, 0], 2)), null);
});

test('mismatched or empty vectors return null rather than a number', () => {
  assert.equal(featureDistance(print([1, 0]), print([1, 0, 0])), null);
  assert.equal(featureDistance(print([]), print([])), null);
  assert.equal(featureDistance(print([0, 0]), print([1, 0])), null);
});

// ---------------------------------------------------------------------------
// 3 · Ranking from evidence that exists
// ---------------------------------------------------------------------------

test('a measured colour ranks the matching colourway first', () => {
  const ranked = rankCandidates({ families: FAMILIES, evidence: evidence(), garmentClass: 'top' });
  assert.equal(ranked[0]!.colourway.label, 'White');
  assert.ok(ranked[0]!.signals.includes('colour'));
});

test('the validated class contributes', () => {
  const ranked = rankCandidates({ families: FAMILIES, evidence: evidence(), garmentClass: 'top' });
  assert.ok(ranked[0]!.signals.includes('class'));
  const noClass = rankCandidates({ families: FAMILIES, evidence: evidence(), garmentClass: null });
  assert.ok(!noClass[0]!.signals.includes('class'));
});

test("a model's brand guess is not a signal — only OCR or a correction is", () => {
  // No OCR, no correction: the family's own brand cannot score against itself.
  const ranked = rankCandidates({ families: FAMILIES, evidence: evidence(), garmentClass: 'top' });
  assert.ok(!ranked.some((c) => c.signals.includes('brand')));
});

test('OCR text is a brand signal', () => {
  const ranked = rankCandidates({
    families: FAMILIES,
    evidence: evidence({ ocrText: 'james perse los angeles' }),
    garmentClass: 'top',
  });
  assert.ok(ranked[0]!.signals.includes('brand'));
  assert.equal(ranked[0]!.family.brand, 'James Perse');
});

test('a user correction outranks the measured colour', () => {
  const ranked = rankCandidates({
    families: FAMILIES,
    evidence: evidence({ colours: [{ name: 'white', share: 0.9 }] }),
    garmentClass: 'top',
    correction: { colour: 'Navy' },
  });
  assert.equal(ranked[0]!.colourway.label, 'Navy');
});

test('a user brand correction beats OCR saying otherwise', () => {
  const ranked = rankCandidates({
    families: FAMILIES,
    evidence: evidence({ ocrText: 'james perse' }),
    garmentClass: 'top',
    correction: { brand: 'Uniqlo' },
  });
  assert.equal(ranked[0]!.family.brand, 'Uniqlo');
});

test('a candidate with no matching signal at all is not offered', () => {
  const ranked = rankCandidates({
    families: [family('f9', 'Nobody', 'footwear', ['Green'])],
    evidence: evidence(),
    garmentClass: 'top',
  });
  assert.deepEqual(ranked, []);
});

test('ordering is stable for equal scores', () => {
  const a = rankCandidates({ families: FAMILIES, evidence: evidence(), garmentClass: 'top' });
  const b = rankCandidates({ families: FAMILIES, evidence: evidence(), garmentClass: 'top' });
  assert.deepEqual(a.map((c) => c.colourway.externalId), b.map((c) => c.colourway.externalId));
});

// ---------------------------------------------------------------------------
// 4 · The negative that matters: no fast path without a feature print
// ---------------------------------------------------------------------------

test('brand, colour and class agreeing is NOT enough to skip the model', () => {
  const ranked = rankCandidates({
    families: FAMILIES,
    evidence: evidence({ ocrText: 'james perse' }),
    garmentClass: 'top',
    correction: { brand: 'James Perse', colour: 'White' },
  });
  assert.equal(clearsFastPath(ranked), false, 'a search result was treated as an identification');
  assert.ok(ranked[0]!.score < FAST_PATH_THRESHOLD);
});

test('the fast path is unreachable today, by construction', () => {
  // Every signal available without native code, maxed. Still short.
  const best = 0.3 + 0.15 + 0.1;
  assert.ok(best < FAST_PATH_THRESHOLD, 'the threshold is reachable without a feature print');
});

test('a feature print plus agreement does clear it — the native packet', () => {
  const mine = print([1, 0, 0]);
  const prints = new Map([['f1-0', print([1, 0, 0])]]);
  const ranked = rankCandidates({
    families: FAMILIES,
    evidence: evidence({ featurePrint: mine, ocrText: 'james perse' }),
    garmentClass: 'top',
    prints,
  });
  assert.equal(ranked[0]!.colourway.externalId, 'f1-0');
  assert.equal(clearsFastPath(ranked), true);
});

test('a far feature print does not clear it even with everything else agreeing', () => {
  const prints = new Map([['f1-0', print([-1, 0, 0])]]);
  const ranked = rankCandidates({
    families: FAMILIES,
    evidence: evidence({ featurePrint: print([1, 0, 0]), ocrText: 'james perse' }),
    garmentClass: 'top',
    prints,
  });
  assert.equal(clearsFastPath(ranked), false);
});

test('an empty ranking never clears', () => {
  assert.equal(clearsFastPath([]), false);
});

// ---------------------------------------------------------------------------
// 5 · Nothing here fakes the native half, and nothing leaks
// ---------------------------------------------------------------------------

const SRC = readFileSync('src/features/intake/photo-match.ts', 'utf8');

test('there is no JavaScript OCR pretending to read pixels', () => {
  const body = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/tesseract|ocrad|recognizeText|readPixels|ImageData/i.test(body));
  // OCR arrives as evidence from outside; it is never computed here.
  assert.match(body, /ocrText: string \| null/);
});

test('a feature print never leaves the device', () => {
  const body = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/supabase|functions\.invoke|fetch\(|track\(/.test(body), 'photo evidence is transmitted');
});

test('no photo or biometric field can reach analytics', () => {
  // The event union is where this is enforceable: adding a photo-derived
  // property means adding an event, and there is none.
  const posthog = readFileSync('src/lib/posthog.tsx', 'utf8');
  assert.ok(
    !/feature_print|featurePrint|ocr_text|ocrText|photo_hash|image_hash/i.test(posthog),
    'a photo-derived field entered the analytics contract',
  );
});

test('a local match spends no AI quota, because it makes no call', () => {
  const body = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/enforceAiQuota|generate-outfits|tag-item|garment-search/.test(body));
});

// ---------------------------------------------------------------------------
// 6 · The acceptance cells this packet cannot close — recorded for Packet 5
// ---------------------------------------------------------------------------

/**
 * Named here rather than in prose so the next packet has a list it can turn
 * into tests, and so nobody reads "Workstream 7 done" as "all thirteen
 * photographs pass".
 */
export const NATIVE_ONLY_ACCEPTANCE = [
  'blurred photo — needs Vision sharpness on the pixel buffer',
  'dark photo — needs exposure measurement',
  'overexposed photo — needs exposure measurement',
  'visible label — needs Vision OCR',
  'invisible label — needs Vision OCR to confirm the absence',
  'duplicate upload — needs a per-user feature-print index',
  'exact catalogue match — needs feature-print ranking over thumbnails',
  'near match — needs feature-print ranking',
  'mirror/person photo — needs subject classification beyond coverage',
] as const;

test('the native-only cells are recorded, not quietly dropped', () => {
  assert.equal(NATIVE_ONLY_ACCEPTANCE.length, 9);
  // And the four that ARE closed here have tests above: plain background,
  // hanger/flat lay (both are subject coverage), multiple objects (coverage of
  // the largest subject), and no match (empty ranking).
  assert.equal(photoQuality(evidence({ subjectCoverage: 0.6 })), 'ok');
  assert.deepEqual(
    rankCandidates({ families: [], evidence: evidence(), garmentClass: 'top' }),
    [],
  );
});
