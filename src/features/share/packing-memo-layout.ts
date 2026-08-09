/**
 * THE PACKING MEMO'S SHARE CARD, AS DATA.
 *
 * No atlas draws this artifact — K-05 has no share-card plate of its own the
 * way an outfit does (`card-layout.ts`'s five-tile collage). This is a new,
 * modest composition in the same paper voice: a list, not a collage, because
 * a trip's bag is read as an itinerary rather than looked at as a photograph.
 *
 * Pure and React-free for the same reason `card-layout.ts` is: the numbers
 * here are the only part of this artifact a test can hold accountable.
 */

/** How many bag pieces the card prints by name before summarising the rest. */
export const MAX_CARD_PIECES = 8;

/**
 * The bag list, capped so a forty-piece "light packer" bag does not run the
 * card off its own canvas. Never silently drops without saying so — the
 * caller prints `more` as "+3 more".
 */
export function cardPieceLines(names: readonly string[]): { shown: string[]; more: number } {
  if (names.length <= MAX_CARD_PIECES) return { shown: [...names], more: 0 };
  return { shown: names.slice(0, MAX_CARD_PIECES), more: names.length - MAX_CARD_PIECES };
}
