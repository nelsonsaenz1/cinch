/**
 * The look-alike offer at upload — whether a settled garment may carry it.
 *
 * `garment-search`'s `match` action already exists and already works; what it
 * lacked was a door at the moment somebody is actually looking at what they
 * just uploaded. Item detail's row is found days later, if ever, and capture's
 * M-03 card only ever speaks for a batch of exactly one. This module is the
 * gate for the quieter doors — The Ten's slot card and the review surface —
 * and it is a gate because the offer must be OFFERED, never auto-run: one
 * match call is a vision-model pass plus metered catalogue requests, and a
 * ten-photo batch that ran it ten times uninvited would spend a month's
 * allowance announcing a feature nobody asked for (§2.4 of the 2026-08-21
 * research).
 *
 * PURE, AND NOTHING HERE MAY EVER FETCH. The derivation runs inside the upload
 * pipeline the moment `tag-item` settles, which is exactly the moment a lazy
 * implementation would sneak a "warm-up" search into. Every input is a fact
 * the pipeline already holds; the one that looks like it needs a round trip —
 * consent — is read off the query cache by the caller, and an absent cache
 * entry derives to ineligible rather than to a read. The offer costs nothing
 * until it is tapped, and the tap opens the same `MatchSheet` flow item detail
 * uses, whose server half enforces everything again.
 */

import type { UploadJob } from './queue-store';

/**
 * The affordance's whole label, shared by every surface that draws it.
 *
 * Deliberately not "Want the listing photo instead?" — that is M-03's specific
 * card with its two-action commitment. This is a quiet verb on a card that is
 * about something else, and it makes the smaller promise: a cleaner photograph
 * to sit ALONGSIDE the one just taken. `listing_path` accompanies the user's
 * photo; it never replaces the record.
 */
export const MATCH_OFFER_ACTION = 'Find a cleaner photo';

export type MatchEligibilityInput = {
  /**
   * Local mode (A-04) — the photograph never left the phone. There is nothing
   * server-side for `match` to look at, and offering the search would break
   * the promise local mode exists to keep. Belt and braces: a local job never
   * reaches the tagging loop that calls this, but a promise this explicit
   * gets enforced twice — the same doctrine as the sweep's `image_path` guard.
   */
  local: boolean | undefined;
  /** The tag reached a terminal answer (`tagged` or `needs_review`). */
  tagSettled: boolean;
  /**
   * What the tagger called the piece — the rail label derived from its
   * category/subcategory, or null when it produced neither. A garment the
   * model could not even categorise is a garment the match search would be
   * guessing about, and a guess dressed as an offer is the thing every match
   * surface refuses to be.
   */
  category: string | null;
  /** The on-device cutout was lifted and uploaded. */
  hasCutout: boolean;
  /** The thumbnail (or the imported picture) is on the server. */
  hasThumb: boolean;
  /**
   * The 5.1.2(i) consent version on record, from the `['ai-consent']` cache —
   * never from a fresh read. Null when withdrawn, never granted, or simply
   * not cached yet: all three derive to ineligible, because an offer that
   * cannot prove consent is current has no business advertising an AI pass.
   */
  consentVersion: number | null;
  /** `CURRENT_CONSENT_VERSION`, passed in so this module stays import-pure. */
  currentConsentVersion: number;
};

/**
 * True when the settled garment may carry the look-alike affordance.
 *
 * The consent comparison is `use-consent.ts`'s own, verbatim in shape:
 * a recorded version at or above the current one, with absence as zero. The
 * server enforces the same rule again on the actual `match` call — this gate
 * only decides whether the invitation is honest to draw.
 */
export function deriveMatchEligible(input: MatchEligibilityInput): boolean {
  if (input.local) return false;
  if (!input.tagSettled) return false;
  if (!input.category) return false;
  // `matchListing` reads `cutout_path ?? thumb_path ?? image_path`, so either
  // artifact is enough for the search to have something to look at.
  if (!input.hasCutout && !input.hasThumb) return false;
  return (input.consentVersion ?? 0) >= input.currentConsentVersion;
}

/**
 * The job carrying a live offer for this item, or undefined.
 *
 * One selector, so The Ten and the review surface cannot drift into two
 * definitions of "eligible" — the flag is only ever written by the pipeline at
 * tag settlement, and a job that failed, is still moving, or predates the flag
 * simply never carries it.
 */
export function matchOfferJob(
  jobs: readonly UploadJob[],
  itemId: string | null | undefined,
): UploadJob | undefined {
  if (!itemId) return undefined;
  return jobs.find((j) => j.itemId === itemId && j.matchEligible === true);
}
