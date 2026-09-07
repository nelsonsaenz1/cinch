/**
 * The invite ask on Today — the decision, the copy and the event shapes, as
 * pure data so `tests/invite-ask.test.ts` can execute them.
 *
 * ── WHY THIS EXISTS (ledger A23, 2026-09-01 → shipped 2026-09-06) ─────────
 *
 * Cinch's referral loop is one permanent link per person and nothing else:
 * no send objects, no codes, no expiry (`features/invite/link.ts`). It has
 * been shared four times, ever, by three people — and three of those four
 * converted, which makes it the highest-yield mechanic in the product by a
 * distance. Nobody was ever asked. The invite screen sits behind an ellipsis
 * sheet on Explore, which is where an invite goes to be found by the
 * already-convinced.
 *
 * So this is the ask, once, in context: one card on Today, drawn when the
 * closet can be dressed — `closet_ready`'s own predicate, the first moment
 * the product has visibly kept its promise and the first moment "a friend's
 * closet beside yours" means anything. The 09-06 nightly counted twelve real
 * closets past that line; this card is the first thing the loop has ever
 * shown them.
 *
 * ── ONE CARD AT A TIME ───────────────────────────────────────────────────
 *
 * The morning-edit ask (`push/ask-spec.ts`) draws in the same slot for the
 * same audience, and two asks stacked under the plate is a feed of asks.
 * Push goes first — day-2 return is the binding constraint the nightly
 * named — and this card waits until that one has been answered, which for
 * most people is the very next visit.
 *
 * ── ONCE, EVER ───────────────────────────────────────────────────────────
 *
 * Either answer ends the card for this install (AsyncStorage, the app's
 * card-dismissal idiom). "Not now" does not come back: the invite screen is
 * still one tap away on Explore for a changed mind, and an ask repeated by
 * the same screen is nagging.
 */

/** AsyncStorage key. One per install — a dismissal is a fact about a phone. */
export const INVITE_ASK_ANSWERED_KEY = 'cinch.invite.closet-ask.answered';

export interface InviteAskInput {
  /** The wardrobe read has settled and the closet can be dressed. */
  closetUsable: boolean;
  /** Whether this install has answered the card. `undefined` while the read is in flight. */
  answered: boolean | undefined;
  /** The morning-edit card is on screen — this one waits. */
  pushAskShowing: boolean;
}

/**
 * Whether the card is drawn. Every `undefined` reads as "not yet", so the
 * card can only ever arrive late, never flash and vanish.
 */
export function shouldOfferInviteAsk(input: InviteAskInput): boolean {
  return input.closetUsable && input.answered === false && !input.pushAskShowing;
}

export const INVITE_ASK_COPY = {
  kicker: 'A FRIEND’S CLOSET',
  /**
   * The promise is the loop's own: the link is theirs and permanent, and
   * the product gets better with a second closet in it. No numeral, no
   * urgency — the Today card's taste bar.
   */
  line: 'Cinch is better with a friend’s closet beside yours. Your link is yours for good — send it to whoever you’d borrow from.',
  action: 'Share your link',
  dismiss: 'Not now',
} as const;

export type InviteAskAction = 'share' | 'not_now';

export function inviteAskAnsweredProps(action: InviteAskAction): { action: InviteAskAction } {
  return { action };
}
