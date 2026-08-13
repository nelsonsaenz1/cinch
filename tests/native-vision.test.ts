/**
 * Packet 5 — the native boundary, checked from the JavaScript side.
 *
 * What can and cannot be tested here is worth stating plainly. Swift does not
 * run in this runner, so nothing below executes Vision or SFSpeechRecognizer;
 * the compile and the on-simulator module registration are the evidence for
 * those, and they are recorded in the ledger.
 *
 * What IS testable here is everything that decides what to do with the native
 * results — thresholds, routes, duplicate distance — and that is the half most
 * likely to be wrong, because it is the half full of numbers somebody chose.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  DUPLICATE_MAX_DISTANCE,
  hashDistance,
  isProbableDuplicate,
  qualityFromMeasurements,
  MAX_CLIPPING,
  MAX_MEAN_LUMINANCE,
  MIN_MEAN_LUMINANCE,
  MIN_SHARPNESS,
} from '../src/features/intake/photo-evidence-rules.ts';
import { routeFor, CLOUD_OFFER } from '../src/features/catalogue/local-speech-policy.ts';
import type { SpeechSupport } from '../modules/garment-cutout/src/GarmentVision.types.ts';

const measured = (over: Partial<Parameters<typeof qualityFromMeasurements>[0] & object> = {}) => ({
  sharpness: 400,
  meanLuminance: 0.5,
  clippedHighlights: 0.01,
  clippedShadows: 0.01,
  ...over,
});

// ---------------------------------------------------------------------------
// 1 · The native-only acceptance photographs, as thresholds
// ---------------------------------------------------------------------------

test('a sharp, well-exposed photograph passes', () => {
  assert.equal(qualityFromMeasurements(measured(), 0.5), 'ok');
});

test('blurred — the acceptance cell Packet 4 could not close', () => {
  assert.equal(qualityFromMeasurements(measured({ sharpness: 12 }), 0.5), 'too_blurry');
  assert.ok(MIN_SHARPNESS > 12);
});

test('dark, by mean luminance or by crushed shadows', () => {
  assert.equal(qualityFromMeasurements(measured({ meanLuminance: 0.05 }), 0.5), 'too_dark');
  assert.equal(qualityFromMeasurements(measured({ clippedShadows: 0.6 }), 0.5), 'too_dark');
  assert.ok(MIN_MEAN_LUMINANCE > 0.05 && MAX_CLIPPING < 0.6);
});

test('overexposed, by mean luminance or by blown highlights', () => {
  assert.equal(qualityFromMeasurements(measured({ meanLuminance: 0.97 }), 0.5), 'too_bright');
  assert.equal(qualityFromMeasurements(measured({ clippedHighlights: 0.7 }), 0.5), 'too_bright');
  assert.ok(MAX_MEAN_LUMINANCE < 0.97);
});

test('blur is reported ahead of exposure', () => {
  // Both wrong. Blur is the one the user fixes by taking it again carefully,
  // rather than by moving to a window.
  assert.equal(
    qualityFromMeasurements(measured({ sharpness: 5, meanLuminance: 0.02 }), 0.5),
    'too_blurry',
  );
});

test('no measurement is never reported as ok', () => {
  assert.equal(qualityFromMeasurements(null, null), 'unmeasured');
});

// ---------------------------------------------------------------------------
// 2 · Duplicate detection — per user, per device, non-reversible
// ---------------------------------------------------------------------------

test('the same photograph is the same hash', () => {
  assert.equal(hashDistance('ffffffffffffffff', 'ffffffffffffffff'), 0);
  assert.equal(isProbableDuplicate('0123456789abcdef', '0123456789abcdef'), true);
});

test('a re-encode moves a few bits and still counts as the same', () => {
  // One bit different.
  assert.equal(hashDistance('0000000000000000', '0000000000000001'), 1);
  assert.equal(isProbableDuplicate('0000000000000000', '0000000000000001'), true);
});

test('a different garment is not a duplicate', () => {
  assert.equal(hashDistance('0000000000000000', 'ffffffffffffffff'), 64);
  assert.equal(isProbableDuplicate('0000000000000000', 'ffffffffffffffff'), false);
});

test('the boundary is exactly where it says it is', () => {
  // Five bits set: at the limit. Six: over it.
  assert.equal(isProbableDuplicate('0000000000000000', '000000000000001f'), true);
  assert.equal(isProbableDuplicate('0000000000000000', '000000000000003f'), false);
  assert.equal(DUPLICATE_MAX_DISTANCE, 5);
});

test('a malformed or absent hash compares to nothing', () => {
  assert.equal(hashDistance(null, 'ffffffffffffffff'), null);
  assert.equal(hashDistance('short', 'ffffffffffffffff'), null);
  assert.equal(hashDistance('zzzzzzzzzzzzzzzz', 'ffffffffffffffff'), null);
  assert.equal(isProbableDuplicate(null, null), false);
});

// ---------------------------------------------------------------------------
// 3 · The speech route — every state, and the cloud offer is never silent
// ---------------------------------------------------------------------------

const support = (over: Partial<SpeechSupport> = {}): SpeechSupport => ({
  simulator: false,
  locale: 'en-US',
  localeSupported: true,
  available: true,
  onDeviceSupported: true,
  authorization: 'authorized',
  ...over,
});

test('a capable, authorised device transcribes locally', () => {
  assert.deepEqual(routeFor(support()), { kind: 'local' });
});

test('no native module at all means the cloud path Cinch has always used', () => {
  assert.deepEqual(routeFor(null), { kind: 'offer_cloud', because: 'unsupported_device' });
});

test('the Simulator has no speech stack, and says so', () => {
  // Apple's constraint, not ours. This is why the spoken path cannot be
  // accepted on a simulator and needs a device run.
  assert.deepEqual(routeFor(support({ simulator: true })), {
    kind: 'offer_cloud',
    because: 'unsupported_device',
  });
});

test('permission is asked for before anything is recorded', () => {
  assert.deepEqual(routeFor(support({ authorization: 'not_determined' })), {
    kind: 'needs_permission',
  });
});

test('a refusal is a settled state with its own route', () => {
  assert.deepEqual(routeFor(support({ authorization: 'denied' })), {
    kind: 'blocked',
    authorization: 'denied',
  });
  assert.deepEqual(routeFor(support({ authorization: 'restricted' })), {
    kind: 'blocked',
    authorization: 'restricted',
  });
});

test('a device with no offline model offers the cloud, naming that reason', () => {
  assert.deepEqual(routeFor(support({ onDeviceSupported: false })), {
    kind: 'offer_cloud',
    because: 'on_device_unsupported',
  });
});

test('an unsupported locale and an unavailable service are different offers', () => {
  assert.equal(routeFor(support({ localeSupported: false })).kind, 'offer_cloud');
  assert.equal(
    (routeFor(support({ localeSupported: false })) as { because: string }).because,
    'locale_unsupported',
  );
  assert.equal(
    (routeFor(support({ available: false })) as { because: string }).because,
    'unavailable',
  );
});

test('every offer names the trade the user is being asked to make', () => {
  for (const [reason, sentence] of Object.entries(CLOUD_OFFER)) {
    if (reason === 'not_authorized' || reason === 'recognition_failed') continue;
    assert.match(
      sentence,
      /leaves the device/,
      `the ${reason} offer does not say the recording leaves the device`,
    );
    assert.match(sentence, /deleted/, `the ${reason} offer does not say it is deleted`);
  }
});

// ---------------------------------------------------------------------------
// 4 · The boundaries this packet must not cross
// ---------------------------------------------------------------------------

const VISION_SWIFT = readFileSync('modules/garment-cutout/ios/GarmentVision.swift', 'utf8');
const VISION_MODULE = readFileSync('modules/garment-cutout/ios/GarmentVisionModule.swift', 'utf8');
const SPEECH_SWIFT = readFileSync('modules/garment-cutout/ios/LocalSpeechModule.swift', 'utf8');

test('no photo or biometric measurement can leave the device', () => {
  for (const [name, src] of [
    ['GarmentVision', VISION_SWIFT],
    ['GarmentVisionModule', VISION_MODULE],
  ] as const) {
    assert.ok(!/URLSession|URLRequest|https?:\/\//.test(src), `${name} can reach the network`);
  }
  const evidence = readFileSync('src/features/intake/photo-evidence-rules.ts', 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  assert.ok(!/supabase|functions\.invoke|track\(/.test(evidence), 'evidence is transmitted');
});

test('there is no global cross-user image index', () => {
  // The hash never leaves this file's callers, and nothing here has anywhere to
  // put it. Asserted on the Swift too: no persistence, no server.
  assert.ok(!/UserDefaults|CoreData|CloudKit|NSUbiquitous/.test(VISION_SWIFT));
  const evidence = readFileSync('src/features/intake/photo-evidence-rules.ts', 'utf8');
  assert.ok(!/upload|remote|global|index/i.test(evidence.replace(/\/\*[\s\S]*?\*\//g, '')));
});

test('speech is on-device or refused — never a silent server fallback', () => {
  assert.match(SPEECH_SWIFT, /requiresOnDeviceRecognition = true/);
  // No branch sets it false, which is what would make "on-device" a hope.
  assert.ok(!/requiresOnDeviceRecognition = false/.test(SPEECH_SWIFT));
  assert.match(SPEECH_SWIFT, /supportsOnDeviceRecognition else/);
});

test('the bulk walkthrough is untouched and still cloud', () => {
  const voice = readFileSync('src/features/intake/use-transcription.ts', 'utf8');
  assert.ok(
    !/LocalSpeech|transcribeLocally/.test(voice),
    'the walkthrough was moved onto on-device recognition',
  );
});

test('the native side returns numbers, not verdicts', () => {
  // Thresholds live in JS so a recalibration is an OTA, not a store build.
  assert.ok(!/tooBlurry|too_blurry|isBlurry|tooDark/.test(VISION_SWIFT + VISION_MODULE));
  const evidence = readFileSync('src/features/intake/photo-evidence-rules.ts', 'utf8');
  assert.match(evidence, /export const MIN_SHARPNESS/);
});

test('the module registers all three native modules', () => {
  const config = JSON.parse(
    readFileSync('modules/garment-cutout/expo-module.config.json', 'utf8'),
  );
  assert.deepEqual(config.apple.modules, [
    'GarmentCutoutModule',
    'GarmentVisionModule',
    'LocalSpeechModule',
  ]);
});

test('speech recognition declares its permission string', () => {
  const config = readFileSync('app.config.ts', 'utf8');
  assert.match(config, /NSSpeechRecognitionUsageDescription: SPEECH_USAGE_DESCRIPTION/);
  // Gated by the same flag as the microphone: recognition without a microphone
  // declaration is a permission for a capability the build does not have.
  const block = config.slice(config.indexOf('...(VOICE_INTAKE'), config.indexOf('    /**\n     * Privacy manifest'));
  assert.match(block, /NSMicrophoneUsageDescription/);
  assert.match(block, /NSSpeechRecognitionUsageDescription/);
});

test('photo-library APIs carry a specific purpose string in both config layers', () => {
  const config = readFileSync('app.config.ts', 'utf8');
  assert.match(config, /NSPhotoLibraryUsageDescription: PHOTO_LIBRARY_USAGE_DESCRIPTION/);
  assert.match(config, /photosPermission: PHOTO_LIBRARY_USAGE_DESCRIPTION/);
  assert.ok(!/photosPermission:\s*false/.test(config));
});
