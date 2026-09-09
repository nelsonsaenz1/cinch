import { nounWithArticle } from '@/features/closet/gap-feed';
import type { CountedKind } from '@/features/closet/outfit-count';
import { numberWord } from '@/features/onboarding/reveal-copy';

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

/**
 * The floor's progress sentence — and the one state it used to get wrong.
 *
 * A closet under ten reads "Three pieces in. Seven more pieces to go." with
 * the missing half named after it. A closet AT ten that the engine still
 * cannot dress used to fall through the same template and print
 * "Ten pieces in. Zero more pieces to go." — a count that has arrived,
 * congratulated, over a closet of ten pairs of trousers (`a874512d`,
 * 2026-09-05) or ten tops (`bae15db5`, 2026-09-07). Both came through the
 * import door, never The Ten, so The Ten's own spread card never reached
 * them; this sentence and the Closet tab's line were the only counters they
 * ever saw, and both counted.
 *
 * So at the floor with a missing half, the sentence names the SHAPE an outfit
 * needs — the App Store description's promise, in the app's own words — and
 * then the half that is absent. No projection is quoted: the closet makes
 * nothing yet, and a figure that has not moved is not printed.
 *
 * Every number is `numberWord` of a count the caller derived; nothing is
 * typed into prose.
 */
export function floorProgressLine(
  pieces: number,
  /** `piecesRemaining(pieces)` — how many the product's ten still wants. */
  remaining: number,
  /** `missingPhrase(missingForFirstOutfit(tally))`, or null. */
  missing: string | null,
): string {
  const inLine = `${capitalise(numberWord(pieces))} ${pieces === 1 ? 'piece' : 'pieces'} in.`;
  if (remaining > 0) {
    const toGo = `${capitalise(numberWord(remaining))} more ${remaining === 1 ? 'piece' : 'pieces'} to go.`;
    return missing
      ? `${inLine} ${toGo} ${capitalise(missing)} is what turns this into outfits.`
      : `${inLine} ${toGo}`;
  }
  // The count is met and the closet still cannot be dressed. Name the shape,
  // then the gap — never "zero more to go".
  return missing
    ? `${capitalise(numberWord(pieces))} pieces in — but an outfit needs a top with a bottom, or a dress. ${capitalise(missing)} is what turns this into outfits.`
    : `${inLine} Cinch is still reading them.`;
}

/**
 * The floor's one filled action.
 *
 * At the free ceiling the add door is a paywall: `a874512d` followed
 * "Add a top" straight into `add_garment_over_limit` (2026-09-05 17:46Z).
 * A full closet with a missing half is asked to SWAP, and the door it opens
 * is The Ten's own repair plate over the live grid, where a filled position
 * can be re-read or replaced without buying anything.
 */
export function floorPrimaryLabel(
  empty: boolean,
  atCeiling: boolean,
  missing: string | null,
  /** `TODAY_COPY.floorAction`, passed in so this module stays import-light. */
  firstPieceAction: string,
): string {
  if (empty) return firstPieceAction;
  if (missing) return atCeiling ? `Swap a piece for ${missing}` : `Add ${missing}`;
  return 'Add more pieces';
}
