/**
 * The families as the client receives them, and the one presentation rule the
 * client is allowed to apply to them.
 *
 * These mirror `supabase/functions/garment-search/families.ts` field for field.
 * They are restated rather than imported because the Edge Function is Deno and
 * this is the app bundle — the same split every other feature has — and
 * `tests/catalogue-contract.test.ts` reads both files and fails if a field
 * exists on one side and not the other.
 *
 * §10.2 IS THE RULE THIS FILE OBEYS: "The client must never attempt grouping
 * from raw titles." Nothing here derives a family, a colourway or a name from a
 * title. `presentedTitle` below chooses between the name the SERVER produced
 * and a fixed sentence saying there isn't one; it never makes a third thing up.
 */

import { TITLE_UNAVAILABLE } from './copy';

/** One colourway of one family. */
export type CatalogueColourway = {
  /** The merchant's own printed name. Never invented — §10.3. */
  label: string;
  /** Whether the lexicon could place it. False still displays, in the shop's words. */
  resolved: boolean;
  /** Null is a real, drawn state — §11 forbids assuming a listing has an image. */
  imageUrl: string | null;
  alternateImageUrl: string | null;
  /** Datafeedr's row id. The import's idempotency key. */
  externalId: string;
  sourceHost: string;
  /** The merchant's own product page. The provenance an import records. */
  pageUrl: string | null;
};

export type CatalogueFamily = {
  familyId: string;
  brand: string | null;
  /** The server's `displayTitle`. May be junk; see `presentedTitle`. */
  title: string;
  productClass: string | null;
  category: string | null;
  gender: string | null;
  colours: CatalogueColourway[];
  merchants: string[];
  /** Set on a near-miss: 'henley', 'polo', 'long sleeve'. Null on an exact match. */
  nearMissCut: string | null;
};

/** What the search returns. Null families means grouping was unavailable. */
export type CatalogueFamilies = {
  exact: CatalogueFamily[];
  nearMiss: CatalogueFamily[];
};

/**
 * Is this title a name, or is it a keyword dump?
 *
 * The live feed settles what this has to catch. Mr Porter writes "Combed
 * Cotton-Jersey T-Shirt" and Grailed writes "T-Shirt Mens 1XL Gray Cotton
 * Casual Usa Made Logo Classic Preppy Short Sleeve" — the second is a resale
 * listing's search-bait, and printing it on a card is worse than printing
 * nothing, because it reads as Cinch's own description of the garment.
 *
 * THE TEST IS LENGTH IN WORDS, and deliberately nothing cleverer. A word count
 * cannot be wrong about a language it does not understand, and every subtler
 * rule I could write here (counting size tokens, spotting repeated nouns) is a
 * heuristic that would eventually reject a real product name like "Luxe Lotus
 * Slim-Fit Cotton-Jersey T-Shirt" — six words, and the longest genuine name in
 * the recorded fixture. The ceiling sits above that with room to spare.
 *
 * Getting it wrong in this direction costs an ugly card. Getting it wrong in
 * the other direction hides a garment somebody owns.
 */
const MAX_NAME_WORDS = 8;

export function isUsableTitle(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length === 0) return false;
  return trimmed.split(/\s+/).length <= MAX_NAME_WORDS;
}

/**
 * What the card actually prints.
 *
 * §10.3: "Where no usable name exists the row must say so, not invent one."
 * Truncating the dump to eight words would be inventing one — the first eight
 * words of search-bait are still search-bait, and now they look deliberate.
 */
export function presentedTitle(family: Pick<CatalogueFamily, 'title'>): string {
  return isUsableTitle(family.title) ? family.title.trim() : TITLE_UNAVAILABLE;
}

/** Whether any colourway in this family arrived with a picture. */
export function hasAnyImage(family: Pick<CatalogueFamily, 'colours'>): boolean {
  return family.colours.some((c) => Boolean(c.imageUrl));
}

/** The colourway a card shows first — the first with a picture, else the first. */
export function representativeColour(
  family: Pick<CatalogueFamily, 'colours'>,
): CatalogueColourway | null {
  return family.colours.find((c) => Boolean(c.imageUrl)) ?? family.colours[0] ?? null;
}
