/**
 * The category grid's nine tiles and their geometry, in one place the screens
 * read from — the spec-file pattern, beside the flow's copy home (`copy.ts`).
 *
 * THE SLOT VALUES ARE THE SERVER'S ENUM, verbatim. `bounds.ts` refuses
 * anything that is not one of the nine, so a tile whose value drifted would be
 * a tile that 400s on tap — `tests/catalogue-browse.test.ts` reads this table
 * against `_shared/browse-slots.ts` and fails before that can ship.
 *
 * THE LABELS ARE THE ONES THE APP ALREADY SAYS. Same words as the closet's
 * recategorise sheet (`CATEGORY_CHOICES`, `src/app/(tabs)/closet.tsx`), minus
 * "Other" — a slot the catalogue deliberately cannot search, because "other"
 * means the closet could not classify the piece and no shopping term follows
 * from that. Inventing a second vocabulary here would put two names on one
 * category the first time a browse result is refiled.
 */

/** The nine slots a tile may ask for. Mirrors `BrowsableSlot` server-side. */
export type CatalogueBrowseSlot =
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'footwear'
  | 'dress'
  | 'accessory'
  | 'bag'
  | 'headwear'
  | 'jewelry';

export const BROWSE_TILES: readonly { slot: CatalogueBrowseSlot; label: string }[] = [
  { slot: 'top', label: 'Top' },
  { slot: 'bottom', label: 'Bottom' },
  { slot: 'outerwear', label: 'Outerwear' },
  { slot: 'dress', label: 'Dress' },
  { slot: 'footwear', label: 'Footwear' },
  { slot: 'bag', label: 'Bag' },
  { slot: 'headwear', label: 'Headwear' },
  { slot: 'jewelry', label: 'Jewelry' },
  { slot: 'accessory', label: 'Accessory' },
];

/** The display name for a slot, for the results heading over a browsed grid. */
export function browseTileLabel(slot: CatalogueBrowseSlot): string {
  return BROWSE_TILES.find((t) => t.slot === slot)?.label ?? 'Category';
}

/**
 * Three across, like the closet grid the pieces will land in. Nine tiles at
 * three columns is three full rows — no orphan, which is why the count and the
 * columns were chosen together.
 */
export const BROWSE_TILE_COLUMNS = 3;

/** Comfortably past the 44pt hit target with a label inside. */
export const BROWSE_TILE_HEIGHT = 56;

/** Matches the family cards' 10pt rhythm (`gap-2.5`) so the section reads as
 *  part of the page rather than a widget dropped onto it. */
export const BROWSE_TILE_GAP = 10;
