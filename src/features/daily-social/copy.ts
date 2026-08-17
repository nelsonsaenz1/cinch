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

import { type DailyReaction } from './types';

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
 * Small numbers as words, up to the size a circle actually is.
 *
 * The atlas writes "four looks, then done" and not "4 looks", which is the
 * house voice everywhere else too. Twelve is where it stops because that is
 * where the circle stops (§1: one to a dozen mutual friends); past it a
 * numeral is plainer than "thirty-seven" and the sentence is doing a different
 * job anyway.
 */
const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
] as const;

function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/**
 * THE DAY, AND THE FACT THAT IT ENDS — the atlas's "Wednesday · four looks,
 * then done".
 *
 * Not decoration and not a count for its own sake. The atlas's gesture table
 * lists this line as the VISIBLE EQUIVALENT of scrolling to the end: a reader
 * who never scrolls, or who cannot, still learns the day is finite and how
 * finite. That is the same promise `CAUGHT_UP_LINE` keeps at the bottom, made
 * at the top where it is cheaper to act on.
 *
 * The weekday rides along for the reason `quietDayCoverage` carries its date —
 * a look stays readable for up to seven days, so "today" is the wrong word and
 * naming the day is the right one.
 *
 * It counts LOOKS, never garments. The number of looks is a fact about the
 * reader's own page; the number of pieces inside one is a measurement of what
 * an owner chose to hide, and nothing in this unit takes it.
 */
export function daySubtitle(lookCount: number, now: Date = new Date()): string {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const looks = lookCount === 1 ? 'one look' : `${countWord(lookCount)} looks`;
  return `${weekday} · ${looks}, then done`;
}

/**
 * The pieces of a look, named and joined — the atlas's outfit line.
 *
 * ── WHY THIS EXISTS AT ALL, GIVEN THE COLLAGE IS RIGHT THERE ────────────────
 *
 * Because the collage is not readable. The atlas marks it `aria-hidden` and
 * says so in as many words: "the visible pieces are read from the outfit line
 * instead, so no per-tile alt can hint at an omitted garment." A per-tile label
 * would put the owner's pieces in a list a reader could count position by
 * position; one sentence naming what is there says the same thing and offers
 * nothing to subtract from.
 *
 * Joined by " · " — the separator the card's own line uses and the one the
 * atlas draws. Never "and", which would make the last piece sound like the
 * completion of a set.
 *
 * **No count, and no ellipsis.** Every name that crossed is printed; there is
 * no "+2 more", because there is no more to have and saying so would be the
 * pagination affordance the unit refuses, applied to a wardrobe.
 */
export function piecesLine(names: readonly string[]): string {
  return names.filter((name) => name.trim()).join(' · ');
}

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
 *
 * It DOES name them, which is not the same thing and is the atlas's own
 * instruction: the collage is hidden from VoiceOver so that no per-tile label
 * can be counted off, and the pieces are read from the outfit line instead.
 * Without the line a reader hears that a look exists and never what it was.
 *
 * `position` is the atlas's "Look 1 of 4" — a place in a finite set, spoken
 * because the ending is the whole point of the unit and a reader swiping
 * through cards has no other way to feel one coming. It counts LOOKS, which is
 * a fact about this page, and never garments.
 */
export function lookAccessibilityLabel({
  ownerName,
  name,
  wornAt,
  pieces = [],
  position,
  now,
}: {
  ownerName: string;
  name: string | null;
  wornAt: string;
  /** The pieces that crossed, already named. Never a count of them. */
  pieces?: readonly string[];
  /** One-based place in the day, and the day's length. */
  position?: { index: number; total: number };
  now?: Date;
}): string {
  const look = name?.trim() ? name.trim() : UNNAMED_LOOK;
  const when = sinceLabel(wornAt, now ?? new Date());
  const worn = piecesLine(pieces);

  return [
    `${ownerName} wore ${look}.`,
    when ? `${when}.` : '',
    worn ? `${worn}.` : '',
    position ? `Look ${position.index} of ${position.total}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// ---------------------------------------------------------------------------
// S-1a · no circle
// ---------------------------------------------------------------------------

/**
 * S-1a IS ALREADY ON SCREEN, AND THIS IS A TRANSCRIPT OF IT.
 *
 * Explore's own empty hero has drawn the no-circle state since long before this
 * unit existed: an invitation rather than an error, no stranger suggestions, no
 * "people you may know", and "Find a friend" as the one way out. That is
 * exactly what §4 asks DS-01a to be, so the unit does not draw a second one —
 * two no-circle screens on one page is a worse answer than either.
 *
 * The strings are repeated here, once, so the contract's claims about S-1a can
 * be tested beside the other two emptinesses rather than being the one state
 * nothing checks. `tests/daily-social-copy.test.ts` asserts that every line
 * below still appears verbatim in `src/app/(tabs)/explore.tsx`, so this cannot
 * quietly drift into a second version of copy nobody renders.
 *
 * Nothing imports it to draw with. If a component ever does, that component is
 * the bug.
 */
export const NO_CIRCLE = {
  source: 'src/app/(tabs)/explore.tsx',
  title: 'An empty page, for now',
  body: 'This page fills with what your friends add to their closets. Find someone by username; when they add you back, their closet opens to you and yours to them.',
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
 * What VoiceOver reads on the GROUP of three — the atlas's "React to Maya's
 * look. Private to you and Maya."
 *
 * The audience is named here rather than only on each control because the
 * group is what a reader lands on first: the fact that this is seen by two
 * people and by nobody else should arrive before the three words do, not after
 * whichever one happened to be focused.
 *
 * It names the owner, which the chips deliberately do not. A chip says which
 * LOOK it belongs to, so five cards do not all announce "Sharp"; the group says
 * which PERSON, because the promise being made is about a pair.
 */
export function reactionGroupAccessibilityLabel(ownerName: string): string {
  return `React to ${ownerName}’s look. Private to you and ${ownerName}.`;
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
