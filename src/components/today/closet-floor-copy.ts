import { nounWithArticle } from '@/features/closet/gap-feed';
import type { CountedKind } from '@/features/closet/outfit-count';

/**
 * "a bottom and a pair of shoes" — the kinds a first outfit is missing, in the
 * engine's own words, joined the way a sentence joins them.
 *
 * The list itself comes from `missingForFirstOutfit`, which is the same
 * routine the Reveal's zero state uses: "so the two screens can never disagree
 * about what a first outfit needs" (T-11). This module holds only the joining,
 * and holds it apart from `closet-floor.tsx` so it can be tested — the unit
 * bundler cannot follow React Native's Flow source, so nothing importable by a
 * test may reach a `.tsx`.
 */
export function missingPhrase(kinds: readonly CountedKind[]): string | null {
  const nouns = kinds.map(nounWithArticle);
  if (nouns.length === 0) return null;
  if (nouns.length === 1) return nouns[0];
  return `${nouns.slice(0, -1).join(', ')} and ${nouns[nouns.length - 1]}`;
}
