/**
 * The thresholds and comparisons that turn native measurements into decisions.
 *
 * Split from `photo-evidence.ts` for the same mechanical reason the speech
 * policy is split: that file imports the native module, which reaches React
 * Native, which the test bundler cannot parse. These numbers are the half most
 * likely to be wrong — somebody chose them — so they live where a test can
 * reach them without a device.
 *
 * They are JavaScript rather than Swift on purpose: a recalibration ships in an
 * OTA rather than a store build.
 */

import type { PhotoQuality } from './photo-match';

/** Below this the photograph is smeared rather than merely soft. */
export const MIN_SHARPNESS = 60;
/** Outside this band the exposure is doing the garment no favours. */
export const MIN_MEAN_LUMINANCE = 0.12;
export const MAX_MEAN_LUMINANCE = 0.92;
/** Above this share of pinned pixels, detail is gone rather than dim. */
export const MAX_CLIPPING = 0.35;

export type NativePhotoQuality =
  | PhotoQuality
  | 'too_blurry'
  | 'too_dark'
  | 'too_bright';

/**
 * The verdict, from the numbers.
 *
 * Ordered worst-first: a photograph that is both dark and blurry is reported as
 * blurry, because that is the one the user can actually fix by taking it again
 * more carefully rather than by moving to a window.
 */
export function qualityFromMeasurements(
  quality: { sharpness: number; meanLuminance: number; clippedHighlights: number; clippedShadows: number } | null,
  coverage: number | null,
): NativePhotoQuality {
  if (!quality) return coverage === null ? 'unmeasured' : 'ok';

  if (quality.sharpness < MIN_SHARPNESS) return 'too_blurry';
  if (quality.meanLuminance < MIN_MEAN_LUMINANCE || quality.clippedShadows > MAX_CLIPPING) {
    return 'too_dark';
  }
  if (quality.meanLuminance > MAX_MEAN_LUMINANCE || quality.clippedHighlights > MAX_CLIPPING) {
    return 'too_bright';
  }
  return 'ok';
}

// ---------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------

/**
 * Hamming distance between two difference hashes, or null.
 *
 * The comparison is between two of THIS USER's own imports, held on THIS
 * device. There is no index, no upload and no cross-user comparison — see the
 * Swift docblock for why the hash is deliberately weak enough that there could
 * not be a useful one.
 */
export function hashDistance(a: string | null, b: string | null): number | null {
  if (!a || !b || a.length !== 16 || b.length !== 16) return null;

  // Validated BEFORE the XOR, not after. `NaN ^ n` is 0 in JavaScript, not
  // NaN, so a check inside the loop never fires — a garbage hash compared as
  // sixteen zeroes and would have read as a plausible distance. The fixture
  // caught it; the coercion rule is the kind of thing that only shows up when
  // something deliberately feeds it rubbish.
  if (!/^[0-9a-f]{16}$/i.test(a) || !/^[0-9a-f]{16}$/i.test(b)) return null;

  let distance = 0;
  for (let i = 0; i < 16; i += 1) {
    const x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    // Four bits per hex digit.
    distance += ((x >> 3) & 1) + ((x >> 2) & 1) + ((x >> 1) & 1) + (x & 1);
  }
  return distance;
}

/**
 * How close two hashes have to be to count as the same photograph.
 *
 * Five of sixty-four bits. Tolerant enough to survive a re-encode and a crop of
 * a few percent — what "imported the same photo twice" actually looks like —
 * and tight enough that two photographs of the same shirt from different angles
 * are still two garments, which they are.
 */
export const DUPLICATE_MAX_DISTANCE = 5;

export function isProbableDuplicate(a: string | null, b: string | null): boolean {
  const distance = hashDistance(a, b);
  return distance !== null && distance <= DUPLICATE_MAX_DISTANCE;
}
