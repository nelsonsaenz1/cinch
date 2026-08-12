import { gapNoun } from '@/features/closet/gap-feed';
import type { Gain } from '@/features/closet/outfit-count';
import { numberWord } from '@/features/onboarding/reveal-copy';

/**
 * The gap card's sentence — computed reasoning, nothing else.
 *
 * "The gap card is computed reasoning only: it names the kind of piece and what
 * owning one would unlock, in the '+7 outfit cores' form rather than a bare
 * figure."
 *
 * Both halves come out of `outfit-count.ts`: the name from the tally's own
 * ordinal ("a third pair of shoes"), the number from `countOutfits` via
 * `rankGaps`. Nothing here is written for the canonical ten, and nothing is
 * printed that the arithmetic did not produce.
 */
export function gapSentence(gain: Gain): string {
  return `One more ${gapNoun(gain.kind)} would give you ${numberWord(gain.gain)} more outfit ${
    gain.gain === 1 ? 'core' : 'cores'
  } from pieces you already own.`;
}
