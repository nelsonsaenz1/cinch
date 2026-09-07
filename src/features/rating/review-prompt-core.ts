/**
 * The review ask — the decision half, with no React and no native imports,
 * so the node suite can execute every branch (the same split as
 * `rating-ask-core.ts` beside it).
 *
 * WHAT THIS IS, AND HOW IT DIFFERS FROM `rating-ask-core.ts`
 *
 * The settled-wear ask next door calls `StoreReview.requestReview()` — the
 * OS-owned card that iOS displays AT MOST three times per user per year, on
 * its own judgment. This ask goes to the other door Apple provides: the App
 * Store's own write-review page (`?action=write-review`), which is unlimited,
 * is real Apple UI, and takes both the star tap and a written review in one
 * place. What Cinch draws is only its own card asking the question; the
 * rating itself always happens on Apple's surface. Cinch never draws anything
 * that imitates the system rating card — an imitation is an App Review
 * rejection and worse.
 *
 * ── THE MOMENT, NOT THE TIMER (ledger A50, 2026-09-06) ────────────────────
 *
 * The first cut (founder directive 2026-08-28) asked from the SECOND session
 * onward, once per session, thirty seconds or three page moves in. The 09-06
 * nightly read what that bought: six people shown, six "later", the rating
 * count parked at six for ten days — while six other people built ten-piece
 * closets that week and none of them was asked at the moment they had just
 * been delighted. A timer asks whoever happens to be around; it does not
 * know what they just did.
 *
 * So the ask is now armed by a MOMENT and by nothing else:
 *
 *   - `ten`    — the tenth garment landed and the closet can be dressed
 *                (`closet_ready`'s own predicate, from either route);
 *   - `reveal` — the Reveal was completed, from its exit.
 *
 * Each moment arms the card at most once, ever, per install; the card is
 * drawn on the next tab root after a short settle ({@link DWELL_MS}), and
 * never over a paywall (see the stamps below). "Rate" and "I already have"
 * end the ask for good, as before. "Not now" consumes THAT moment — the
 * reader is asked again only at the next one, which for most people is the
 * Reveal a minute after the Ten. Two asks, ever, both at a beat the reader
 * just earned; nothing on a clock. Session counting is gone with the timer.
 *
 * ── NEVER OVER A PAYWALL ─────────────────────────────────────────────────
 *
 * Both moments sit one step before a general promo (`ten_completed` at the
 * Ten's exit, `reveal_complete` at the Reveal's), and Today itself can
 * present `returning_free` or `trial_expired` on arrival. A Cinch card
 * sliding up over a vendor sheet — or into the beat after it closes — is
 * the interruption this file's docblock has always forbidden. So
 * `use-gate.ts` stamps {@link PAYWALL_PRESENTED_KEY} the instant a sheet
 * appears and {@link PAYWALL_DISMISSED_KEY} when it closes, and the card
 * refuses to draw while a sheet is up or within {@link PAYWALL_SETTLE_MS} of
 * it closing. A refusal is not a spend: the card re-checks and draws when
 * the way is clear. A presentation with no dismissal older than
 * {@link PAYWALL_STALE_MS} is treated as closed — a process killed mid-sheet
 * must not gag the ask forever.
 *
 * ── SHARED TOUCHPOINT (Issue 6, 2026-08-31) ──────────────────────────────
 *
 * The settled-wear native ask can land in the same window as this card.
 * Before showing, the card also checks {@link TOUCHPOINT_KEY} and defers if
 * another surface fired inside the shared window; see
 * `rating-touchpoint-core.ts`. A deferral is not a spend either.
 */

import { TOUCHPOINT_KEY, touchedRecently, touchpointStamp } from './rating-touchpoint-core';

/** The two beats that arm the card. Nothing else does. */
export type ReviewMoment = 'ten' | 'reveal';
export const REVIEW_MOMENTS: readonly ReviewMoment[] = ['ten', 'reveal'];

/** The moment currently waiting to be asked about, if any. */
export const PENDING_MOMENT_KEY = 'cinch.review.pendingMoment.v1';

/** Set once per moment the first time it is recorded — a moment arms the card once, ever. */
export function momentRecordedKey(moment: ReviewMoment): string {
  return `cinch.review.moment.${moment}.recorded.v1`;
}

/**
 * Set once the ask's job is done — the reader went to the store, or said
 * they already had. Never set by a dismissal: "not now" is an answer about
 * this moment, not about the question.
 */
export const DONE_KEY = 'cinch.review.done.v1';

/** Kept for the migration's sake: the old per-launch counter, no longer read. */
export const SESSION_COUNT_KEY = 'cinch.review.sessionCount.v1';

/** A short settle on the tab root — the transition has landed, the eye has arrived. */
export const DWELL_MS = 5_000;

/** Stamped by `use-gate.ts` — every placement, the instant a sheet is on screen. */
export const PAYWALL_PRESENTED_KEY = 'cinch.paywall.presentedAt';
/** Stamped by `use-gate.ts` when that sheet closes, whatever the result. */
export const PAYWALL_DISMISSED_KEY = 'cinch.paywall.dismissedAt';
/** How long after a sheet closes the card still waits. */
export const PAYWALL_SETTLE_MS = 3_000;
/** A presentation this old with no dismissal is a dead process, not an open sheet. */
export const PAYWALL_STALE_MS = 10 * 60 * 1000;

/**
 * The App Store's write-review page for Cinch. The `action=write-review`
 * parameter opens the review composer directly — stars and the text field —
 * rather than the listing.
 */
export const WRITE_REVIEW_URL =
  'https://apps.apple.com/app/id6798479578?action=write-review';

/** The kv reads/writes, injected so tests run without expo-sqlite. */
export interface ReviewPromptIo {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

function isMoment(value: string | null): value is ReviewMoment {
  return value === 'ten' || value === 'reveal';
}

/**
 * Arm the card with a moment. Idempotent per moment per install: the
 * observers that call this run on every mount that satisfies their
 * predicate (Today re-checks `canGenerate` each visit), and a moment that
 * re-armed the card on every visit would be the timer back under another
 * name. Returns whether anything changed.
 *
 * A later moment supersedes a pending earlier one — the Reveal a minute
 * after the Ten is the better beat, and one card is drawn, not two.
 */
export function recordMoment(io: ReviewPromptIo, moment: ReviewMoment): boolean {
  if (io.read(momentRecordedKey(moment)) === 'true') return false;
  io.write(momentRecordedKey(moment), 'true');
  if (io.read(DONE_KEY) === 'true') return false;
  io.write(PENDING_MOMENT_KEY, moment);
  return true;
}

/** The moment waiting to be asked about, or null. */
export function pendingMoment(io: ReviewPromptIo): ReviewMoment | null {
  const raw = io.read(PENDING_MOMENT_KEY);
  return isMoment(raw) ? raw : null;
}

/** Whether the ask may run at all: a moment is pending and the job is not done. */
export function promptEligible(io: ReviewPromptIo): boolean {
  if (io.read(DONE_KEY) === 'true') return false;
  return pendingMoment(io) !== null;
}

/** Whether the settle on the tab root has elapsed. */
export function settledIn(elapsedMs: number): boolean {
  return elapsedMs >= DWELL_MS;
}

/** The reader acted — the ask never returns. */
export function markDone(io: ReviewPromptIo): void {
  io.write(DONE_KEY, 'true');
  io.write(PENDING_MOMENT_KEY, '');
}

/** "Not now" — this moment is spent; the next one, if any, asks again. */
export function consumeMoment(io: ReviewPromptIo): void {
  io.write(PENDING_MOMENT_KEY, '');
}

/** A stored value that does not parse is treated as never-stamped. */
function parseStamp(stored: string | null): number | null {
  if (!stored) return null;
  const parsed = Date.parse(stored);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * True while a paywall is on screen, or for {@link PAYWALL_SETTLE_MS} after
 * one closed — the card must wait, and waiting is not a spend.
 */
export function paywallInTheWay(now: Date, io: ReviewPromptIo): boolean {
  const presented = parseStamp(io.read(PAYWALL_PRESENTED_KEY));
  if (presented === null) return false;
  const dismissed = parseStamp(io.read(PAYWALL_DISMISSED_KEY));
  const open = dismissed === null || dismissed < presented;
  if (open) return now.getTime() - presented < PAYWALL_STALE_MS;
  return now.getTime() - dismissed < PAYWALL_SETTLE_MS;
}

/** The two stamps `use-gate.ts` writes. Pure; the gate supplies the io. */
export function stampPaywallPresented(now: Date, io: ReviewPromptIo): void {
  io.write(PAYWALL_PRESENTED_KEY, now.toISOString());
}
export function stampPaywallDismissed(now: Date, io: ReviewPromptIo): void {
  io.write(PAYWALL_DISMISSED_KEY, now.toISOString());
}

/** True if another rating surface (the settled-wear native ask, or the
 *  post-share native ask) fired within the shared touchpoint window — this
 *  card must defer, even though it is otherwise due. */
export function blockedByOtherSurface(now: Date, io: ReviewPromptIo): boolean {
  return touchedRecently(now, io.read(TOUCHPOINT_KEY));
}

/** Stamp the shared touchpoint the moment the card actually shows — never on
 *  a mere eligibility check, only on the real appearance. */
export function markTouchpoint(now: Date, io: ReviewPromptIo): void {
  io.write(TOUCHPOINT_KEY, touchpointStamp(now));
}

/**
 * The whole verdict in one place, so the component only asks one question:
 * may the card draw NOW, on this path? Every "no" is a wait, not a spend.
 */
export function reviewCardDue(input: {
  now: Date;
  onTabRoot: boolean;
  dwelledMs: number;
  io: ReviewPromptIo;
}): ReviewMoment | null {
  const { now, onTabRoot, dwelledMs, io } = input;
  if (!onTabRoot) return null;
  if (!promptEligible(io)) return null;
  if (!settledIn(dwelledMs)) return null;
  if (paywallInTheWay(now, io)) return null;
  if (blockedByOtherSurface(now, io)) return null;
  return pendingMoment(io);
}
