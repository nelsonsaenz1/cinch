import { track } from '@/lib/posthog';

import {
  cursorBucket,
  durationBucket,
  garmentBucket,
  type AbandonState,
  type EditedField,
  type FailureCause,
} from './buckets';

export * from './buckets';

/**
 * The Walkthrough's events, and the buckets that keep them safe.
 *
 * §9 of the voice-intake directive says "no transcript text, no garment names,
 * no utterances in any property. Buckets only." That is a rule a call site can
 * break by accident in one keystroke, so it is not left as a rule: every intake
 * event is emitted through a function in this file, each takes only numbers and
 * bounded unions, and none of them accepts a string the user produced.
 *
 * A walkthrough is a recording of somebody listing everything they own. An
 * event property is the easiest place in this app for that to leak, and unlike
 * a leak in the database it leaves through a third party and cannot be
 * recalled. Making it impossible to pass the wrong thing is worth one small
 * module.
 *
 * The three numbers this exists to produce are in §9. In short: how long a
 * closet takes, how many people finish the procession, and how often a card has
 * to be corrected.
 */

/** DENOMINATOR for the whole funnel. Fired when the microphone is genuinely
 *  offered at V-01 — not when the feature became reachable. */
export const intakeStarted = () => track('intake_started');

export const intakeRecordingFinished = (durationMs: number) =>
  track('intake_recording_finished', { duration_bucket: durationBucket(durationMs) });

export const intakeParsed = (garments: number, unparsedSpans: number) =>
  track('intake_parsed', {
    garment_bucket: garmentBucket(garments),
    unparsed_spans: unparsedSpans,
  });

export const intakeCardConfirmed = () => track('intake_card_confirmed');

/** The number that judges the parse. Above ~25% of garments and the receipt
 *  line is carrying the whole experience. */
export const intakeCardEdited = (field: EditedField) =>
  track('intake_card_edited', { field });

export const intakeCardRejected = () => track('intake_card_rejected');

export const intakePhotoAdded = () => track('intake_photo_added');

/** `held` is non-zero exactly when the plan ceiling fired, which makes this the
 *  denominator for M-07 and M-08. */
export const intakeCommitted = (committed: number, held: number) =>
  track('intake_committed', {
    committed_bucket: garmentBucket(committed),
    held_bucket: garmentBucket(held),
    hit_ceiling: held > 0,
  });

export const intakeAbandoned = (state: AbandonState, cursor: number, total: number) =>
  track('intake_abandoned', { state, cursor_bucket: cursorBucket(cursor, total) });

export const intakeFailed = (cause: FailureCause) => track('intake_failed', { cause });
