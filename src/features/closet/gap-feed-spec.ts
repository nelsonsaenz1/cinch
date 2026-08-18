import { gapNoun } from './gap-feed';
import type { CountedKind } from './outfit-count';

/**
 * The Gap Feed and its shop — what the screens decide before they draw.
 * Redesign 26.
 *
 * A `.ts` with no React and no `.tsx` import, on the wave's standing rule: the
 * node test bundler cannot parse React Native's Flow source, so anything a test
 * needs to read has to live where no component can reach it. Same split, and
 * the same reason, as `storage-spec.ts` and `walkthrough-spec.ts`.
 *
 * ── WHAT THIS FILE IS NOT ALLOWED TO KNOW ──────────────────────────────────
 *
 * NOTHING ABOUT COMMERCE. Not a merchant, not a price, not a link, not the
 * word "paid". `commerce-directive.md` §0 forbids commission influencing what
 * Cinch recommends or in what order, and `tests/commerce-isolation.test.ts`
 * enforces the ranking module's half of that as a source check on
 * `outfit-count.ts` and `gap-feed.ts`. This file sits beside those two and
 * holds the same line by construction: it decides the LAYOUT of a computed
 * gap, and a layout that consulted a shop would be the ranking reading
 * commerce through a side door. The tray's own copy stays in
 * `features/commerce/copy.ts`, which is where the disclosure law already
 * keeps it.
 *
 * ── THE GAP IS THE PRODUCT; SHOPPING IS THE FOOTNOTE ───────────────────────
 *
 * Redesign 26's brief is "gap cards led by the outfit-you-can't-make imagery".
 * That inverts the shipped card, which led with a headline and a paragraph and
 * put three thumbnails underneath as supporting evidence. The imagery now runs
 * FIRST and the prose is cut to one line, which is the wave's "less text,
 * always" applied to the one screen where a picture genuinely says it: two
 * garments you own and a marked absence where the third would go IS the
 * sentence "you own these and nothing to wear with them".
 *
 * The absence is DRAWN, never sourced. `ABSENCE` below is a dashed blush well
 * and a noun — no photograph of a garment nobody owns has ever appeared on
 * this screen and none appears now.
 */

// ---------------------------------------------------------------------------
// Rank
// ---------------------------------------------------------------------------

/**
 * "Biggest gap", "Second gap", "Third gap" — the card's rank, in words.
 *
 * Words rather than a numeral because the eyebrow is tracked uppercase at 11pt
 * and a lone digit at that size reads as a badge. Ranks past the third are not
 * reachable — the feed draws at most three cards (`FEED_CARDS`) — but the
 * function answers for them anyway rather than throwing, because the gap detail
 * route takes a `kind` from the URL and can be opened on a kind the feed did
 * not list.
 */
export function rankEyebrow(index: number): string {
  switch (index) {
    case 0:
      return 'Biggest gap';
    case 1:
      return 'Second gap';
    case 2:
      return 'Third gap';
    default:
      return 'A gap';
  }
}

/** The most cards the feed will draw. C-01's ranked list, capped. */
export const FEED_CARDS = 3;

/**
 * The most merchant rows one tray may hold — C-01's cap, restated on the
 * client that must obey it.
 *
 * It lives HERE rather than in `shop-row.tsx` for one reason: the node test
 * bundler cannot parse React Native's Flow source, so a cap declared in a
 * `.tsx` is a cap no test can read. It happens to equal `FEED_CARDS`, and the
 * two are separate constants because they are separate rules — one is how many
 * gaps get a card, the other is how many shops may appear under one of them,
 * and a future change to either must not silently move the other.
 *
 * Naming it here does not make this module know about commerce: it is a COUNT,
 * with no merchant, price or link anywhere near it. The server enforces the
 * same cap independently (`MAX_MERCHANTS` in `gap-shop-match/policy.ts`), and
 * this one only stops the client drawing more than it was sent.
 */
export const MAX_MERCHANT_ROWS = 3;

// ---------------------------------------------------------------------------
// The marked absence
// ---------------------------------------------------------------------------

/**
 * The noun inside the dashed well — "TOP", "BOTTOM", "DRESS", "SHOES".
 *
 * Uppercased by the type variant, not here, so the string a screen reader
 * speaks is a word rather than four shouted letters at a time.
 *
 * Shoes are the exception the whole gap vocabulary keeps making: `gapNoun`
 * gives "pair of shoes", which is right in a sentence and far too long for a
 * 100pt well. The well says "shoes", the sentence still says "a pair of
 * shoes", and neither is wrong about the same garment.
 */
export function absenceNoun(kind: CountedKind): string {
  return kind === 'shoes' ? 'shoes' : gapNoun(kind, 1);
}

// ---------------------------------------------------------------------------
// The masthead's one line
// ---------------------------------------------------------------------------

export interface MastheadFacts {
  /** The active shelf is at its ceiling. */
  readonly activeFull: boolean;
  /** Every slot the account holds is taken, stored ones included. */
  readonly totalFull: boolean;
  /** How many gap cards are actually about to be drawn. */
  readonly cards: number;
}

/**
 * The sentence under "What your closet is missing".
 *
 * At a ceiling it names the ceiling, because that is the fact that governs
 * every card beneath it — and the TOTAL ceiling wins when both are hit, on the
 * same arithmetic `storage-spec.ts` records: storing frees an active place and
 * moves the total by nothing, so a screen at both limits must not be told that
 * storing helps.
 *
 * Otherwise it counts the cards ACTUALLY DRAWN. "Three gaps" over two cards is
 * a small lie the reader can see, and the whole screen's claim is that its
 * arithmetic is checkable.
 */
export function mastheadLine(facts: MastheadFacts): string {
  if (facts.totalFull) return 'Every slot you have is taken, stored pieces included.';
  if (facts.activeFull) return 'Your active shelf is full, so adding means swapping first.';

  const word = facts.cards === 1 ? 'One gap' : facts.cards === 2 ? 'Two gaps' : 'Three gaps';
  return `${word}, computed from what you own.`;
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/**
 * The copy tables, kept out of the components so a test can read them.
 *
 * Nothing here mentions a merchant, a price or a commission — see the header.
 */
export const GAP_FEED_COPY = {
  title: 'What your closet is missing',

  /**
   * The well under a garment with no photograph.
   *
   * A DESIGNED CELL, NEVER A BLANK WELL — the standing refusal this feed has
   * held since the first build. A count or a word in sand reads as intentional
   * where an empty photograph well reads as an image that failed, and the frame
   * for this state draws exactly that.
   */
  noPhoto: 'No photo',

  /**
   * Too small a closet to have a gap worth naming.
   *
   * The frame spells the count ("With four pieces…") and this prints the real
   * one, for the reason `storage-spec.ts` records at length: a spelled number
   * is a TYPED number, and a sentence that cannot follow the data starts lying
   * the moment the data moves.
   */
  empty: {
    absence: 'Not enough yet',
    body: (pieces: number) =>
      pieces === 1
        ? 'With one piece there is not yet a gap worth naming. Add a few more and this fills in.'
        : `With ${pieces} pieces there is not yet a gap worth naming. Add a few more and this fills in.`,
    action: 'Add clothes',
  },

  /**
   * The wardrobe read failed. NOT an empty state, and the distinction is the
   * whole point: this is a screen about what somebody owns, and telling them
   * their closet is empty over a dropped connection is the one thing it must
   * never do.
   */
  readError: {
    title: 'We could not read your closet',
    body: 'Nothing has changed. Your pieces are safe on the server.',
    action: 'Try again',
    retrying: 'Trying again…',
  },

  /** The AX affordance — at largest type only one card fits a viewport. */
  scrollHint: (remaining: number) =>
    remaining === 1 ? 'Scroll for the second gap' : 'Scroll for the second and third gap',

  /** Under a dominant gap: what the runner-up would actually buy you. */
  nothingElseComesClose: (label: string) =>
    `Nothing else comes close: ${label} adds nothing at all until there’s something new to wear it with.`,

  detail: {
    /** The pinned footer above the one primary action. */
    room: 'There’s room in your closet for this one.',
    full: (limit: number) => `Your closet is full at ${limit} active pieces.`,
    addAction: 'Add clothes',
    plansAction: 'See plans',
    presenting: 'Opening…',
    /**
     * The paywall came back with nothing bought. Names the two facts that
     * matter — nothing moved, and the gap is still here — and offers the same
     * door again rather than treating a cancellation as a failure.
     */
    cancelled: 'Nothing changed. Your closet is the same as before.',
    /** One outfit the missing piece would complete. `pieces` are real, owned names. */
    rowCaption: (pieces: readonly string[]) =>
      pieces.length === 1 ? `With the ${pieces[0]}` : `With the ${pieces.join(' and the ')}`,
    more: (n: number) => (n === 1 ? 'and one more' : `and ${n} more`),
  },
} as const;

// ---------------------------------------------------------------------------
// Geometry — the artifact's own measurements
// ---------------------------------------------------------------------------

/**
 * The gap card.
 *
 * `radius` 20 is the wave's warmed card radius, one step above the plate
 * family, and the frames draw the lead card and the compact runner-up rows at
 * the same value so the three read as one object in two sizes.
 */
export const CARD = {
  radius: 20,
  padding: 18,
  /** The tray footer's own inset, which is the card's padding on three sides. */
  trayPaddingX: 18,
  trayPaddingTop: 14,
  trayPaddingBottom: 16,
  /** Between cards on the feed. */
  gap: 12,
} as const;

/**
 * The imagery row — three equal wells across the card.
 *
 * THREE, ALWAYS, and the last one is the absence. Two owned pieces and a
 * marked gap is the composition the brief names ("the outfit you can't make"),
 * and a row that sometimes drew four would turn a picture of one missing
 * garment into a gallery.
 *
 * A closet with fewer than two pairable pieces draws fewer owned wells and the
 * absence still sits last — the row shrinks, it does not pad itself with
 * garments nobody owns.
 */
export const TILE = {
  /** (393 − 2×20 gutter − 2×18 padding − 2×8 gap) ÷ 3 = 100.3. */
  size: 100,
  height: 112,
  radius: 12,
  gap: 8,
  /** Owned wells at largest Dynamic Type — the row yields height, never a column. */
  axHeight: 96,
  /** The detail screen's outfit rows run the same three wells, slightly larger. */
  detailHeight: 118,
} as const;

/** The dashed well where the missing piece goes. Drawn, never sourced. */
export const ABSENCE = {
  borderWidth: 1,
  dashLength: 5,
  /** The "+" above the noun. */
  plusSize: 26,
  nounSize: 11,
  nounTracking: 1.2,
} as const;

/** One merchant row in the tray. Geometry only — the copy is commerce's. */
export const MERCHANT_ROW = {
  radius: 12,
  paddingX: 13,
  paddingY: 11,
  gap: 11,
  thumbWidth: 40,
  thumbHeight: 48,
  thumbRadius: 8,
  axThumbWidth: 48,
  axThumbHeight: 58,
  /** The unstacked AX form's own action block. */
  axActionHeight: 48,
} as const;

/** The product sheet. */
export const SHEET = {
  /** The full-bleed product picture, as a fraction of the sheet's height. */
  heroRatio: 0.42,
  radius: 20,
  grabberWidth: 44,
  grabberHeight: 5,
  thumbWidth: 92,
  thumbHeight: 112,
  thumbRadius: 14,
  paddingX: 20,
} as const;

export const CONTROL = {
  primaryHeight: 56,
  primaryHeightAx: 62,
  radius: 14,
} as const;

export const TYPE = {
  /** The masthead serif. */
  masthead: 34,
  mastheadLineHeight: 38,
  mastheadAx: 30,
  /** The lead card's headline. */
  headline: 30,
  headlineLineHeight: 33,
  headlineAx: 28,
  /** A runner-up row's headline. */
  compactHeadline: 24,
  compactHeadlineLineHeight: 27,
  /** The one supporting line. */
  supporting: 16,
  supportingLineHeight: 24,
  supportingAx: 20,
  supportingAxLineHeight: 29,
  eyebrow: 11,
  eyebrowAx: 14,
  eyebrowTracking: 1.4,
  /** The detail screen's title. */
  detailTitle: 32,
  detailTitleLineHeight: 36,
} as const;
