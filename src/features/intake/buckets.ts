/**
 * The buckets the Walkthrough's events are allowed to carry.
 *
 * Split out of `analytics.ts` and deliberately IMPORT-FREE. Two reasons, and
 * the second is the real one:
 *
 *  1. `analytics.ts` imports `track` from `@/lib/posthog`, which reaches React
 *     Native. `scripts/run-tests.mjs` bundles with esbuild and cannot parse
 *     RN's Flow source, so anything importing it is untestable in this suite.
 *  2. These functions ARE the privacy rule. §9 says no transcript, no names, no
 *     utterances — and no count precise enough to reconstruct what somebody
 *     owns. A rule that cannot be tested is a rule that quietly stops being
 *     true, so the banding lives where `tests/intake-procession.test.ts` can
 *     reach it.
 */

/** Recording length. Bands, never raw milliseconds — a duration to the
 *  millisecond is close to a fingerprint and the band is all any decision here
 *  needs. */
export type DurationBucket = 'under_1m' | '1_3m' | '3_6m' | '6_12m';

/** Closet size. The bands the thesis is argued in: a 30-plus closet in under
 *  eight minutes is the claim. */
export type GarmentBucket = '0' | '1_9' | '10_29' | '30_plus';

/** How far into the procession someone got before leaving. */
export type CursorBucket = 'none' | 'early' | 'half' | 'most';

/** Which field a correction touched. Never the old or new value. */
export type EditedField =
  | 'name'
  | 'kind'
  | 'colour'
  | 'fabric'
  | 'pattern'
  | 'formality'
  | 'warmth'
  | 'quantity';

/** Where a walkthrough was when it was abandoned. Mirrors
 *  `intake_sessions.status`, minus the terminal states. */
export type AbandonState = 'recording' | 'transcribing' | 'parsing' | 'reviewing';

/** Bounded causes, mirroring `intake_sessions.error_code`. Never a provider
 *  message, which is unbounded and occasionally quotes the input back. */
export type FailureCause =
  | 'quota_exhausted'
  | 'transcription_failed'
  | 'silent'
  | 'parse_failed'
  | 'audio_unreadable'
  | 'drafts_unwritable'
  | 'mic_denied'
  | 'offline';

export function durationBucket(ms: number): DurationBucket {
  const minutes = ms / 60_000;
  if (minutes < 1) return 'under_1m';
  if (minutes < 3) return '1_3m';
  if (minutes < 6) return '3_6m';
  return '6_12m';
}

export function garmentBucket(count: number): GarmentBucket {
  if (count <= 0) return '0';
  if (count < 10) return '1_9';
  if (count < 30) return '10_29';
  return '30_plus';
}

/**
 * Position through the procession, as a quarter-ish band.
 *
 * A raw cursor plus a raw total would let anyone reading the event reconstruct
 * how many garments a specific person owns, which is exactly the kind of fact
 * this file exists to keep out of a third party's database.
 */
export function cursorBucket(cursor: number, total: number): CursorBucket {
  if (total <= 0 || cursor <= 0) return 'none';
  const share = cursor / total;
  if (share < 0.34) return 'early';
  if (share < 0.67) return 'half';
  return 'most';
}
