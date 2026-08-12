/**
 * CP-05 — the cutout failed, and the photograph is kept.
 *
 * The behaviour has always been right: `runCutout` never fails an import, so a
 * garment Vision could not lift still became a perfectly usable piece with its
 * full photograph as its image. What was missing was anybody telling the user.
 * The picture in the closet simply looked different from the others and nothing
 * on screen said why.
 *
 * CORRECTION 10 GOVERNS THE WORDING. The cutout is Apple Vision running on this
 * phone, so the failure is local and the copy says so — "could not lift the
 * garment from the background", not "processing failed" and not "we could not
 * reach the server". Nothing is queued and nothing is waiting on anything, so
 * there is no "until the cutout succeeds" and no retry window to explain.
 *
 * THE ORDER OF THE TWO SENTENCES IS THE POINT. "A failed cutout is a degraded
 * result, not a lost piece, so the notice says what survived first and what is
 * missing second." The body opens with the photograph being saved and the piece
 * being filed, and only then says what Cinch will use instead.
 *
 * Pure, and no React: the selector below decides when the notice exists, which
 * is the part that can be wrong, and `tests/cutout-failure.test.ts` walks it
 * without a device.
 */

import type { UploadJob } from './queue-store';

/** The atlas's headline, verbatim. Names the cause, on this phone. */
export const CUTOUT_FAILED_TITLE = 'Cinch could not lift the garment from the background';

/** What survived, then what is missing. Never the other way round. */
export const CUTOUT_FAILED_BODY =
  'Your photograph is saved and the piece is filed. Cinch will use the full picture instead.';

/**
 * "Retry and accept are peers of equal height, with only the retry filled — and
 * accepting is a real, named outcome rather than a dismissal."
 */
export const CUTOUT_RETRY_ACTION = 'Try again';
export const CUTOUT_ACCEPT_ACTION = 'Keep the full photo';

/**
 * The jobs a CP-05 notice may be shown for.
 *
 * `itemId` is required, not incidental. The body's first sentence claims the
 * piece is filed, and a job that failed its cutout BEFORE the row was created
 * has not filed anything — showing this notice over it would be the app
 * stating something it has not done. Such a job is a plain import failure and
 * the rail's own error line already owns it.
 */
export function cutoutFailures(jobs: readonly UploadJob[]): UploadJob[] {
  return jobs.filter((j) => j.cutoutFailed === true && Boolean(j.itemId));
}

/**
 * The count for the notice's own line, or null when there is nothing to say.
 *
 * A count rather than a bar, and printed only because it is known — the
 * standing refusal. One failure in a batch of nine is one, not "some".
 */
export function cutoutFailureCount(jobs: readonly UploadJob[]): number | null {
  const n = cutoutFailures(jobs).length;
  return n > 0 ? n : null;
}

/**
 * The line above the pair when more than one piece in a session lost its
 * cutout. Singular says nothing extra: the notice sits over its own subject and
 * a "1 piece" label would be counting to one.
 */
export function cutoutFailureLine(count: number): string | null {
  return count > 1 ? `${count} pieces kept their full photograph.` : null;
}
