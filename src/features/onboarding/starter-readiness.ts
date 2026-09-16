/**
 * Starter readiness — is this closet finished enough to be styled from?
 *
 * WHY THIS EXISTS, and why it is not `canGenerate`.
 *
 * The Ten used to prescribe its own answer: ten NAMED positions (3 tops, 2
 * bottoms, 1 dress, 2 shoes, 1 coat, 1 bag) whose plan implied fourteen
 * outfits before a single photograph existed. That template failed the first
 * real male tester who used it — three tops, a hoodie, two pairs of trousers,
 * two pairs of shoes, a watch and one more piece is a perfectly good starter
 * closet, and the grid told him he was wrong about his own wardrobe.
 *
 * So the grid is now ten generic positions and the ONLY thing that decides
 * whether the starter closet is finished is what the classifier actually
 * returned. Four conditions, all of them read from real garments:
 *
 *   1. at least ten real uploaded garments;
 *   2. at least one piece of footwear;
 *   3. a top and a bottom, or a dress;
 *   4. `countOutfits` over the real tally is at least four.
 *
 * Condition 4 is what makes the other three insufficient on their own: a
 * closet can satisfy shape and still make one outfit, and one outfit is not a
 * week. Four is the smallest number that reads as a wardrobe rather than an
 * accident — one core per weekday minus one — and it is the only editorial
 * number in this file. Everything else is arithmetic.
 *
 * WHY IT IS NOT `canGenerate`. That predicate is the ENGINE's floor (eight
 * pieces, plus a top-and-bottom or a dress) and the whole app agrees on it —
 * Today, the Reveal, the stylist. Widening it to mean "the starter grid is
 * finished" would change what every one of those screens is allowed to show.
 * This is a stricter, narrower claim scoped to The Ten, so it lives beside The
 * Ten and leaves `canGenerate` alone.
 *
 * IMPORT-LIGHT ON PURPOSE. `outfit-count.ts` and `plans.ts` are the only
 * imports and both are leaves — `scripts/run-tests.mjs` bundles with esbuild,
 * which cannot parse React Native's Flow source, so anything a test has to
 * check must be reachable without pulling a component into the graph.
 */

import {
  countOutfits,
  missingForFirstOutfit,
  rankGaps,
  tallyOf,
  type CountedKind,
  type Tally,
} from '@/features/closet/outfit-count';
import { PLANS } from '@/features/billing/plans';
import type { Garment } from '@/lib/styling';

/** The activation target — ten REAL uploaded garments, the free closet's size. */
export const STARTER_PIECES = PLANS.free.items;

/**
 * The smallest count that reads as a wardrobe rather than a coincidence.
 * The one editorial number here; see the header.
 */
export const STARTER_MIN_OUTFITS = 4;

/**
 * What is still missing, in the order the flow should ask for it.
 *
 * `footwear` and `core` come before `outfits` because they are the two gaps
 * that hold the count at zero — naming "four more outfits" to somebody with no
 * shoes describes the symptom rather than the cause.
 */
export type StarterGap = 'start' | 'footwear' | 'core' | 'outfits' | 'pieces';

export type StarterReadiness = {
  /** Real uploaded garments. Every category counts, watches and bags included. */
  pieces: number;
  /** The four counted kinds only — accessories cannot inflate this. */
  tally: Tally;
  /** `countOutfits` over the real tally. Never a projection, never a table. */
  outfits: number;
  hasFootwear: boolean;
  /** A top and a bottom, or a dress. `mid_layer` is a top; see `kindOfSlot`. */
  hasCore: boolean;
  ready: boolean;
  /** Every unmet condition, in ask order. Empty exactly when `ready`. */
  missing: StarterGap[];
  /** How many more pieces the ten still wants. Never negative. */
  piecesRemaining: number;
};

/**
 * Readiness from a real wardrobe.
 *
 * `wardrobe` is the classifier's output, never the grid: a piece the reader
 * shot into "slot 3" is whatever the tagger says it is, and this function has
 * no way to learn what position it was tapped from. That is the whole point —
 * the tester who shot a hoodie into a bottom slot has a hoodie, and the count
 * says so.
 */
export function starterReadiness(
  wardrobe: readonly Pick<Garment, 'slot'>[],
): StarterReadiness {
  const pieces = wardrobe.length;
  const tally = tallyOf(wardrobe);
  const outfits = countOutfits(tally);

  const hasFootwear = tally.shoes > 0;
  const hasCore = (tally.tops > 0 && tally.bottoms > 0) || tally.dresses > 0;

  // Footwear is NOT a gate (founder ruling 12.8, 2026-09-16). Shoes multiply
  // outfits and never make one (`countOutfits`, A6): a ten-piece closet with a
  // pairable core and four outfits is dressable barefoot, and holding the
  // Reveal for a pair it may not own was a template rule outliving the
  // template. `hasFootwear` stays readable — `starterSuggestion` still names
  // the pair FIRST while the closet is being built — but it no longer decides
  // `ready`, and `repairCopy` no longer lists it as a reason a closet cannot
  // be dressed.
  const missing: StarterGap[] = [];
  if (!hasCore) missing.push('core');
  if (outfits < STARTER_MIN_OUTFITS) missing.push('outfits');
  if (pieces < STARTER_PIECES) missing.push('pieces');

  return {
    pieces,
    tally,
    outfits,
    hasFootwear,
    hasCore,
    ready: missing.length === 0,
    missing,
    piecesRemaining: Math.max(0, STARTER_PIECES - pieces),
  };
}

/**
 * The one thing worth adding next, chosen from what is actually in the closet.
 *
 * A gap, and — when the gap is arithmetic rather than shape — the counted kind
 * that closes it fastest, ranked by `gainFrom`. Ties break on `COUNTED_KINDS`
 * order, which puts shoes first because shoes multiply the dresses as well as
 * the separates.
 *
 * Null once the closet is ready: there is nothing to suggest to somebody who
 * has arrived, and inventing a suggestion is how a finished flow starts
 * nagging.
 */
export type StarterSuggestion = {
  gap: StarterGap;
  /** The kind to add, when one can be named. Null for a pure piece-count gap. */
  kind: CountedKind | null;
  /** What the closet would make with that one piece added. Computed, always. */
  projected: number;
  /**
   * Everything still absent before ANY outfit exists, from
   * `missingForFirstOutfit`. Empty once the closet makes something.
   *
   * WHY THIS FIELD EXISTS. Without it the card could say "one pair takes this
   * closet to 0 outfits" — a real sentence the simulator caught on the empty
   * grid. A single piece cannot lift a closet off nought unless it is the LAST
   * missing half, so when it isn't, the honest thing is to name the whole set
   * rather than quote a projection that hasn't moved. The copy switches on
   * `projected > current`; this is what it says instead.
   */
  alsoNeeds: CountedKind[];
};

export function starterSuggestion(r: StarterReadiness): StarterSuggestion | null {
  // The pair of shoes is the top suggestion while anything at all is still
  // missing — it finishes every outfit the closet already makes — and never a
  // nag once the closet is ready (12.8: a suggestion, not a gate).
  const gap: StarterGap | undefined =
    !r.hasFootwear && r.missing.length > 0 ? 'footwear' : r.missing[0];
  if (!gap) return null;

  const alsoNeeds = missingForFirstOutfit(r.tally);

  /**
   * An empty closet is not a gap, it is a beginning.
   *
   * Asking a reader who has photographed nothing to "add a pair of shoes"
   * gives an arbitrary instruction — shoes alone still make nothing — and
   * contradicts the masthead directly above it, which has just said any order
   * is fine. The first card invites rather than directs.
   */
  if (r.pieces === 0) {
    return { gap: 'start', kind: null, projected: 0, alsoNeeds };
  }

  if (gap === 'footwear') {
    return {
      gap,
      kind: 'shoes',
      projected: countOutfits({ ...r.tally, shoes: r.tally.shoes + 1 }),
      alsoNeeds,
    };
  }
  if (gap === 'core') {
    // The half that is absent. A dress needs only shoes, so a closet with a
    // dress never reaches here; a closet without one needs whichever of the
    // two halves it lacks, and tops before bottoms when it lacks both.
    const kind: CountedKind = r.tally.tops === 0 ? 'tops' : 'bottoms';
    return {
      gap,
      kind,
      projected: countOutfits({ ...r.tally, [kind]: r.tally[kind] + 1 }),
      alsoNeeds,
    };
  }
  if (gap === 'outfits') {
    const best = rankGaps(r.tally)[0];
    return { gap, kind: best?.kind ?? null, projected: best?.total ?? r.outfits, alsoNeeds };
  }
  // Only the piece count is short — the shape and the arithmetic are already
  // there, so the honest suggestion names no kind at all. Anything at this
  // point genuinely counts, which is the sentence the copy gets to write.
  return { gap: 'pieces', kind: null, projected: r.outfits, alsoNeeds };
}
