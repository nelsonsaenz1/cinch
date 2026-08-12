import { type Item, costPerWear } from '@/schemas/item';

/**
 * The one metadata line under a garment's name — C-01, C-08 and audit 63.
 *
 * ── What changed, and why it is one line ──────────────────────────────────
 *
 * The card used to split this into two: a wear count on the left edge of the
 * tile and a cost-per-wear pushed to the right. The deviation ledger calls
 * that out by name ("Price detached to the far edge of the tile") and replaces
 * it with "wear and price as one 13 pt line under a 15 pt name". Audit 63 is
 * the reviewer's version of the same thing: "Wear count and cost-per-wear are
 * one cluster; the price half drops when unknown rather than printing zero."
 *
 * ── The three rules this function exists to hold ──────────────────────────
 *
 * 1. THE PRICE HALF DROPS. `costPerWear()` returns nothing without both a
 *    price and a wear, so the clause is present or absent — never zero, never
 *    a dash, never "$0.00 a wear". That is refusal 2, and it is the whole
 *    reason this is a function rather than a template string at the call site.
 *
 * 2. NEVER WORN IS WORDS. C-08: "Never worn is printed as words, never as 0 —
 *    a zero here would read as a score." So a piece with no wears returns the
 *    sentence, and the price clause cannot follow it (there is no per-wear
 *    figure without a wear, by construction).
 *
 * 3. NOTHING IS ESTIMATED. Every figure here is read off the row.
 *
 * Pure and item-shaped so it can be tested without a render — see
 * `tests/w3-g3-piece-meta.test.ts`.
 */
export function pieceMetaLine(item: Item): string {
  if (item.wearCount <= 0) return 'Never worn';

  const worn = `Worn ${item.wearCount} ${item.wearCount === 1 ? 'time' : 'times'}`;
  const cpw = costPerWear(item);
  if (cpw === null) return worn;

  // Two decimals always: "$6.43 a wear", "$3.10 a wear". A per-wear figure is
  // a division, so a whole-dollar result is a coincidence rather than a price
  // somebody typed — printing "$3 a wear" would imply a precision the
  // arithmetic does not have.
  return `${worn} · $${cpw.toFixed(2)} a wear`;
}

/**
 * C-07 — the metadata line under a STORED piece.
 *
 * "the metadata line swaps cost-per-wear for the storing date, which is the
 * fact that matters here." The frame prints `Stored in March · worn 7 times`.
 *
 * ── THE STORING DATE IS NOT PRINTED, AND THIS IS WHY ──────────────────────
 *
 * There is no storing date to print. `items` records `created_at` (when the
 * garment was filed) and `is_archived` (whether it is stored right now); no
 * column anywhere records WHEN it was stored, and adding one is a migration.
 * `created_at` is not that date and would be a different fact wearing its name
 * — a piece filed in March and stored last week would read "Stored in March",
 * which is exactly the kind of substitution the constitution refuses.
 *
 * So the clause is OMITTED rather than estimated, and the line is the half that
 * is genuinely known. The dependency is recorded in the lane report; the day a
 * `stored_at` exists, this function is the one place that changes.
 *
 * The wear half keeps the group's rule about zero: never worn is words, never a
 * 0, "a zero here would read as a score."
 */
export function storedMetaLine(item: Pick<Item, 'wearCount'>): string {
  if (item.wearCount <= 0) return 'Never worn';
  return `Worn ${item.wearCount} ${item.wearCount === 1 ? 'time' : 'times'}`;
}

/**
 * The same facts as a sentence VoiceOver can say.
 *
 * §9 asks for the card to be ONE element announced as "Mohair sweater, worn 14
 * times, six dollars forty-three a wear, photograph" — never an image node
 * followed by two unrelated labels — and for a silhouetted piece to end with
 * "silhouette, no photograph yet", which is a fact rather than a warning.
 *
 * The currency is left as digits rather than spelled out: VoiceOver reads
 * "$6.43" as "six dollars forty-three" itself, and spelling it here would make
 * it say so twice on the one voice that already gets it right.
 */
export function pieceCardAnnouncement(
  item: Item,
  name: string,
  opts: { hasPhoto: boolean },
): string {
  return [name, pieceMetaLine(item), opts.hasPhoto ? 'photograph' : 'silhouette, no photograph yet']
    .filter(Boolean)
    .join(', ');
}
