/**
 * The words commerce-directive.md pins exactly, in one place.
 *
 * Mirrors `supabase/functions/_shared/commerce.ts`'s `PAID_LINK_LABEL` rather
 * than importing it — that file is a Deno module (`Deno.env`, `npm:` specifiers)
 * and cannot cross into the Expo bundle. Two constants, not one shared import,
 * but both equal the same two words and a grep for "Paid link" finds both.
 */

/**
 * §4 / §6 refusal 8: never abbreviated, greyed, or hidden behind an icon.
 *
 * ONLY for a link that actually earns. `ShopMatch.paid` is computed server-side
 * from `commerce_joined_programmes` — a table of CONFIRMED programme approvals
 * — and not from whether a tracking URL could be built. Those are different
 * facts: a redirect resolves for any merchant on a network we hold a publisher
 * id for, whether or not that merchant has approved us.
 *
 * Until 2026-08-11 this label was rendered on every result unconditionally,
 * while Awin reported zero joined programmes. Every one of them was a
 * disclosure telling the user we were paid to show them something when we were
 * not — a false claim about our own motives, made to their disadvantage.
 */
export const PAID_LINK_LABEL = 'Paid link';

/**
 * What an ordinary, unmonetised result says instead.
 *
 * It is not a quieter version of the paid label and it is not an apology. It
 * states where the tap goes, which is all that is true about it. Showing
 * nothing at all would be worse: the user would have no idea a tap leaves the
 * app, and the absence of a disclosure would itself imply the presence of one
 * elsewhere.
 */
export const OPEN_AT_MERCHANT_LABEL = 'Open at merchant';

/** The line for one result, chosen by whether it genuinely earns. */
export function linkDisclosure(paid: boolean): string {
  return paid ? PAID_LINK_LABEL : OPEN_AT_MERCHANT_LABEL;
}

/**
 * GF-02 · what a merchant ROW's action reads.
 *
 * PER ROW, NEVER PER BLOCK (correction 19, dependency D-4). `paid` is
 * `ShopMatch.paid`, which the edge function sets only from a CONFIRMED joined
 * programme — so a joined row is the only row that ever carries the marker,
 * and it carries it in its own right rather than inheriting one from a header
 * over the whole tray. The tray-level marker that used to sit above these rows
 * was false for every direct row underneath it.
 *
 * A joined row reads "Open" with `PAID_LINK_LABEL` beneath it; a direct row
 * reads "Open at Uniqlo" and carries no marker at all, because the action IS
 * its disclosure — it names where the tap goes and claims nothing about money.
 */
export function openLabel(paid: boolean, merchantName: string): string {
  return paid ? 'Open' : `Open at ${merchantName}`;
}

/**
 * GF-03's action on a DIRECT product sheet.
 *
 * The generic wording, not the merchant's name: a direct sheet's whole point
 * is that Cinch has no arrangement with whoever is on the other side, and the
 * atlas words it this way so the sentence cannot be read as an endorsement.
 * A joined sheet says `Open {merchant}` instead — see `openSheetLabel`.
 */
export const OPEN_AT_THE_MERCHANT_LABEL = 'Open at the merchant';

/** GF-03's action, joined or direct. */
export function openSheetLabel(paid: boolean, merchantName: string): string {
  return paid ? `Open ${merchantName}` : OPEN_AT_THE_MERCHANT_LABEL;
}

/**
 * GF-02's commission sentence — present ONLY when at least one paid row is
 * actually on screen (correction 19), and naming all three things a commission
 * does not touch.
 *
 * `paidCount` rather than a boolean because the sentence points at the rows it
 * is about ("the paid link above" / "the paid links above"), and a plural that
 * does not agree with what is visible is the same species of small lie the
 * block-level marker was.
 *
 * Returns null on a direct-only tray. Not an empty string: a caller that
 * renders `''` into a `<Text>` still draws an empty line, and the rule is that
 * the sentence is ABSENT.
 */
export function commissionSentence(paidCount: number): string | null {
  if (paidCount <= 0) return null;
  const link = paidCount === 1 ? 'the paid link above' : 'the paid links above';
  return `Cinch may earn a commission on ${link}. It does not change the gap, the match or the order.`;
}

/**
 * GF-02 / AX's shorter form of the same sentence.
 *
 * Shorter because at the largest type it grows to 16pt and shares the tray
 * with a merchant card that has already unstacked; it still names that neither
 * what is shown nor the order changes. It is NOT a quieter disclosure — it is
 * the same claim with the gap/match pair collapsed into "what is shown".
 */
export function commissionSentenceShort(paidCount: number): string | null {
  if (paidCount <= 0) return null;
  return 'Cinch may earn a commission. It does not change what is shown or the order.';
}

/**
 * GF-03's commission paragraph — again only when the sheet's own product is a
 * paid row. On a direct sheet it is absent entirely rather than softened.
 */
export function commissionParagraph(paid: boolean, merchantName: string): string | null {
  if (!paid) return null;
  return `Opening this goes to ${merchantName}’s own page. Cinch may earn a commission if you buy, and that commission does not change what is suggested or the order suggestions appear in.`;
}

/**
 * Correction 12 · where the picture and the price came from.
 *
 * The RETAILER is named as the source of both, and staleness is admitted
 * rather than implied — the feed is a licensed catalogue snapshot, not a live
 * read of the shop's own page, so a price on this sheet can be out of date and
 * saying so is the only honest option.
 *
 * This agrees with what the app already discloses on Privacy → Shopping
 * partners ("The pictures beside each result are the shops’ own"); it does not
 * replace it, and it does not name the listing service, which that page names
 * in full where the full answer belongs.
 */
export function provenanceLine(merchantName: string): string {
  return `Price and picture come from ${merchantName} and may be out of date.`;
}

/**
 * The second provenance line — the listing service, unnamed.
 *
 * Correction 12 reserves this line for a configurable retailer-plus-service
 * attribution and refuses to invent partner legal wording in the meantime. The
 * service IS named, in full, on Privacy → Shopping partners
 * (`features/privacy/copy.ts`), which is the surface that owes the complete
 * answer; naming it again in six words on a product sheet would be a partial
 * answer standing in front of a complete one.
 */
export const LISTING_SERVICE_LINE = 'Found through Cinch’s listing service.';

/** GF-02's conditional clause introducing the merchant tray. */
export const BUY_CLAUSE = 'If you want to buy one';

/**
 * C-02's header paragraph — verbatim from the directive, disclosed every
 * single time the sheet opens, never a "don't show this again" that would
 * make the second-and-every-later opening silently undisclosed.
 */
export const SHOP_SHEET_DISCLOSURE =
  'If you buy through one of these, Cinch earns a small commission. It does not change what we recommend — the ranking above is computed from your closet before any shop is consulted.';

/**
 * C-02's paragraph, chosen by whether the sheet actually holds a paid row.
 *
 * Correction 19's rule, applied to the older list sheet as well as to GF-02's
 * tray: a commission sentence over a sheet where nothing earns is the same
 * false claim the block-level "Paid link" marker was, just in a paragraph. The
 * direct-only form still states the ranking rule, which is the half of the
 * disclosure that is true in both cases.
 */
export function shopSheetDisclosure(paidCount: number): string {
  if (paidCount > 0) return SHOP_SHEET_DISCLOSURE;
  return 'None of these links earns Cinch anything. The ranking above is computed from your closet before any shop is consulted.';
}

/** C-03 — Profile → Settings. */
export const SHOW_WHERE_TO_BUY_LABEL = 'Show where to buy';
export const SHOW_WHERE_TO_BUY_DETAIL =
  'Merchant suggestions on the Gap Feed and on friends’ pieces. Off removes them everywhere in the app.';

/** C-05 — Profile → Privacy, verbatim from the directive. */
export const SHOPPABLE_LABEL = 'Let friends find where your pieces are from';
export const SHOPPABLE_DETAIL =
  'Off by default. When it’s on, a friend looking at one of your pieces can search for it and buy one. Cinch earns a commission if they do. You earn nothing, and we will never tell you who looked.';

/**
 * "from $38" — a floor, never a strikethrough or a "was/now" pair
 * (commerce-directive.md C-01: "never discount, strikethrough, urgency,
 * countdown, or sale badge"). Whole dollars drop the cents; anything else
 * keeps two decimals. `currency` outside USD prints its own code rather than
 * guessing a symbol nobody verified.
 */
export function floorPriceLabel(priceCents: number, currency: string | null): string {
  const amount = priceCents / 100;
  const symbol = !currency || currency === 'USD' ? '$' : `${currency} `;
  const value = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
  return `from ${symbol}${value}`;
}

/** "Three at Everlane, Sézane and Uniqlo" — never more than C-01's cap of three. */
export function merchantsClause(names: string[]): string {
  const count = names.length;
  const word = count === 1 ? 'One' : count === 2 ? 'Two' : 'Three';
  if (count === 0) return '';
  if (count === 1) return `${word} at ${names[0]}`;
  if (count === 2) return `${word} at ${names[0]} and ${names[1]}`;
  return `${word} at ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
