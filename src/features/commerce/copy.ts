/**
 * The words commerce-directive.md pins exactly, in one place.
 *
 * Mirrors `supabase/functions/_shared/commerce.ts`'s `PAID_LINK_LABEL` rather
 * than importing it — that file is a Deno module (`Deno.env`, `npm:` specifiers)
 * and cannot cross into the Expo bundle. Two constants, not one shared import,
 * but both equal the same two words and a grep for "Paid link" finds both.
 */

/** §4 / §6 refusal 8: never abbreviated, greyed, or hidden behind an icon. */
export const PAID_LINK_LABEL = 'Paid link';

/**
 * C-02's header paragraph — verbatim from the directive, disclosed every
 * single time the sheet opens, never a "don't show this again" that would
 * make the second-and-every-later opening silently undisclosed.
 */
export const SHOP_SHEET_DISCLOSURE =
  'If you buy through one of these, Cinch earns a small commission. It does not change what we recommend — the ranking above is computed from your closet before any shop is consulted.';

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
