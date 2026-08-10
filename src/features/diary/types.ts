/**
 * What a wear IS, as the diary reads it.
 *
 * A wear is a row in `outfits` with a non-null `worn_at`, and every confirm
 * inserts a fresh one (`wear_outfit_tx`) — so a diary entry is an event, not a
 * look. Two wearings of the same clothes are two entries, which is exactly what
 * a reverse-chronological record wants and why nothing here is deduplicated.
 *
 * These shapes are deliberately NOT `Item`. The diary needs eight columns off a
 * garment and would otherwise have to reuse `useCloset`, which filters archived
 * pieces out — and a coat that has gone into storage was still worn in March.
 * Dropping it from an entry would quietly rewrite the record.
 */

/** One garment inside a wear, as the entry page prints it. */
export type DiaryPiece = {
  id: string;
  /** `items.subcategory` — the specific word the tagger chose ("shearling coat"). */
  kind: string | null;
  /** The five-way bucket, which only stands in when there is no better word. */
  category: string;
  /** The first named colour, if the tagger found one. */
  colorName: string | null;
  brand: string | null;
  wearCount: number;
  /** Nullable, and usually null. No price means no cost-per-wear line at all. */
  purchasePrice: number | null;
  /** Image candidates in preference order — listing, plate, cutout, thumbnail. */
  imagePaths: (string | null)[];
};

/** One confirmed wear. */
export type DiaryEntry = {
  id: string;
  /** ISO timestamp. Read in LOCAL time everywhere — a diary is a calendar. */
  wornAt: string;
  /** The look's own name, when the stylist or the user gave it one. */
  name: string | null;
  occasion: string | null;
  note: string | null;
  /** Non-null once this look has been kept as a plate. */
  savedAt: string | null;
  /** The kept plate this wearing came out of, when there was one. */
  originOutfitId: string | null;
  /** Carried through a repeat so the record never reattributes a look. */
  source: 'ai' | 'user';
  /** In `outfit_items.position` order — the order the look is read. */
  pieces: DiaryPiece[];
};

/** A month of the record, with its own total. */
export type DiaryMonth = {
  /** `2026-08`, local. Stable enough to key a list on. */
  key: string;
  /** "August 2026". */
  label: string;
  /** How many wears fell in this month — counted, never estimated. */
  count: number;
  entries: DiaryEntry[];
};

/** One filter chip. `all` and `this-year` are fixed; the rest are years. */
export type YearChip = { id: string; label: string };
