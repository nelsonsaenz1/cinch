/**
 * The two lines every posted-look card prints under its plate — the name and
 * the descriptor. Pure, and kept independent of
 * `@/components/event-outfits/OutfitPostCard` (Unit E's territory,
 * event-social-contract.md §7) on purpose: Event Detail's "Your look" card
 * needs the exact same two strings and must not reach into another unit's
 * component file to get them.
 */

import type { Garment } from '@/lib/styling';

/**
 * "Cream & Cognac" — a look named by its own palette when nobody wrote a
 * caption. Derived from the two heaviest garments' first colours, the values
 * the styling engine actually scored.
 */
export function lookName(garments: readonly Garment[], caption: string | null): string {
  if (caption) return caption;
  const names: string[] = [];
  for (const g of [...garments].sort((a, b) => b.visualWeight - a.visualWeight)) {
    const n = g.colors[0]?.name;
    if (!n) continue;
    const cased = n.charAt(0).toUpperCase() + n.slice(1);
    if (!names.includes(cased)) names.push(cased);
    if (names.length === 2) break;
  }
  return names.length ? names.join(' & ') : 'A look';
}

/** "cream sweater, cognac boots" — the one-line muted descriptor under a card. */
export function lookDescriptor(garments: readonly Garment[]): string {
  return [...garments]
    .sort((a, b) => b.visualWeight - a.visualWeight)
    .slice(0, 2)
    .map((g) => {
      const colour = g.colors[0]?.name;
      const piece = g.subcategory ?? g.category;
      return colour ? `${colour} ${piece}` : piece;
    })
    .join(', ');
}

/** "1 pick from the table" / "3 picks from the table" — never printed at
 *  zero. "Zero is quiet": event-social-contract.md §3. */
export function pickCountLine(votes: number): string | null {
  if (votes <= 0) return null;
  return votes === 1 ? '1 pick from the table' : `${votes} picks from the table`;
}
