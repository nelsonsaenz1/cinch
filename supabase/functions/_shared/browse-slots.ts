/**
 * The nine browsable slots and the one word each is searched with.
 *
 * WHY THIS TABLE EXISTS TWICE. `gap-shop-match/policy.ts` owns `SLOT_QUERY`,
 * whose terms were verified against recorded catalogue rows
 * (`tests/fixtures/slot-relevance.json`) — that is the provenance, and it does
 * not move. But `garment-search` may not import across a function boundary:
 * each Edge Function deploys as its own bundle, and a reach into a sibling's
 * directory is a dependency the deploy graph cannot see. So the nine verified
 * terms are MIRRORED here, in `_shared/` where both functions may look, and
 * `tests/catalogue-browse.test.ts` reads both tables and fails the moment they
 * disagree. Same arrangement `types.ts` has with `families.ts` on the client.
 *
 * WHY THE TERM IS THE WHOLE QUERY. Browse is the door for somebody who cannot
 * name what they want — a slot is tapped, never typed. Keeping the input an
 * enum is what keeps the shipped disclosure ("what you type … is not sent to an
 * AI model") trivially true of this action: there is no free text anywhere in
 * a browse request, so there is nothing that COULD travel further than the
 * catalogue. `bounds.ts` refuses anything that is not one of these nine.
 *
 * `other` is deliberately absent, exactly as it is null in `SLOT_QUERY`:
 * "other" means the closet could not classify the piece, and guessing a
 * shopping term from that would be inventing a category.
 *
 * PURE ON PURPOSE — no `Deno.env`, no `npm:` specifier — so the Node test
 * runner can import it, the same rule `catalog-query.ts` lives by.
 */

export const BROWSABLE_SLOTS = [
  'top',
  'bottom',
  'outerwear',
  'footwear',
  'dress',
  'accessory',
  'bag',
  'headwear',
  'jewelry',
] as const;

export type BrowsableSlot = (typeof BROWSABLE_SLOTS)[number];

export function isBrowsableSlot(value: unknown): value is BrowsableSlot {
  return typeof value === 'string' && (BROWSABLE_SLOTS as readonly string[]).includes(value);
}

/**
 * ONE word per slot, mirroring `SLOT_QUERY`'s verified terms exactly. The
 * reasoning for each word lives with the original table; changing one here
 * without changing it there fails the mirror test, which is the point.
 */
export const BROWSE_TERM: Record<BrowsableSlot, string> = {
  top: 'shirt',
  bottom: 'trousers',
  outerwear: 'coat',
  footwear: 'shoes',
  dress: 'dress',
  accessory: 'scarf',
  bag: 'handbag',
  headwear: 'hat',
  jewelry: 'necklace',
};
