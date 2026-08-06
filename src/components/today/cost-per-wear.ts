import type { Garment } from '@/lib/styling';

/**
 * Blended cost-per-wear for a look: the sum of each piece's own cost per
 * wear. "What does wearing this outfit today actually cost me" — Whering and
 * Indyx also surface cost-per-wear now, so the number itself isn't the
 * differentiator; what's still Cinch's own is printing it on a look her
 * friends actually voted on, from a closet they can see is real.
 *
 * Lives in its own module because both the in-app plate and the share card
 * print it, and the share card must not import the plate (the plate mounts
 * the card).
 */
export function outfitCostPerWear(items: Garment[]): number | null {
  let sum = 0;
  let counted = 0;
  for (const g of items) {
    if (g.purchasePrice != null && g.wearCount > 0) {
      sum += g.purchasePrice / g.wearCount;
      counted++;
    }
  }
  return counted > 0 ? sum : null;
}
