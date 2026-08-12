/**
 * IT-04 — the item document, friend variant.
 *
 * "The friend variant is the same document with cells removed: wear count
 * survives because it is the owner's public signal, and size joins it because
 * it is what a borrower needs. Price, cost-per-wear, receipt, storage status,
 * purchase date and notes are all absent — not blurred, not locked behind a
 * lock icon, simply not part of this view."
 *
 * WHY A MODULE RATHER THAN JSX. Every decision this file makes is a privacy or
 * commerce decision, and each is provable without a device: which cells exist,
 * whether the borrow block appears, whether a commerce action appears. A
 * component alone would put all three inside a render nobody can assert on.
 *
 * IT IS NOT THE ENFORCEMENT. The enforcement is `friend_items`, a
 * `security_invoker = false` view whose WHERE clause carries the friendship
 * check and the hidden-closet check, and whose column list is the whole set of
 * facts that may cross (20260808110000, 20260811150000). Price never crosses,
 * so this file cannot hide it and does not try — what it decides is what to do
 * with what already arrived. A client-side filter over a wider row would be
 * theatre; the row is narrow because the database made it narrow.
 */

import type { FriendItem } from './types';

export type FriendItemView = {
  /** The garment, called what its owner calls it. */
  title: string;
  /** "Outerwear · oat cotton twill" — category, then material, when known. */
  line: string;
  /** The owner's public signal. Null when she has never worn it. */
  wears: number | null;
  borrow: BorrowState;
  /** Whether a "Find it" row may render. See the two flags below. */
  commerce: 'find_it' | 'off';
};

/**
 * The three honest answers about lending, and there is no fourth.
 *
 * `lent` draws the atlas's block. `not_lent` draws NOTHING — not a disabled
 * button, not a lock, not "this piece is not available". The standing refusal
 * is that a piece the owner has not offered is simply not offered here, the
 * same way price is simply not present; an explanation would be the app
 * narrating somebody else's decision about her own coat to a person who did
 * not ask. `own` is the guard against rendering this view over your own piece,
 * where every one of these cells would be a lie by omission.
 */
export type BorrowState = 'lent' | 'not_lent' | 'own';

/** The block's heading, when the owner lends this one. */
export function lendsLine(ownerName: string): string {
  return `${ownerName} lends this one`;
}

/**
 * What asking actually does — the whole of it, before the tap.
 *
 * Load-bearing and quoted from the atlas: "Asking sends her a request she can
 * decline. Nothing is reserved until she says yes." Nothing in the schema
 * holds, reserves or blocks a garment on a pending request (`borrow_requests`
 * is a message with a state), so a sentence implying otherwise would be the
 * app promising a lock it does not take.
 */
export const BORROW_CONSEQUENCE =
  'Asking sends her a request she can decline. Nothing is reserved until she says yes.';

export const BORROW_ACTION = 'Ask to borrow';

/**
 * The cells this view may never carry, named so a test can hold them.
 *
 * Not a filter — none of these crosses `friend_items` in the first place — but
 * the list a reviewer checks the rendered document against, and the list that
 * would have to change if somebody ever widened the view.
 */
export const OWNER_ONLY_CELLS = [
  'purchase_price',
  'cost_per_wear',
  'purchase_date',
  'is_for_sale',
  'sale_price',
  'sale_note',
  'is_archived',
  'condition',
  'listing_source_url',
] as const;

export function friendItemView(
  item: FriendItem,
  viewer: { userId: string | null; showWhereToBuy: boolean },
): FriendItemView {
  const own = viewer.userId !== null && viewer.userId === item.userId;

  const title = item.subcategory?.trim() || item.category;
  // Material only when the owner filed one. "Outerwear · " with nothing after
  // it would be a cell announcing its own emptiness.
  const line = item.material?.trim() ? `${item.category} · ${item.material.trim()}` : item.category;

  return {
    title,
    line,
    // Zero is quiet: a garment nobody has worn yet has no wear count to print,
    // and "0 wears" about somebody else's clothes reads as a judgement.
    wears: item.wearCount > 0 ? item.wearCount : null,
    borrow: own ? 'own' : item.borrowable ? 'lent' : 'not_lent',
    // BOTH flags, and they are different people's decisions. `shoppable` is the
    // OWNER's consent for others to find where her pieces are sold (C-05);
    // `showWhereToBuy` is the VIEWER's own preference, which removes every
    // merchant row app-wide when off (C-03). Either one off means no row —
    // neither person's setting may be overridden by the other's.
    commerce: !own && item.shoppable && viewer.showWhereToBuy ? 'find_it' : 'off',
  };
}
