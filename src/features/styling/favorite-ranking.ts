import type { OutfitCandidate } from '@/lib/styling';

export const FAVORITE_BONUS = 0.03;

function core(ids: readonly string[]): string {
  return [...ids].sort().join('.');
}

/** A bounded exact-core preference applied only after feasibility scoring. */
export function favorExactCores(
  candidates: readonly OutfitCandidate[],
  favoriteItemIds: readonly (readonly string[])[],
): OutfitCandidate[] {
  const favorites = new Set(favoriteItemIds.map(core));
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      adjusted:
        candidate.score +
        (favorites.has(core(candidate.items.map((item) => item.id))) ? FAVORITE_BONUS : 0),
    }))
    .sort((a, b) => b.adjusted - a.adjusted || a.index - b.index)
    .map(({ candidate }) => candidate);
}
