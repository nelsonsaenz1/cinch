/**
 * The swap math behind The Wall's W-04 and The Gap Feed's G-04 "swap instead"
 * offer — Directive 4 (docs/design/free-tier-contract.md).
 *
 * Storing one piece and adding another is the free path through a full
 * closet, and the screen has to quote it honestly: what the trade gains, and
 * what keeping both would have gained instead. Both numbers come from
 * `countOutfits` over a hypothetical tally — never a number typed once for
 * the atlas's own worked example, which is why this file computes rather than
 * quotes "14 → 17".
 */

import { countOutfits, type CountedKind, type Tally } from './outfit-count';

export type SwapOutcome = {
  /** What the closet makes today. */
  from: number;
  /** What it would make after storing one `remove` and adding one `add`. */
  swapped: number;
  /** What it would make if the stored piece were kept AND the new one added. */
  keptBoth: number;
  /** How many fewer outfits the swap makes versus keeping both — never negative. */
  costOfSwap: number;
};

/**
 * Store one piece of `remove`, add one piece of `add`, and recount.
 *
 * `remove` and `add` may be the same kind (storing a top to make room for a
 * different top nets to zero pieces of that kind and no change to the count),
 * which is a legitimate swap the picker can offer.
 *
 * `remove: null` covers storing a piece `outfit-count.ts` never counts at all
 * — a coat, a bag, an accessory. The database's `items_enforce_limit` counts
 * every row regardless, so storing one of these genuinely frees a closet slot
 * while costing the outfit count nothing: `swapped` equals `keptBoth exactly,
 * which is the best a swap can ever do. The Wall's own rules table says this
 * plainly — "layers and bags dress an outfit; they don't create one" — so
 * storing one is never a loss the counted numbers can see.
 */
export function outcomeOfSwap(tally: Tally, remove: CountedKind | null, add: CountedKind): SwapOutcome {
  const removed: Tally = remove ? { ...tally, [remove]: Math.max(0, tally[remove] - 1) } : tally;
  const swapped = countOutfits({ ...removed, [add]: removed[add] + 1 });
  const keptBoth = countOutfits({ ...tally, [add]: tally[add] + 1 });

  return {
    from: countOutfits(tally),
    swapped,
    keptBoth,
    costOfSwap: Math.max(0, keptBoth - swapped),
  };
}

/** A garment as the swap picker needs to know it — never more than this. */
export type SwapCandidate<T> = {
  id: string;
  /** Null for a piece `outfit-count.ts` never counts — a coat, a bag, an accessory. */
  kind: CountedKind | null;
  wearCount: number;
  /** How many saved outfits currently include this piece — the atlas's "IN 4 OUTFITS". */
  outfitCount: number;
  piece: T;
};

export type RankedSwapCandidate<T> = SwapCandidate<T> & { outcome: SwapOutcome };

/**
 * Every storable candidate, least-worn first, each carrying the real outcome
 * of storing it to make room for `add`.
 *
 * Least-worn-first is a real recommendation from wear history, not a fixed
 * order — a piece worn zero times sorts ahead of one worn once. Ties break on
 * how few outfits the piece anchors, so nobody is nudged toward storing the
 * garment quietly holding four looks together.
 */
export function rankSwapCandidates<T>(
  tally: Tally,
  add: CountedKind,
  candidates: readonly SwapCandidate<T>[],
): RankedSwapCandidate<T>[] {
  return [...candidates]
    .sort((a, b) => a.wearCount - b.wearCount || a.outfitCount - b.outfitCount)
    .map((c) => ({ ...c, outcome: outcomeOfSwap(tally, c.kind, add) }));
}
