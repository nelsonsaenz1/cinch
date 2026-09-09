/**
 * The zero's classification, and when a Reveal counts as SEEN — the decision
 * half, with no React and no IO, so the node suite executes every branch
 * (the house split: rating-ask-core, review-prompt-core, trial-expired-core).
 *
 * ── WHY THIS EXISTS (incident 2026-08-31) ──────────────────────────────────
 *
 * Two production sessions hit `zero` the day Today's reveal door opened, and
 * the investigation that classified them had to join three systems by hand
 * because the screen collapsed four different facts into one word:
 *
 *   unpairable   — settled arithmetic over a closet that makes no core
 *                  (both 8/31 sessions: fully tagged, zero shoes)
 *   unread       — pieces at pending_tag, tagging allowed and in flight
 *   no_consent   — pieces at pending_tag, tagging never allowed to run
 *                  (the 8/20 session; fixed upstream by the consent gate)
 *   query_failed — the wardrobe read errored, so the count is a fact about
 *                  the network, not the closet
 *
 * Only the FIRST is an honest zero. The screen was already distinguishing the
 * middle two (the unread zero, ca019d7); `query_failed` could still masquerade
 * — a failed read produced an empty list, an empty list counted to zero, and
 * the zero screen then explained a closet nobody had actually read. This
 * module is the one place the classification lives.
 *
 * ── WHEN A REVEAL IS "SEEN" ────────────────────────────────────────────────
 *
 * `profiles.reveal_seen_at` closes Today's reveal door permanently, so the
 * stamp must mean "the moment was DELIVERED", not "the route mounted". A
 * mount-time stamp made one second of `arriving` — an interrupted launch, an
 * unread zero, a failed read — spend the door forever. The stamp now happens
 * at exactly two kinds of moment:
 *
 *   · `complete` — the sequence finished; the number was seen.
 *   · a deliberate exit from the HONEST zero — the reader saw the true
 *     arithmetic and answered it. The repair loop keeps working because the
 *     zero screen itself still offers it; the door on Today is simply not
 *     burned by states that delivered nothing.
 *
 * Unread, consent-blocked, failed, and interrupted sessions never stamp, so
 * the path back survives every state that was not the reader's answer.
 */

import type { ZeroReason } from './reveal-analytics';

export type { ZeroReason };

export interface ZeroFacts {
  /** The wardrobe read errored — nothing below it is a fact about the closet. */
  readonly queryFailed: boolean;
  /** Pieces at pending_upload/pending_tag, from the untagged count. */
  readonly untagged: number;
  /** AI consent currently granted at the required version. */
  readonly consented: boolean;
}

/**
 * Which zero this is. Order is the trust order: a failed read outranks
 * everything (the other facts were computed over its wreckage), unread
 * outranks unpairable (the arithmetic has not seen those pieces yet), and
 * only a settled, fully-read closet may be called unpairable.
 */
export function classifyZero(facts: ZeroFacts): ZeroReason {
  if (facts.queryFailed) return 'query_failed';
  if (facts.untagged > 0) return facts.consented ? 'unread' : 'no_consent';
  return 'unpairable';
}

/** The moments a mounted Reveal can claim to have delivered something. */
export type SeenMoment =
  /** The sequence reached `complete` — the number was on screen. */
  | 'complete'
  /** The honest zero's repair action — the reader answered the arithmetic. */
  | 'zero_repair'
  /** The honest zero's "Open Today anyway" — likewise an answer. */
  | 'zero_open_today';

/**
 * Whether this moment stamps `reveal_seen_at`.
 *
 * `zeroReason` is null everywhere except the zero screen; on the zero screen
 * only the honest zero may stamp — an exit from the unread, consent-blocked
 * or failed states is someone leaving a screen that delivered nothing, and
 * the door back must survive it.
 *
 * `thin` — the closet is under the product's activation floor (fewer than
 * ten pieces, or a shape the engine cannot build from). A THIN completion
 * never stamps. Incident 2026-09-05 (`d03875a0`): the voice walkthrough
 * committed ONE dress and replaced to the Reveal; `countOutfits` honestly
 * said one, the sequence completed, the door on Today was burned, and the
 * membership sheet followed two seconds later — over a closet Today itself
 * was about to floor with "start with ten pieces". The count was true and
 * the moment was not delivered: nothing that closet makes is reachable on
 * Today until nine more pieces arrive, and the door back must survive that.
 */
export function mayStampSeen(
  moment: SeenMoment,
  zeroReason: ZeroReason | null,
  thin = false,
): boolean {
  if (moment === 'complete') return zeroReason === null && !thin;
  return zeroReason === 'unpairable';
}

/**
 * Whether the exit may raise the membership moment at all.
 *
 * Three states skip the sheet and this is the fourth: a thin closet has just
 * been shown a number Today cannot yet deliver, and selling into that gap is
 * charging at the floor. `paying` and `offline` are the screen's own facts;
 * they are folded here so the rule is one function the suite executes.
 */
export function maySellOnExit(facts: {
  readonly paying: boolean;
  readonly offline: boolean;
  readonly thin: boolean;
}): boolean {
  return !facts.paying && !facts.offline && !facts.thin;
}
