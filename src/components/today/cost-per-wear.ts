import type { Garment } from '@/lib/styling';

/**
 * Blended cost-per-wear for a look: the sum of each piece's own cost per
 * wear. "What does wearing this outfit today actually cost me" — the number
 * no competitor can print, because they don't track it.
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
