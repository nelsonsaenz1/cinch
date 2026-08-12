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

/**
 * THE PLATE'S RULE — Wave 3, T-03.
 *
 * "Cost-per-wear is printed only when every piece in the look carries a price;
 * otherwise the line is dropped, never estimated and never rendered as a dash."
 *
 * `outfitCostPerWear` above does not implement that, and the atlas's own note
 * ("Cost-per-wear returns nothing when any piece lacks a price") is a
 * misreading of this file: it EXCLUDES an unpriced piece and returns the sum of
 * the rest. On a five-piece look with one unpriced pair of boots that prints
 * four pieces' cost under a heading that says what the outfit costs — a number
 * that is wrong in the direction that flatters, quietly.
 *
 * So the strict rule is a second function rather than a change to the first.
 * `app/repeat-outfit.tsx` (another lane's file) prints the lenient number and
 * is left exactly as it was; the plate prints this one, or prints nothing.
 *
 * A never-worn piece is the same kind of unknown: its own cost per wear is a
 * division by zero, so a look containing one has no computable total either.
 */
export function platedCostPerWear(items: Garment[]): number | null {
  if (items.length === 0) return null;
  let sum = 0;
  for (const g of items) {
    if (g.purchasePrice == null || g.wearCount <= 0) return null;
    sum += g.purchasePrice / g.wearCount;
  }
  return sum;
}

/**
 * "$2.14 a wear" — the line as the atlas sets it, or null when there is no
 * line. Never "—": a dash is invented data wearing the costume of a number.
 */
export function costPerWearLine(value: number | null): string | null {
  return value == null ? null : `$${value.toFixed(2)} a wear`;
}

/**
 * What VoiceOver says: "two dollars fourteen a wear" — the atlas's own reading,
 * spoken as money rather than as the decimal figure "two point one four".
 * Nothing is announced in place of an absent line, which is why this returns
 * null rather than an apology.
 */
export function costPerWearSpoken(value: number | null): string | null {
  if (value == null) return null;
  const cents = Math.round(value * 100);
  const dollars = Math.floor(cents / 100);
  const rest = cents % 100;
  const money = rest === 0 ? `${dollars} dollars` : `${dollars} dollars ${rest}`;
  return `${money} a wear`;
}
