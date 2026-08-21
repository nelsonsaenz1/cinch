/**
 * Item detail — what the screen decides before it draws. Redesign 15.
 *
 * A `.ts` with no React and no `.tsx` import, on the wave's rule: the node
 * bundler cannot parse React Native's Flow source, so anything a test needs to
 * read has to live where no component can reach it.
 *
 * ── THE THREE THINGS THIS PAGE MUST NEVER DO ────────────────────────────────
 *
 * INVENT A PRICE. There is no estimate, lookup, scrape, inference or default.
 * A piece with no price has no cost cell — not a blank one, not a dashed one,
 * not a zero. The only route to a price is the owner typing one.
 *
 * DIVIDE BY ZERO WEARS. A cost per wear on the day something arrives is
 * arithmetically true and reads as an accusation: the price over one wear is
 * the price, dressed as a judgement. Over zero wears it is not even that.
 *
 * INVENT A PAIRING. The rail shows what was actually worn together, or clearly
 * qualified colour suggestions from garments the owner actually owns, or
 * nothing. Filler in a rail that claims history is a lie told silently.
 */

// ---------------------------------------------------------------------------
// Price and cost per wear
// ---------------------------------------------------------------------------

/**
 * Which of the three price cells to draw, if any.
 *
 *   `rate`  — a price the owner typed AND wears to divide by.
 *   `paid`  — a price with no wears yet. The figure is the PRICE and the label
 *             stops calling it a rate, because it is not one.
 *   `null`  — no price. The cell is ABSENT.
 *
 * The third case is worth stating as a value rather than as a falsy check:
 * "absent" is a deliberate composition, and a component handed `undefined`
 * that drew an empty cell would satisfy the type and break the contract.
 */
export type PriceCell = 'rate' | 'paid' | null;

export function priceCell(price: number | null, wears: number): PriceCell {
  if (price === null) return null;
  return wears > 0 ? 'rate' : 'paid';
}

/**
 * The cost-per-wear figure, or null.
 *
 * Deliberately re-derived here rather than imported from `schemas/item.ts`, and
 * forced to agree with it by a test: this is the rule the whole page turns on,
 * and two independent statements a test holds together are worth more than one
 * statement two callers trust.
 */
export function costPerWearValue(price: number | null, wears: number): number | null {
  if (price === null) return null;
  if (wears <= 0) return null;
  return price / wears;
}

/** Whether the "no price recorded" prompt has a reason to exist. */
export function showsPricePrompt(price: number | null): boolean {
  return price === null;
}

// ---------------------------------------------------------------------------
// Pairings
// ---------------------------------------------------------------------------

/**
 * What the rail is showing, and it is never a guess dressed as history.
 *
 *   `coWear`  — real logged co-wear, each entry carrying how often.
 *   `harmony` — colour suggestions, under a DIFFERENT heading and an explicit
 *               qualifier, and only when there is no co-wear at all.
 *   `none`    — neither. The accepted no-data state, not a hidden section.
 */
export type RailMode = 'coWear' | 'harmony' | 'none';

export function railMode(coWearCount: number, harmonyCount: number): RailMode {
  if (coWearCount > 0) return 'coWear';
  if (harmonyCount > 0) return 'harmony';
  return 'none';
}

/**
 * The heading, which changes with the mode because the CLAIM changes.
 *
 * "Wears well with" over colour suggestions would be the app asserting a
 * history it does not have. The qualifier below says so again in prose,
 * because a heading is easy to skim past.
 */
export const RAIL_HEADING: Record<Exclude<RailMode, 'none'>, string> = {
  coWear: 'Wears well with',
  harmony: 'Pairs by color',
};

export const RAIL_QUALIFIER: Record<RailMode, string | null> = {
  coWear: 'Worn together before',
  harmony: 'Suggested by color — not worn together yet',
  none: null,
};

export const NO_PAIRING_COPY = {
  title: 'Nothing paired yet',
  body: 'Wear this with something and Cinch will remember the pairing. Until then there is nothing to show that would be true.',
} as const;

/** "Worn together 4×" — the evidence on a co-wear tile. */
export function coWearLabel(count: number): string {
  return `Worn together ${count}×`;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * The hero's preference order, as data rather than a chain of `??`.
 *
 * Listing first because the owner looked at it beside their own photograph and
 * said that is the piece; their photograph next; then nothing, which the caller
 * renders as the shared private fallback.
 *
 * ── SIGNED URLS ARE BEARER CREDENTIALS ──────────────────────────────────────
 *
 * The paths this returns are inputs to a signer, never strings for a person.
 * They must not be rendered as text, logged, placed in an analytics payload or
 * put in an accessibility label — anyone holding one holds the image.
 */
export function heroPathOrder(item: {
  listingPath?: string | null;
  cutoutPath?: string | null;
  thumbPath?: string | null;
}): (string | null | undefined)[] {
  return [item.listingPath, item.cutoutPath, item.thumbPath];
}

/**
 * Whether the neutral fallback is drawn — and it is drawn IDENTICALLY for all
 * three reasons.
 *
 * Missing, expired and unauthorized are one appearance on purpose. Any visible
 * difference would let somebody infer that a piece exists but is not theirs to
 * see, which is the inference this app refuses everywhere.
 */
export type ImageState = 'ok' | 'missing' | 'expired' | 'unauthorized';

export function usesFallback(state: ImageState): boolean {
  return state !== 'ok';
}

// ---------------------------------------------------------------------------
// Storage and delete
// ---------------------------------------------------------------------------

/**
 * What storing does, said in full.
 *
 * Reversible, and it KEEPS the wear history — the fact that makes it a real
 * alternative to deleting rather than a softer-sounding version of it.
 */
export function storeConsequence(wears: number): string {
  return wears > 0
    ? `Storage keeps the piece and its ${wears} ${wears === 1 ? 'wear' : 'wears'}, hides it from the closet grid, and you can restore it any time.`
    : 'Storage keeps the piece, hides it from the closet grid, and you can restore it any time.';
}

/**
 * What deleting forever costs, NAMED.
 *
 * The old copy said "removes the photo for good", which is true and is the
 * smallest part of it. What actually goes is the piece, its photographs and
 * every wear ever logged against it — and the wear history is the part nobody
 * expects to lose, because it is the part they never see a file for.
 *
 * The camera-roll sentence is the other half. Somebody who photographed a coat
 * in this app reasonably reads "its photographs are deleted" as covering the
 * picture still in their library, and hesitates over a destructive action for a
 * reason that is not real.
 */
export function deleteConsequence(wears: number): string {
  const history =
    wears > 0 ? ` and the ${wears} ${wears === 1 ? 'wear' : 'wears'} logged against it` : '';
  return `This removes the piece and its photographs from Cinch${history}. Pictures in your own camera roll stay where they are.`;
}

/** A destructive write that did not land, and what it did NOT do. */
export const DELETE_FAILURE_COPY = {
  title: 'That didn’t delete',
  body: 'Nothing was partly removed — the piece, its photographs and its wears are all still here. Try again in a moment.',
  retry: 'Try again',
  dismiss: 'Keep it for now',
} as const;

/**
 * Whether a sheet may be dismissed or re-submitted right now.
 *
 * False while a write is open, and it covers BOTH: a second tap that would
 * start a duplicate destructive write, and a dismissal that would leave one in
 * flight with nobody watching for its answer.
 */
export function sheetLocked(pending: boolean): boolean {
  return pending;
}

// ---------------------------------------------------------------------------
// Lending
// ---------------------------------------------------------------------------

/**
 * What a lending failure is allowed to say.
 *
 * ALWAYS ABOUT THE WRITE, NEVER ABOUT A PERSON. A failure that mentioned
 * reachability, an account, a block or a mute would answer a question the
 * asker did not ask and is not entitled to. There is one sentence, and it is
 * about this device's request.
 */
export const LENDING_FAILURE = 'That didn’t save. Nothing changed — try again in a moment.';

/** The switch's own explanation. Friend-scoped, and never public. */
export const LENDING_PRIVATE_NOTE = 'Only friends can ask. This is never public.';

/**
 * What the switch shows — the SERVER's value, always.
 *
 * A switch that flips optimistically and flips back on failure has told
 * somebody their piece is lendable when it is not, and the state it lands on
 * is the one they will remember. So the value never leads the write.
 */
export function lendingShows(serverValue: boolean): boolean {
  return serverValue;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** The hero yields height at an accessibility size so the type can have it. */
export const HERO_HEIGHT = 236;
export const HERO_HEIGHT_AX = 150;

export const BAND_RADIUS = 18;
export const BAND_CELL_PAD = 14;

export const ROW_MIN = 52;
export const ROW_RADIUS = 14;

export const SHEET_RADIUS = 28;
export const SHEET_PRIMARY = 56;
export const SHEET_SECONDARY = 52;

export const MIN_TARGET = 44;
export const MIN_TARGET_AX = 56;

export function heroHeight(ax: boolean): number {
  return ax ? HERO_HEIGHT_AX : HERO_HEIGHT;
}

export function targetHeight(ax: boolean): number {
  return ax ? MIN_TARGET_AX : MIN_TARGET;
}

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

export const ITEM_COPY = {
  noPriceTitle: 'No price recorded',
  noPriceBody: 'Add what you paid and Cinch will keep the cost per wear from then on.',
  addPrice: 'Add what you paid',

  wearsLabel: 'Worn',
  costLabel: 'Cost / wear',
  paidLabel: 'Paid',
  lastWornLabel: 'Last worn',
  neverWorn: 'Never worn',

  maintenance: 'Maintenance',
  storageOrDelete: 'Storage or delete',

  /** The listing colophon — a source line, never a merchant card. */
  listingPrefix: 'From',
} as const;
