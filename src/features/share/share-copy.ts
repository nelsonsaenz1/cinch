/**
 * The sentences a share actually carries.
 *
 * Pure strings, in a `.ts` with no React in it, for the reason `link.ts` gives:
 * `scripts/run-tests.mjs` bundles with esbuild and cannot parse React Native's
 * Flow source, so copy that lives beside a `<View>` cannot be asserted on. This
 * copy earns a test — see the marketing-constant rule below.
 *
 * WHY THE LINK IS INSIDE THE MESSAGE HERE AND IN THE `url` SLOT ELSEWHERE
 *
 * React Native's `Share.share` reaches `UIActivityViewController` through
 * `RCTActionSheetManager.mm:245-273`, which assembles `activityItems` from at
 * most two things: the `message` string, and ONE `url` converted to an `NSURL`.
 * There is no second URL slot and no array.
 *
 * So a share that carries an image has already spent its `url` on the PNG, and
 * the invite link has to travel inside the message text. A share that carries
 * no image spends its `url` on the link instead, which is strictly better: an
 * `NSURL` of its own is what makes Messages draw the preview card, and that
 * card's headline is `shareTitle()` served as `og:title` from
 * `web/api/invite.js:204`. The board shares below therefore return text alone —
 * their caller passes the link separately.
 *
 * THE MARKETING-CONSTANT RULE (positioning contract §3)
 *
 * No outfit count may appear as a constant in a static surface, and a share
 * message is the most static surface there is — it is composed on the device
 * and read on somebody else's. Nothing in this file interpolates a number, and
 * nothing in it may start to. "Ten pieces is a wardrobe" is the one
 * constant-safe line and it is not used here either: these are written in the
 * SHARER's first person, and a person does not quote a tagline at a friend.
 *
 * VOICE
 *
 * `docs/stylist-voice.md`, with one translation. The bible is written for the
 * stylist's voice; these lines arrive in somebody's thread from a friend's own
 * number, so they have to pass the pub test as a thing a person would type.
 * Dry, specific, one clause of reason, no exclamation marks, nothing off the
 * ban list, and never an explanation of what the app is — the link's preview
 * card already does that, and doing it twice is how a message reads as an ad.
 */

/** The two artifacts `sharePlate` can capture. */
export type ShareSubject = 'outfit' | 'packing';

/**
 * The line about the picture, one per artifact.
 *
 * Both name the wedge — the clothes are already yours — because that is the
 * only claim in the product that a recipient cannot say about every other
 * wardrobe app, and it is the claim the image itself proves.
 */
const OPENING: Record<ShareSubject, string> = {
  // Provable: the composer scores garments the user owns
  // (`src/features/styling/queries.ts` filters by `user_id`) and assembles them
  // on device (`src/lib/styling/generate.ts`).
  outfit: 'Everything in this is already mine. Cinch worked out what goes with what.',
  // "What repeats" is the memo card's own second column — `repeatLabel` at
  // `src/features/plan/packing-math.ts`, printed by `packing-memo-card.tsx`.
  packing: 'The whole bag for this trip. Cinch worked out the days, and what repeats.',
};

/**
 * The link's one line.
 *
 * It says what is behind the link rather than what the app is, because the two
 * things a tap genuinely does are provable and the adjectives are not:
 * `apply_invite()` makes the friendship on the spot
 * (`20260810120100_invite_links.sql`, "the invite is already accepted"), and a
 * friend can see every piece in your active closet
 * (`20260808110000_friend_closet_privacy_layer.sql:45`). "The closet it came
 * out of" is therefore literal, and it reads the same under an outfit as it
 * does under a packing list.
 */
const CLOSET_LINE = 'The closet it came out of is on Cinch:';

/**
 * What goes in the share sheet's `message` beside a captured card.
 *
 * The invite URL is appended rather than passed separately because the `url`
 * slot is holding the image — see the file header. A user with no handle has no
 * link (`useInviteLink` returns null for that, deliberately), and gets the
 * opening line alone rather than a sentence with a hole in it.
 */
export function plateShareMessage(subject: ShareSubject, inviteUrl: string | null): string {
  const opening = OPENING[subject];
  if (!inviteUrl) return opening;
  // A blank line, not a space: every share target that renders the message as a
  // block keeps the two ideas apart, and the ones that flatten it to a single
  // line still put a space between them.
  return `${opening}\n\n${CLOSET_LINE} ${inviteUrl}`;
}

/**
 * `Dana` → `Dana’s`. Typographic apostrophe, to match every other string in
 * the app.
 *
 * A name already ending in `s` still takes `’s` — Chicago's rule, and the one
 * that does not require the writer to know whether "Ross" is one person or a
 * family. No attempt is made to be clever about it: a display name is whatever
 * somebody typed, and a possessive heuristic that gets it wrong is worse than
 * one that is consistently plain.
 */
function possessive(name: string): string {
  return `${name}’s`;
}

/**
 * One posted look, shared off the board.
 *
 * The second sentence states the mechanic rather than the stakes — "one pick"
 * is what the board screen already tells its own members
 * (`src/app/event/[id]/outfits.tsx`, the subtitle) — because it is the part a
 * recipient cannot guess, and because it keeps the frame on the decision rather
 * than on the person. The voice bible's social rules forbid the alternative:
 * no leaderboard language, no comparison between two people's looks
 * (`docs/stylist-voice.md` §9).
 *
 * Tense-neutral on purpose. This control is on the card whether or not the
 * board has locked, so a sentence in the present continuous ("we're deciding")
 * would be stale the moment voting closed.
 */
export function lookShareMessage({
  posterName,
  mine,
  occasionTitle,
}: {
  /** The poster's display name, or null when it could not be resolved. */
  posterName: string | null;
  /** Whether the look being shared is the sharer's own. */
  mine: boolean;
  /** The occasion's title, or null. */
  occasionTitle: string | null;
}): string {
  const who = mine ? 'My look' : posterName ? `${possessive(posterName)} look` : 'A look';
  const where = occasionTitle ? `for ${occasionTitle}` : 'on the board';
  return `${who} ${where}. Everyone at the table gets one pick.`;
}

/**
 * The whole board, shared once it has locked.
 *
 * Only reachable from the locked state, so "closed" is a fact rather than a
 * guess. Nothing here counts the looks or the picks: those numbers are on
 * screen, computed, and they stay there.
 */
export function boardShareMessage(occasionTitle: string | null): string {
  // Without a title there is no subject to hang the dash off, and "The board —
  // the board's closed" says it twice. The sentence stands on its own.
  if (!occasionTitle) return 'The board’s closed and the picks are in.';
  return `${occasionTitle} — the board’s closed and the picks are in.`;
}
