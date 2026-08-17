/**
 * EVERY WORD THE DAILY UNIT SAYS.
 *
 * A `.ts` and not a component, for the reason every copy module in this
 * codebase is one: a sentence that makes a promise about who can see something
 * is worth a test, and a test should not have to render React to read it.
 * `features/privacy/visibility-copy.ts` made the same split for the same
 * reason, and `tests/daily-social-copy.test.ts` is what it buys.
 *
 * ── THE THREE EMPTINESSES ARE THREE DIFFERENT PROBLEMS ─────────────────────
 *
 * S-1a, S-1b and S-2 all arrive as a page with no looks on it, and they are
 * not the same page:
 *
 *   · **S-1a — no circle.** You have nobody. The action is to find someone.
 *     Never a stranger suggestion and never "people you may know": profiles
 *     default to `'private'` and this app has no public discovery to offer.
 *   · **S-1b — nobody sharing yet.** You have friends and none of them has
 *     turned sharing on. This is the state most people meet on day one, and
 *     "invite more people" is the wrong answer to it — more friends who are
 *     also not sharing changes nothing. The only action about YOU in the whole
 *     unit lives here: go first.
 *   · **S-2 — a quiet day.** Everything works and nothing happened. Not an
 *     error, not empty-styled, and it must not read as a fault.
 *
 * They must not share a sentence, and the copy test asserts it rather than
 * trusting it — three near-identical empties is exactly what happens when the
 * words are written at the call site three weeks apart.
 *
 * ── WHAT MAY NEVER APPEAR HERE ─────────────────────────────────────────────
 *
 * **No count, inference or hint of a hidden piece.** A friend can hide a
 * garment from friends, and a shared look then renders with fewer pieces than
 * were worn. Nothing anywhere — no caption, no footnote, no VoiceOver label —
 * may say "1 piece hidden", "and more", or anything a reader could subtract to
 * get the same answer. A short look is just a short look. This cue and its
 * VoiceOver label were REMOVED from DS-03 in the accepted atlas after review,
 * and this file is where they would come back.
 *
 * **Nothing that implies more content past the end.** No "load more", no
 * "keep scrolling", no "3 new". The unit is finite and says so.
 *
 * **No count of people.** No followers, no likes, no views, no tally of who
 * reacted. There is nothing to aggregate by construction and there must be
 * nothing that reads as if there were.
 */

import { CAUGHT_UP_LINE } from '@/features/explore/feed';
import { sinceLabel } from '@/features/explore/timeline';

import { type DailyReaction } from './contract-types';

/**
 * The end of the day, imported rather than retyped.
 *
 * `features/explore/feed.ts:51` already ships this exact sentence, and the
 * contract's §1 names it as the line Daily Social ends on. Two surfaces that
 * both claim to end a circle must end it in the same words or one of them is
 * lying about being the same idea; a second copy here is how they drift.
 */
export { CAUGHT_UP_LINE };

// ---------------------------------------------------------------------------
// The day itself — S-3
// ---------------------------------------------------------------------------

/**
 * The heading over the looks.
 *
 * Not "Today in your circle": a look stays readable for up to seven days, so a
 * heading that says "today" would be wrong about a look worn on Tuesday. Not
 * "New in your circle" either — Explore already prints that sentence about a
 * different thing (pieces added to a closet), and two tabs claiming the same
 * words about different content is how a reader stops trusting either.
 */
export const DAY_HEADING = 'What your circle wore';

/** The name a look carries when its owner never gave it one. */
export const UNNAMED_LOOK = 'A look';

/**
 * The card's one accessible sentence: whose it is, what it is called, when.
 *
 * Composed rather than left to VoiceOver's default traversal because the card
 * is a picture, a serif line and a tracked date, and swiping through three
 * fragments of that is worse than hearing the fact once.
 *
 * **It does not count pieces**, and that is deliberate rather than an
 * oversight. `plate.tsx` announces "Outfit, <name>, <n> pieces" and is right
 * to: that is the reader's own look and the count is a fact about it. Here the
 * number of pieces on screen is the number the OWNER allowed to cross, so a
 * spoken count is a spoken measurement of what they hid. Nothing anywhere in
 * this unit counts them.
 */
export function lookAccessibilityLabel({
  ownerName,
  name,
  wornAt,
  now,
}: {
  ownerName: string;
  name: string | null;
  wornAt: string;
  now?: Date;
}): string {
  const look = name?.trim() ? name.trim() : UNNAMED_LOOK;
  const when = sinceLabel(wornAt, now ?? new Date());
  return when ? `${ownerName} wore ${look}. ${when}.` : `${ownerName} wore ${look}.`;
}

// ---------------------------------------------------------------------------
// S-1a · no circle
// ---------------------------------------------------------------------------

export const NO_CIRCLE = {
  symbol: 'person.2',
  title: 'Nobody in your circle yet',
  /**
   * Names the one action, and says what makes it work — mutual, both ways.
   * There is no stranger to suggest here and there will not be one: a public
   * surface would need `profiles.visibility`'s default inverted, which is not
   * something a screen gets to do.
   */
  body: 'This fills with what the friends you follow back have worn. Find someone by username; once you follow each other, their looks can land here.',
  action: 'Find a friend',
} as const;

// ---------------------------------------------------------------------------
// S-1b · mutuals exist, nobody has turned sharing on
// ---------------------------------------------------------------------------

export const NOBODY_SHARING = {
  symbol: 'tshirt',
  title: 'You could go first',
  /**
   * The only state whose action is about the reader, and the sentence has to
   * carry the non-retroactivity with it — someone turning sharing on from this
   * screen is making a decision about their own history and must not be
   * surprised by it. "From the moment you turn it on" is the whole promise
   * `worn_outfits_shared_since` exists to keep; "never anything you have
   * already worn" is the half a boolean would have broken.
   *
   * It does NOT say "invite more people". More friends who are also not
   * sharing changes nothing about this page.
   */
  body: 'Your friends are here, and none of them is sharing what they wore yet. Turn yours on and they will see what you wear from that moment — never anything you have already worn.',
  action: 'Turn on sharing',
} as const;

// ---------------------------------------------------------------------------
// S-2 · a quiet day
// ---------------------------------------------------------------------------

export const QUIET_DAY = {
  title: 'A quiet day',
  /**
   * Says the day was quiet and that this is fine. No apology, no glyph of
   * distress, and nothing suggesting a retry would produce different looks —
   * the read succeeded.
   */
  body: 'Nobody in your circle has worn anything new. That happens, and it is not a fault of yours or the app’s.',
} as const;

/**
 * The date a quiet day covers — §4's "the caught-up line, and the date it
 * covers".
 *
 * The date is the point. Without it "nothing new" is indistinguishable from a
 * page that never loaded, and a reader who opens the unit twice on the same
 * quiet day gets no way to tell the second read happened at all.
 *
 * `now` is injectable so the boundary is testable without waiting for
 * midnight, and defaulted so no call site constructs a clock — the same
 * convention `features/explore/timeline.ts` set.
 */
export function quietDayCoverage(now: Date = new Date()): string {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  return `Covering ${weekday} ${now.getDate()} ${month}.`;
}

// ---------------------------------------------------------------------------
// S-4 · the end
// ---------------------------------------------------------------------------

/**
 * What VoiceOver hears at the end.
 *
 * The line itself and nothing appended. A hint like "swipe for more" would be
 * the pagination affordance the contract forbids, spoken instead of drawn.
 */
export const CAUGHT_UP_ACCESSIBILITY_LABEL = CAUGHT_UP_LINE;

// ---------------------------------------------------------------------------
// S-5 · offline
// ---------------------------------------------------------------------------

export const OFFLINE = {
  /**
   * The caps oxblood lead-in `ErrorState` draws in place of the warning glyph.
   * It is where this state SAYS OFFLINE in one word, which is what makes it
   * unmistakable against S-2 at a glance rather than only on a careful read.
   */
  kicker: 'OFFLINE',
  title: 'Cinch can’t reach your circle',
  /**
   * Two jobs, and the second is the one that matters. It says the blank page
   * is the connection — and then it refuses the claim an empty state would
   * make: nothing has changed in anyone's closet, and this is not a quiet day.
   * Never the reverse: the network is never offered as an explanation for
   * emptiness.
   */
  body: 'You may be offline, or the connection dropped part-way. This is not a quiet day — nothing in anyone’s closet has changed, and the looks come back when the connection does.',
  action: 'Try again',
} as const;

// ---------------------------------------------------------------------------
// The three reactions
// ---------------------------------------------------------------------------

/**
 * Exactly three, fixed, in this order — DS-06, accepted in the atlas.
 *
 * All positive or neutral, none negative: there is no dislike, no downvote and
 * no "not for me", so nothing here can be read as a point on a scale. Closer
 * to noticing than to rating, which is what makes the set safe to leave
 * uncounted.
 */
export const REACTION_LABELS: Record<DailyReaction, string> = {
  sharp: 'Sharp',
  cozy: 'Cozy',
  noted: 'Noted',
};

/**
 * What VoiceOver reads on a reaction control.
 *
 * The look's name rides along because a reader swiping a page of five cards
 * hears "Sharp" five times otherwise and cannot tell which look they are about
 * to react to. Whether it is the CHOSEN one is carried by
 * `accessibilityState.selected`, not by the label — a label that changed to
 * "Sharp, chosen" would announce the change twice for a reader who has both.
 */
export function reactionAccessibilityLabel(
  reaction: DailyReaction,
  lookName: string | null,
): string {
  const look = lookName?.trim() ? lookName.trim() : UNNAMED_LOOK;
  return `${REACTION_LABELS[reaction]}, on ${look}`;
}

/**
 * The hint under every reaction, identical for all three.
 *
 * States the audience, because that is the fact a person needs before they
 * press: this is seen by the two of you and by nobody else. It also states
 * that the press is reversible, which is true — the row is a primary key on
 * `(outfit_id, reactor_id)`, so pressing again is an update or a delete and
 * never a second reaction.
 *
 * No count and no tally, spoken or drawn. There is nothing to aggregate.
 */
export const REACTION_HINT =
  'Only you and the person who wore this can see it. Press again to take it back.';
