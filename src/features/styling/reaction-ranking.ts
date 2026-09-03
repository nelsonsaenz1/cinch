/**
 * What a thumbs-down does — CMO ledger A9.
 *
 * Forty-three reactions from eight people had changed nothing a user could
 * see. `apply_outfit_reaction` folds each one into the learned taste weights
 * (`style_profiles.weights`), so the engine could learn "you like neutrals"
 * but never "not THIS outfit" — the exact combination someone refused came
 * back the next morning with the same score. This is the ranking-time half:
 * a bounded nudge on the candidates the engine already produced, keyed on
 * the outfit's CORE so a swapped bag cannot defeat the match.
 *
 * Four properties, so this is the smallest CORRECT version:
 *  · BOUNDED — ±REACTION_DELTA on a 0..1 score. A refused outfit is demoted,
 *    never removed: the engine has no refusal predicate (outfit-count.ts),
 *    and the Reveal's count stays honest.
 *  · RANKING-TIME — `updateWeights`/`updateAffinities` are untouched, so the
 *    two mechanisms cannot double-count one opinion.
 *  · RETRACTION-SAFE — `retractOutfitReaction` deletes the row, so the
 *    penalty leaves with it. Until now that delete was unobservable.
 *  · CORE-KEYED — the same reduction The Repeat matches on (`coreIdsOf`).
 *
 * Pure: no React, no store, no clock of its own.
 */

import type { Garment, OutfitCandidate } from '@/lib/styling';

import { FAVORITE_BONUS } from './favorite-ranking';
import { coreIdsOf, coreKey } from './repeat';

/** Twice `FAVORITE_BONUS`: an explicit "no" outranks an implicit "yes". */
export const REACTION_DELTA = 0.06;
/** Taste moves; a refusal from March should not be permanent. */
export const REACTION_HALF_LIFE_DAYS = 45;

export type ReactionRow = {
  readonly item_ids: readonly string[];
  /** +1 liked, -1 disliked — the `outfit_reactions.reaction` check constraint. */
  readonly reaction: number;
  readonly created_at: string;
};

/**
 * The remembered opinion per core, in [-1, 1].
 *
 * Input newest-first (the query's own order). Each older row is folded in
 * at half weight behind the newer ones, decayed by its age — exponential
 * smoothing toward the latest opinion, the idiom `updateAffinities` already
 * uses. Exported so the test can read the signal, not only the sort.
 */
export function reactionSignals(
  reactions: readonly ReactionRow[],
  wardrobe: readonly Garment[],
  now: number,
): Map<string, number> {
  const byCore = new Map<string, number>();
  const known = new Set(wardrobe.map((g) => g.id));
  // Fold oldest → newest so the newest opinion is the one least attenuated.
  for (let i = reactions.length - 1; i >= 0; i -= 1) {
    const r = reactions[i]!;
    // A reaction about a garment that has since left the closet is about an
    // outfit that no longer exists. `coreIdsOf` would quietly shrink its key
    // to the survivors and the opinion would land on a smaller core the
    // person never judged (verification, pass two).
    if (r.item_ids.some((id) => !known.has(id))) continue;
    const key = coreKey(coreIdsOf(r.item_ids, wardrobe));
    if (!key) continue;
    const ageMs = now - Date.parse(r.created_at);
    const ageDays = Number.isFinite(ageMs) ? Math.max(0, ageMs) / 86_400_000 : 0;
    const decay = Math.pow(0.5, ageDays / REACTION_HALF_LIFE_DAYS);
    const vote = Math.sign(r.reaction) * decay;
    byCore.set(key, (byCore.get(key) ?? 0) * 0.5 + vote);
  }
  for (const [key, value] of byCore) byCore.set(key, Math.max(-1, Math.min(1, value)));
  return byCore;
}

/**
 * Re-rank candidates by remembered reactions AND favourites, in one sort.
 *
 * ONE SORT, NOT TWO. Neither this nor `favorExactCores` writes its
 * adjustment back into `score`, so composing them — either order — lets the
 * second re-sort on the raw score and silently erase the first's work the
 * moment one unrelated row exists (verification, pass two). So the favourite
 * bonus is applied here, in the same sum, and `use-outfits.ts` calls only
 * this. `favorExactCores` remains for its own tests and callers.
 *
 * The two deltas are chosen so an explicit "no" outranks an implicit "yes":
 * `REACTION_DELTA` is twice `FAVORITE_BONUS`. Stable: ties keep the engine's
 * order.
 */
export function applyReactionMemory<T extends OutfitCandidate>(
  candidates: readonly T[],
  reactions: readonly ReactionRow[],
  wardrobe: readonly Garment[],
  now: number,
  favoriteItemIds: readonly (readonly string[])[] = [],
): T[] {
  if (candidates.length === 0) return [];
  if (reactions.length === 0 && favoriteItemIds.length === 0) return [...candidates];
  const signals = reactionSignals(reactions, wardrobe, now);
  const favorites = new Set(favoriteItemIds.map((ids) => [...ids].sort().join('.')));
  if (signals.size === 0 && favorites.size === 0) return [...candidates];

  return candidates
    .map((c, index) => {
      const ids = c.items.map((g) => g.id);
      const signal = signals.get(coreKey(coreIdsOf(ids, wardrobe))) ?? 0;
      const favored = favorites.has([...ids].sort().join('.')) ? FAVORITE_BONUS : 0;
      return { c, index, adjusted: c.score + signal * REACTION_DELTA + favored };
    })
    .sort((a, b) => b.adjusted - a.adjusted || a.index - b.index)
    .map(({ c }) => c);
}
