import { recordMoment, type ReviewMoment } from './review-prompt-core';
import { reviewPromptIo } from './review-prompt-io';

/**
 * The card subscribes here so a moment recorded while it is already sitting
 * on a tab root (Today's own `closet_ready` observer, for a closet that was
 * complete before this shipped) reaches it without a route change.
 */
const listeners = new Set<() => void>();

/**
 * The two call sites that arm the review card — see `review-prompt-core.ts`
 * for why a moment and not a timer (ledger A50).
 *
 *   - `ten`    beside each `closet_ready` observer (The Ten's and Today's);
 *   - `reveal` at the Reveal's exit, before the membership moment it may
 *              present, so the card follows the sheet rather than racing it.
 *
 * Fire-and-forget and never throws: both call sites are on paths that are
 * forbidden to block (the Reveal's exit above all), and an unarmed card is
 * the cheaper failure. `tests/review-prompt.test.ts` pins the call sites.
 */
export function noteReviewMoment(moment: ReviewMoment): void {
  let armed = false;
  try {
    armed = recordMoment(reviewPromptIo, moment);
  } catch {
    // The kv store being unavailable costs one missing ask, nothing more.
  }
  if (armed) for (const listener of listeners) listener();
}


export function subscribeReviewMoments(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
