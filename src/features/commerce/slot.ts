import type { CountedKind } from '@/features/closet/outfit-count';

/**
 * The one vocabulary `catalog_products.slot` speaks (20260811143000's check
 * constraint) — and, not by coincidence, exactly `item_category`'s ten
 * values (20260803154431's enum). Declared once here so neither the Gap
 * Feed's four-kind vocabulary nor a friend's item's `category` field has to
 * guess at spelling: a friend's `item.category` IS already a `CatalogSlot`,
 * with zero translation, because the schemas share the enum on purpose.
 */
export type CatalogSlot =
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'footwear'
  | 'dress'
  | 'accessory'
  | 'bag'
  | 'headwear'
  | 'jewelry'
  | 'other';

export const CATALOG_SLOTS: readonly CatalogSlot[] = [
  'top',
  'bottom',
  'outerwear',
  'footwear',
  'dress',
  'accessory',
  'bag',
  'headwear',
  'jewelry',
  'other',
];

/**
 * The Gap Feed's own four-kind vocabulary (`CountedKind`, plural — "shoes"
 * rather than "footwear") onto the catalogue's slot vocabulary. The Gap Feed
 * never counts outerwear, bags, headwear, jewelry or "other" as a gap, so
 * this mapping only ever needs to cover the four kinds that exist —
 * `Record<CountedKind, CatalogSlot>` makes that exhaustiveness a compile
 * error if a fifth kind is ever added and this file is not.
 */
export const SLOT_FOR_GAP_KIND: Record<CountedKind, CatalogSlot> = {
  tops: 'top',
  bottoms: 'bottom',
  dresses: 'dress',
  shoes: 'footwear',
};
