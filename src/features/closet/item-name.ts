import type { Item } from '@/schemas/item';

/**
 * What a garment is CALLED, in one place.
 *
 * There were three answers to this question in the app and only one of them
 * was the field guide's: the highlights rail said "Cream sweater" (03a/04's
 * grammar — colour, then kind, capitalised), while the closet grid tile and
 * the item-detail title both printed the bare stored `subcategory`, so the
 * same garment read "sweater" in the grid and "Cream sweater" ten points
 * above it in the rail. Lowercase, because that is how the tagger writes the
 * column, and unqualified, because that is all the column is.
 *
 * One derivation, imported by the rail, the grid and the detail screen, so
 * they cannot drift again — and, since the Daily Social atlas, by a friend's
 * shared look as well. It takes the three columns it reads rather than a whole
 * `Item` for that fourth caller's sake: `friend_items` is a narrower projection
 * than the closet's own row and could not satisfy the full schema, and a second
 * naming function for friends' clothes is exactly the drift this file ended.
 */

/** The fallback name. `category` defaults to 'other' for an untagged piece,
 *  and "Other" is not a name — it is the absence of one, said badly. */
const UNTAGGED = 'Untagged item';

/**
 * "Charcoal wool coat" rather than a bare "coat".
 *
 * Colour first because that is how people refer to their own clothes;
 * capitalised because it opens a caption. `subcategory` is the specific word
 * the tagger chose ("wool coat", "sweater"); `category` is the five-way
 * bucket and only stands in when the tagger had nothing better — and never
 * when even that is just 'other'.
 */
export function pieceName(item: Pick<Item, 'category' | 'subcategory' | 'colors'>): string {
  const kind = item.subcategory ?? (item.category === 'other' ? null : item.category);
  if (!kind) return UNTAGGED;

  const raw = [item.colors[0]?.name, kind].filter(Boolean).join(' ');
  if (!raw) return UNTAGGED;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** "27 wears", with the singular handled once instead of at every call site. */
export function wearsLabel(count: number): string {
  return `${count} ${count === 1 ? 'wear' : 'wears'}`;
}
