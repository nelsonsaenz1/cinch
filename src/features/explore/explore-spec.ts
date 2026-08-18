/**
 * EXPLORE (DAILY SOCIAL), AS DATA — redesign 17.
 *
 * Every word the page says and every layout decision it makes that is a
 * function of its inputs rather than of a renderer. The split is the one
 * `plan-week-spec.ts`, `closet-spec.ts` and `item-spec.ts` already make, for
 * the reason they give: a sentence that makes a promise about who can see
 * something is worth a test, and a test should not have to mount React to read
 * it.
 *
 * ── WHAT THIS FILE MAY NEVER GROW ───────────────────────────────────────────
 *
 * This page is Daily Social's front door, and its privacy constitution is
 * older than this redesign. Four rules govern every string below, and each is
 * asserted in `tests/explore-layout.test.ts` rather than trusted:
 *
 *   1. **No count of anybody's reaction, anywhere.** Reactions are visible to
 *      the look's OWNER only. Nothing on a card, in a label, or in a hint may
 *      state, imply or let a reader derive how many people reacted to
 *      anything. There is nothing to aggregate — `daily_social_reactions` has
 *      no count column and RLS shows a reactor only their own row — so a
 *      number here would be a number the app cannot get.
 *   2. **Sharing is off by default and nothing here changes that.** The one
 *      state whose action is about the reader (S-1b) sends them to their own
 *      switch and says outright that turning it on is not retroactive.
 *   3. **A hidden piece is silently absent.** No caption, no ghost cell, no
 *      footnote, no VoiceOver label. A reader must not be able to subtract
 *      their way to somebody's private decision.
 *   4. **Nothing implies more content past the end.** The unit is finite —
 *      seven days, then a look goes — and the ending says so in words.
 */

import { MIN_TAP_TARGET } from '@/theme/metrics';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * The look card's radius — the plate step, not the ledger line's 16.
 *
 * Redesign 17 makes an entry a LARGER card with a photograph at the top of it,
 * so it is furniture of the plate's size and takes the plate's curvature. The
 * old 16 belonged to the ledger-line card the timeline used to be, which is
 * now the secondary "also new" list below the looks and keeps its own smaller
 * radius (`ADDITION_CARD_RADIUS`).
 */
export const LOOK_CARD_RADIUS = 20;

/** The secondary additions list — a ledger line is smaller furniture. */
export const ADDITION_CARD_RADIUS = 16;

/**
 * The garment well's proportion — height ÷ width.
 *
 * A constant rather than a measurement: the well is the top of a card whose
 * width is the page measure minus the gutters, so `aspectRatio` lets Yoga do
 * the arithmetic and there is no `onLayout`, no measurement state and no
 * first-frame jump. 0.62 is the accepted frame's well over the accepted
 * frame's card (398 ÷ 714 at 2× ≈ 0.56 for a three-piece look, 523 ÷ 714 ≈
 * 0.73 for a taller one); one number between them keeps every card in a scroll
 * the same shape, which is what makes the feed read as one object repeated
 * rather than as cards of assorted heights.
 */
export const WELL_RATIO = 0.62;

/** The gap between garments inside the well. The app's grid gap, not a new one. */
export const WELL_GAP = 8;

/** The gap between two look cards in the feed. */
export const FEED_GAP = 16;

/**
 * How the pieces of one look sit inside the well.
 *
 * `plateGrid()` is the app's existing answer to this question and is
 * deliberately NOT reused here: it lays three pieces out as [2, 1], which is
 * right for Today's plate — a square-ish board where a 2/1 stack fills the
 * frame — and wrong for a wide landscape well, where the accepted frames put
 * every visible garment on ONE line at the same scale. A second function for a
 * second shape, rather than one function bent to two.
 *
 * The invariant is the same one and is asserted the same way: **every piece
 * lands in exactly one cell, and no cell is empty.** That is what makes a look
 * with fewer pieces than were worn compose as a complete frame rather than as
 * a grid with holes in it — a garment its owner hid is simply absent, and the
 * card must not read as broken when it is.
 */
export function wellRows<T>(pieces: readonly T[]): T[][] {
  if (pieces.length === 0) return [];
  if (pieces.length <= 4) return [[...pieces]];

  const rows: T[][] = [];
  const perRow = Math.ceil(pieces.length / Math.ceil(pieces.length / 3));
  for (let i = 0; i < pieces.length; i += perRow) {
    rows.push([...pieces.slice(i, i + perRow)]);
  }
  return rows;
}

/**
 * Whether the card's headline and its timestamp stop sharing a baseline.
 *
 * At standard sizes they sit across the measure — the serif line at the left
 * margin, the time at the right — which is the arrangement every dated row in
 * this app already uses. Two steps up, a long headline squeezing a timestamp
 * is the shrinking the accessibility contract forbids by name, so the two
 * stack and the card grows. Nothing is capped, clamped or scaled down.
 *
 * The threshold is `AX_FONT_SCALE`, the same number the reaction row and the
 * look name's cap-trim already read, so the card becomes its large-type self
 * all at once rather than one element at a time. It is passed in rather than
 * imported so this module stays free of the component graph.
 */
export function headlineStacked(fontScale: number, axScale: number): boolean {
  return Number.isFinite(fontScale) && fontScale >= axScale;
}

/** The circle sheet's rows. The app's floor, taken literally. */
export const CIRCLE_ROW_MIN_HEIGHT = MIN_TAP_TARGET;

/** The sheet's corner. The same value the month sheet spends. */
export const CIRCLE_SHEET_RADIUS = 28;

// ---------------------------------------------------------------------------
// The headline over a look
// ---------------------------------------------------------------------------

/**
 * "Priya wore the wool coat" — attribution and name as ONE serif line.
 *
 * The shipped card stacked them: a tracked uppercase eyebrow with the friend's
 * name, then the outfit's name in the serif below. Redesign 17 puts the
 * photograph first, and a tracked micro-label above a picture reads as a
 * caption on nothing. Set as one sentence it reads as what it is — a person,
 * and what they wore — which is also the sentence VoiceOver has always spoken
 * for this card (`lookAccessibilityLabel`).
 *
 * The unnamed case is not "Priya wore A look", which sounds like a bug. It is
 * the frame's own phrasing for a look with no name on it.
 */
export function lookHeadline(ownerName: string, name: string | null): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return `${ownerName} logged a day out`;
  return `${ownerName} wore ${trimmed}`;
}

// ---------------------------------------------------------------------------
// The new-since-visit divider
// ---------------------------------------------------------------------------

/**
 * "New since Tuesday" — the rule's word, from the boundary's own timestamp.
 *
 * UX-10's divider logic is untouched by this redesign: `unseen.ts` still
 * decides WHETHER a rule is drawn and WHICH row it sits above, from an
 * authoritative `created_at` that came back from the database. All this does
 * is name the day the boundary falls on, which is what the accepted frame
 * prints where the shipped page printed nothing.
 *
 * Falls back to the bare word when the boundary is unparseable or absent —
 * never to a guess, and never to a clock. Unproven means silent everywhere
 * else in this lane and it means unadorned here.
 */
export function newSinceLabel(boundary: string | null, now: Date = new Date()): string {
  if (!boundary) return EXPLORE_COPY.newSinceBare;
  const at = new Date(boundary);
  if (Number.isNaN(at.getTime())) return EXPLORE_COPY.newSinceBare;

  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()) /
      86_400_000,
  );

  if (days <= 0) return 'New since earlier today';
  if (days === 1) return 'New since yesterday';
  // Past a week a weekday name is ambiguous — "Tuesday" could be either one —
  // so it becomes the date, the same shape `dayLabel` prints.
  if (days >= 7) {
    return `New since ${at.getDate()} ${at.toLocaleDateString('en-US', { month: 'short' })}`;
  }
  return `New since ${at.toLocaleDateString('en-US', { weekday: 'long' })}`;
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/**
 * Every string this page types that is not already owned by
 * `features/daily-social/copy.ts`.
 *
 * The day's own six states keep their sentences there — they are the unit's
 * contract, tested by `daily-social-copy.test.ts`, and a second copy of them
 * here is how two surfaces come to promise different things. What lives here
 * is what redesign 17 ADDED: a masthead, two dividers, a designed ending, a
 * circle sheet, and two recoverable failures.
 */
export const EXPLORE_COPY = {
  /** The masthead. One display word; the second register is an eyebrow. */
  title: 'Explore',
  /**
   * The support line, which is now the day's own heading.
   *
   * It replaces "New in your circle." — a sentence about a different thing
   * (pieces added to a closet), which is what the page's SECONDARY section is
   * about now. The primary content is what people wore, and the masthead says
   * that.
   */
  support: 'What your circle wore',

  /** The header's one control — the door to friend management. */
  circleAction: 'Your circle',
  circleActionHint: 'Opens friends, search and your sharing switch',

  // The dividers ------------------------------------------------------------
  /** Used when the boundary cannot be dated. Never a guess at a day. */
  newSinceBare: 'New since your last visit',
  /** The other side of the rule. */
  earlier: 'Earlier',
  newSinceAccessibility: 'New since your last visit, above this line',

  // The ending --------------------------------------------------------------
  /**
   * THE DESIGNED ENDING — a mark, not a sentence in the margin.
   *
   * It says the window, not just that the scroll stopped: seven days is the
   * whole life of a shared look, and a reader who reaches the bottom has
   * genuinely seen all of it. Nothing here implies more past the end, because
   * there is none — no "load more", no sentinel, no spinner.
   */
  endingTitle: 'You’ve seen the whole week',
  endingBody: 'Looks stay readable for seven days, then they go.',
  endingAccessibility: 'You’ve seen the whole week. Looks stay readable for seven days, then they go.',

  /** The secondary timeline's own, quieter closure. */
  additionsEnding: 'That’s everything',

  // The secondary section ---------------------------------------------------
  additionsHeading: 'Also new in your circle',
  loadingHeading: 'Reading your circle',

  // Recoverable failures ----------------------------------------------------
  /**
   * The read failed. It says so, and refuses the claim an empty state would
   * make: nothing changed in anyone's closet, and this is not a quiet day.
   */
  offlineCause: 'Couldn’t reach your circle',
  offlineBody: 'This is a connection problem, not an empty circle. Nothing has changed for anyone.',
  offlineRetry: 'Try again',
  offlineBack: 'Back to Today',
  offlineFooter: 'When it recovers you’ll land where you left off.',

  /**
   * A reaction that did not save.
   *
   * "Nothing was sent" is the part that matters: the optimistic state has
   * already been rolled back, so the friend was not told anything, and a
   * reader who saw their tap undo itself needs to know that is the whole of
   * what happened.
   */
  reactionFailed: 'That didn’t save. Nothing was sent.',
  reactionRetry: 'Retry',

  // The circle sheet --------------------------------------------------------
  circleTitle: 'Your circle',
  circleBody: 'Explore only ever shows people you’re both friends with.',
  circleFriends: 'Friends',
  circleFind: 'Find someone',
  circleSharing: 'Sharing what you wore',
  circleSharingOn: 'On',
  circleSharingOff: 'Off',
  circleFooter: 'Turning sharing on starts from now and lasts seven days per look.',
  circleClose: 'Close',
} as const;

/**
 * The reaction row's privacy line, under the three chips.
 *
 * ── THE ONE SENTENCE THIS PAGE MOST HAD TO GET RIGHT ────────────────────────
 *
 * It states the AUDIENCE, and the audience is one person: the friend whose
 * look it is. It states no count, because there is none and never will be —
 * see this file's header, rule 1. And once a reaction is chosen it states the
 * way back out, because the press is reversible and a reader who tapped the
 * wrong chip should not have to guess.
 *
 * Named rather than "your friend": the promise being made is about a pair, and
 * a pair with a name in it is a promise a person can check.
 */
export function reactionPrivacyLine(
  ownerName: string,
  chosenLabel: string | null,
): string {
  if (chosenLabel) return `Tap ${chosenLabel} again to take it back.`;
  return `Only ${ownerName} can see what you pick.`;
}

/**
 * The circle sheet's inventory, as ids.
 *
 * Three doors and no fourth. Requests, blocks, the full friends list and the
 * report flow all live on the Friends screen; this sheet points at them rather
 * than duplicating them, which is the same discipline the row context menu
 * keeps (`contextual-actions.ts`). Nothing destructive is reachable from here:
 * a mis-tap on a sheet opened from a masthead must not be able to unfriend
 * anybody.
 */
export const CIRCLE_ACTIONS = ['friends', 'find', 'sharing'] as const;

export type CircleActionId = (typeof CIRCLE_ACTIONS)[number];
