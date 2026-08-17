/**
 * DS-07 — the words on the one switch the whole Daily Social unit depends on.
 *
 * It lives in `features/privacy` rather than in the Daily Social feature
 * because the control it labels is a row on "What friends can see", beside the
 * four closet flags. Separate from the screen for the same reason
 * `visibility-copy.ts` is: a sentence that promises who can see what is worth
 * a test, and a test should not have to render React to read it.
 *
 * ── THE ONE THING THIS COPY MUST NOT DO ───────────────────────────────────
 *
 * It must not imply that a week of your history is about to appear. It is not.
 * `friend_worn_outfits` requires `worn_at >= worn_outfits_shared_since` as well
 * as the seven-day window, and a `before update` trigger stamps that boundary
 * with `now()` however the client writes it — so turning this on shares what
 * you wear FROM THAT MOMENT and nothing you already wore.
 *
 * The failure this guards against is specific and was caught in review before
 * implementation: a boolean plus a seven-day window would have exposed up to a
 * week of already-worn looks on the first tap. The database no longer can, and
 * the copy must not describe the version that could — a line reading "friends
 * can see your last seven days" would be false in exactly the direction that
 * makes somebody regret tapping.
 *
 * ── WHAT IT ALSO HAS TO SAY ───────────────────────────────────────────────
 *
 * Four columns cross and the omissions are the design. A person deciding
 * whether to turn this on is entitled to know that the note, the weather, the
 * occasion, the rating and what a piece cost them per wear are not part of the
 * deal, because every one of those is somewhere else in this app attached to
 * the same outfit.
 */

export const WORN_SHARING_SECTION = 'What you wear';

export const WORN_SHARING_LABEL = 'Share what you wear';

/**
 * The sub-line under the switch: what is true right now, not what the switch
 * would do. Same rule the four flags beside it follow.
 */
export function wornSharingState(shared: boolean): string {
  return shared
    ? 'On. Friends you follow back see what you wear from now, for seven days at a time.'
    : 'Off. Nothing you wear is shared.';
}

/**
 * The paragraph under the card, and the honest version of the offer.
 *
 * Four sentences, each carrying one fact somebody could otherwise be surprised
 * by: when sharing starts, what a friend actually sees, what happens if you
 * switch it off and on again, and the five things that never travel.
 */
export const WORN_SHARING_NOTE =
  'Turning this on starts from the moment you tap it. Friends you follow back see the pieces in a look, its name and the day you wore it, for seven days at a time. Nothing you wore before is ever shared, and switching this off and on again starts fresh rather than filling in the gap. Your note, the weather, the occasion, your rating and what a piece costs you per wear are never shared.';

/**
 * Why the switch goes inert while the closet is hidden.
 *
 * Not a courtesy. `friend_worn_outfits` carries `not p.closet_hidden`, so with
 * the closet hidden no look crosses however this is set. Leaving it operable
 * would let someone turn sharing on and change nothing, which is a control
 * that lies about its own effect — the same reason the three stat switches
 * above it go inert.
 */
export const WORN_SHARING_OVERRIDDEN_REASON =
  'Your closet is hidden, so friends see none of what you wear.';
