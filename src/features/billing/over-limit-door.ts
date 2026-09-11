/**
 * Which door a full free closet meets when its owner tries to add an eleventh
 * piece — CMO ledger A28, resurrected 2026-09-11.
 *
 * ── WHAT PRODUCTION SAID ────────────────────────────────────────────────────
 *
 * Three of the last four real paywall impressions were `add_garment_over_limit`,
 * shown 2, 25 and 20 minutes after signup, to three people who were in the
 * middle of photographing. None of the three had seen an outfit when the wall
 * asked — `profiles.reveal_seen_at` was null for all three at that moment —
 * and none has come back. One of them (Bahrain, ten pieces in four minutes) had
 * Today's Reveal door on screen, kept photographing instead, met the wall, and
 * left six seconds later without ever opening the Reveal.
 *
 * A68 (2026-09-10) moved the Ten's own ask after the Reveal. The cap wall was a
 * second pre-Reveal ask A68 did not touch, and it is the one a person meets
 * for doing exactly what the product asked of them.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 *
 * Reveal first, wall after. When the closet that hit the ACTIVE ceiling can be
 * dressed (`canGenerate`) and has never been shown the Reveal, the sheet leads
 * with the outfits — "See what they make before you add more" — and the plans
 * are its second action. Everything else is the wall as it was: the total
 * ceiling (storing a piece does not help, so the Reveal is not the remedy), a
 * closet the engine cannot dress (there is nothing to reveal), and a closet
 * that has already had its Reveal (the ask is now the honest next thing).
 *
 * The Reveal's own exit still carries `reveal_complete` through the promo
 * path, so the person who takes the first door meets an ask AFTER the outfit —
 * the order the founder ruled for A68. Nothing here removes the wall; it
 * orders it.
 *
 * Pure, so the rule is a table in `tests/cap-before-reveal.test.ts`.
 */

export type OverLimitDoor = 'reveal' | 'wall';

export function overLimitDoor({
  wall,
  dressable,
  revealNeverSeen,
}: {
  /** Which ceiling refused the piece — `admitBatch`'s verdict. */
  wall: 'active' | 'total';
  /** `canGenerate` over the real wardrobe. */
  dressable: boolean;
  /** `useRevealNeverSeen` — true only on a settled read that says never. */
  revealNeverSeen: boolean;
}): OverLimitDoor {
  if (wall === 'total') return 'wall';
  return dressable && revealNeverSeen ? 'reveal' : 'wall';
}

/**
 * The sheet's copy on the Reveal door. No price and no number: the plans are
 * the second action and the paywall names the price (A74 — no typed price on
 * any shipping surface).
 */
export const OVER_LIMIT_REVEAL_COPY = {
  eyebrow: 'Photographed · not added yet',
  title: 'Your ten are in.',
  body:
    'See what they make before you add more — Cinch dresses you from these first. ' +
    'Your photograph stays on your phone; nothing here deletes it.',
  primary: 'See my outfits',
  secondary: 'Keep adding',
  tertiary: 'Not now',
} as const;
