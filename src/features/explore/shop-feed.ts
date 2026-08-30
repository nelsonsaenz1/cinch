import type { CatalogueFamilies, CatalogueFamily } from '@/features/catalogue/types';
import { presentedTitle, representativeColour } from '@/features/catalogue/types';
import type { Garment, Slot } from '@/lib/styling';

/**
 * The Explore shop feed — partner clothing chosen from what the closet
 * already holds. Pure, so the node suite proves the two rules that make the
 * feature honest:
 *
 *   1. The catalogue is asked about only KINDS THE PERSON OWNS, most-owned
 *      first. No closet content leaves the device to do it — a browse slot
 *      is one of nine fixed enum values (`browse-slots.ts`), so "similar to
 *      your closet" is computed here and the wire carries an enum.
 *   2. What renders is bounded and interleaved: a few families per owned
 *      kind, image-bearing exact matches only, round-robin across kinds so
 *      the grid reads as a mix rather than eighteen shirts.
 *
 * Founder order 2026-08-30 ("build it anyway"), design in
 * docs/design/explore-feed-plan.md. One correction to that document, made
 * here where the code settles it: the gate is `show_where_to_buy` (C-03,
 * the person's own "Show where to buy" switch in Privacy & data) — the
 * toggle that already governs every shop surface — not C-05 `shoppable`,
 * which is about friends finding YOUR pieces and was the wrong switch for
 * this by meaning.
 */

// ---------------------------------------------------------------------------
// Which kinds to ask about
// ---------------------------------------------------------------------------

/** The nine browsable slots, mirrored from `_shared/browse-slots.ts`. */
export type ShopFeedSlot =
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'footwear'
  | 'dress'
  | 'accessory'
  | 'bag'
  | 'headwear';

/**
 * Styling slots collapse onto browse slots: both top layers are "top", and
 * jewelry is unreachable because no styling slot maps to it — the feed can
 * only ever ask about kinds the closet model can hold.
 */
const SLOT_MAP: Record<Slot, ShopFeedSlot> = {
  base_top: 'top',
  mid_layer: 'top',
  bottom: 'bottom',
  dress: 'dress',
  outerwear: 'outerwear',
  footwear: 'footwear',
  bag: 'bag',
  headwear: 'headwear',
  accessory: 'accessory',
};

/** How many kinds one visit asks the catalogue about. */
export const FEED_SLOT_CAP = 4;

/**
 * The kinds this closet earns a feed for, most-owned first.
 *
 * Deterministic: count per mapped slot, order by count descending with the
 * slot name as tiebreak, cap at FEED_SLOT_CAP. An empty closet returns
 * nothing — a feed "similar to what you own" with nothing owned would be a
 * plain shop, which is a different product this deliberately is not.
 */
export function feedSlots(wardrobe: readonly Pick<Garment, 'slot'>[]): ShopFeedSlot[] {
  const counts = new Map<ShopFeedSlot, number>();
  for (const g of wardrobe) {
    const mapped = SLOT_MAP[g.slot];
    if (!mapped) continue;
    counts.set(mapped, (counts.get(mapped) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, FEED_SLOT_CAP)
    .map(([slot]) => slot);
}

// ---------------------------------------------------------------------------
// What renders
// ---------------------------------------------------------------------------

export type ShopFeedCard = {
  /** `slot:familyId` — unique across the merged grid. */
  key: string;
  slot: ShopFeedSlot;
  title: string;
  brand: string | null;
  merchant: string | null;
  imageUrl: string;
  /** The merchant's own product page. Null never reaches a card. */
  pageUrl: string;
};

/** Families kept per slot, before interleaving. */
export const FAMILIES_PER_SLOT = 6;

function cardOf(slot: ShopFeedSlot, family: CatalogueFamily): ShopFeedCard | null {
  // Image-bearing and linkable, or absent: a shop card with no picture sells
  // nothing, and one with no destination is a dead end wearing a price tag.
  const colourway = representativeColour(family);
  if (!colourway?.imageUrl || !colourway.pageUrl) return null;
  return {
    key: `${slot}:${family.familyId}`,
    slot,
    title: presentedTitle(family),
    brand: family.brand,
    merchant: family.merchants[0] ?? null,
    imageUrl: colourway.imageUrl,
    pageUrl: colourway.pageUrl,
  };
}

/**
 * Flatten per-slot responses into one grid, round-robin across slots so the
 * mix survives however many families each kind returned. Exact families
 * only — a near-miss is the catalogue disagreeing about what the thing IS,
 * which is a fine nuance for a deliberate search and noise in a feed.
 */
export function feedCards(
  responses: readonly { slot: ShopFeedSlot; families: CatalogueFamilies }[],
): ShopFeedCard[] {
  const perSlot = responses.map(({ slot, families }) =>
    families.exact
      .map((f) => cardOf(slot, f))
      .filter((c): c is ShopFeedCard => c !== null)
      .slice(0, FAMILIES_PER_SLOT),
  );

  const merged: ShopFeedCard[] = [];
  for (let i = 0; i < FAMILIES_PER_SLOT; i++) {
    for (const cards of perSlot) {
      if (cards[i]) merged.push(cards[i]!);
    }
  }
  return merged;
}
