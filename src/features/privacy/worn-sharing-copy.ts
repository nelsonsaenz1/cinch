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
 * WHAT YOUR CIRCLE CAN SEE — DS-07's scope list, five headed facts.
 *
 * It was one paragraph of four sentences, and it said all of this. A paragraph
 * is the wrong shape for it: somebody standing at a privacy switch is not
 * reading, they are LOOKING FOR the one fact they are worried about, and five
 * facts running together at 13pt is where a person decides they have understood
 * and stops. The atlas heads each one, so the question a reader arrived with —
 * *who exactly* / *does my history appear* / *how long* / *does it say what it
 * cost* / *what about the things I hid* — is answerable by scanning five short
 * titles instead of parsing a block.
 *
 * The order is the order of alarm: audience first, then the retroactivity
 * question, which is the one somebody regrets getting wrong.
 *
 * Two of the five are new here rather than restyled. **"Hidden garments stay
 * hidden"** was in the atlas and in no sentence the app shipped — a person who
 * has taken the trouble to hide a piece is owed the fact that the trouble still
 * counts inside a shared look. And `WORN_SHARING_FOOTER` says what turning it
 * off does, which was the one promise in §6 with nowhere to read it.
 */
export const WORN_SHARING_SCOPE: readonly { title: string; body: string }[] = [
  {
    title: 'Mutual friends only',
    body: 'Friends you follow back, and no one else, ever.',
  },
  {
    title: 'Sharing starts now',
    body: 'Turning this on starts from the moment you tap it. Nothing you wore before is ever shared, and switching this off and on again starts fresh rather than filling in the gap.',
  },
  {
    title: 'Each look, up to seven days',
    body: 'A look leaves your circle’s Daily seven days after you wore it, on its own.',
  },
  {
    title: 'Pieces, outfit name, when worn',
    body: 'Friends see the pieces in a look, its name and the day you wore it. Your note, the weather, the occasion, your rating and what a piece costs you per wear are never shared.',
  },
  {
    title: 'Hidden garments stay hidden',
    body: 'A piece you have hidden from friends is left out of a shared look.',
  },
] as const;

/**
 * Every sentence the scope list makes, as one string.
 *
 * DERIVED, and deliberately not a second copy. The claims this control makes
 * are worth a test — `tests/daily-social-sharing.test.ts` reads this constant
 * for the promise about non-retroactivity, the five omissions and the seven-day
 * window — and a census assembled by hand beside the thing it censuses is a
 * census that passes after the rendered words have moved. Nothing draws this;
 * `WORN_SHARING_SCOPE` is what the page draws. Same arrangement, and the same
 * reason, as `NO_CIRCLE` in the Daily Social copy module.
 */
export const WORN_SHARING_NOTE = WORN_SHARING_SCOPE.map((scope) => scope.body).join(' ');

/**
 * What turning it off does, and how soon.
 *
 * §6's "revocation is immediate" had no sentence anywhere a person could read
 * it, which made the switch a one-way-looking control: everything printed
 * beside it described turning sharing ON. Somebody deciding whether to try this
 * is entitled to know the way back is instant and complete, because that is
 * what makes trying it a small decision rather than a large one.
 *
 * "Immediately" is the honest word. `friend_worn_outfits` reads
 * `worn_outfits_shared_since` per query, so the next fetch on a friend's device
 * already returns nothing — there is no sweep to wait for and no cache to
 * outlive.
 */
export const WORN_SHARING_FOOTER =
  'Turn it off and your looks leave your circle’s Daily immediately.';

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
