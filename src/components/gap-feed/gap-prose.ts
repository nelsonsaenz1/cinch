/**
 * Audit 85 · every gain figure names its unit and both of its endpoints.
 *
 * THE DEFECT THIS REPLACES
 *
 * The Gap Feed printed `+7` in 26pt oxblood beside a gap's label. Seven what?
 * Seven from what? A delta with neither unit nor base is not a fact anybody
 * can check, and the one number in the product that has to be checkable is the
 * one the whole free tier rests on. The atlas's replacement is a sentence:
 *
 *     "7 more outfit cores — complete top, bottom and shoe combinations —
 *      taking you from 14 to 21."
 *
 * Unit named, unit defined in passing, both endpoints printed.
 *
 * THE ARITHMETIC IS THE APP'S ARITHMETIC
 *
 * Every number here comes out of `outfit-count.ts` and nothing here re-derives
 * one. `Gain.total` is `countOutfits(withOne(tally, kind))` and `Gain.gain` is
 * `total - countOutfits(tally)`, so the base this file prints is recovered as
 * `total - gain` and asserted equal to `countOutfits(tally)` in the tests. Four
 * screens quoting four different totals is the failure `outfit-count.ts`'s
 * header exists to prevent, and a card that computed its own "from" figure
 * would be the fifth.
 *
 * THE GLOSS IS ADAPTIVE, AND HAS TO BE
 *
 * The atlas glosses a core as "complete top, bottom and shoe combinations".
 * That is the whole truth only for a closet with no dresses:
 * `countOutfits` is `tops × bottoms × shoes + dresses × shoes`, so a closet
 * holding a dress counts dress-and-shoe pairs as cores too. Printing the
 * atlas's gloss over a closet with dresses in it would understate the unit the
 * sentence has just promised to define — so the dress clause appears exactly
 * when the closet has a dress in it, and the atlas's own wording is what a
 * dressless closet gets.
 *
 * WHY IT LIVES UNDER components/gap-feed
 *
 * It is copy, not arithmetic: the numbers are `outfit-count.ts`'s and this
 * module only words them. `features/closet/gap-feed.ts` is shared with Today's
 * own gap card and belongs to no lane; this is the Gap Feed's own voice and
 * sits with the Gap Feed's own components.
 */

import { gapLabel, gapNoun, nounWithArticle } from '@/features/closet/gap-feed';
import { countOutfits, type Gain, type Tally } from '@/features/closet/outfit-count';

/** "outfit core" / "outfit cores" — the unit, spelled out, never "+7". */
export function coreNoun(n: number): string {
  return n === 1 ? 'outfit core' : 'outfit cores';
}

/**
 * The parenthetical definition of the unit. See the header for why the dress
 * clause is conditional rather than always drawn or always omitted.
 */
export function coresGloss(tally: Tally): string {
  return tally.dresses > 0
    ? 'complete top, bottom and shoe combinations, or a dress with shoes'
    : 'complete top, bottom and shoe combinations';
}

export type GainSentenceOptions = {
  /** Define the unit inline. The first card on the feed does; later ones do not. */
  gloss?: boolean;
};

/**
 * "A second pair of trousers would give you 7 more outfit cores — complete
 * top, bottom and shoe combinations — taking you from 14 to 21."
 *
 * A gain of zero is stated as a gain of zero with both endpoints, never
 * omitted and never dressed up: a piece that adds nothing is a fact the feed
 * is allowed to print, and "you would stay at 14" is the same sentence with
 * the two endpoints equal.
 */
export function gainSentence(tally: Tally, gain: Gain, options: GainSentenceOptions = {}): string {
  const from = gain.total - gain.gain;
  const label = gapLabel(tally, gain.kind);
  const gloss = options.gloss ? ` — ${coresGloss(tally)} — ` : ', ';

  if (gain.gain <= 0) {
    // No em-dash-as-a-missing-number anywhere here: this is a printed zero,
    // which the refusals allow, not an omitted figure.
    return options.gloss
      ? `${label} would add no new outfit cores${gloss}so you would stay at ${from}.`
      : `${label} would add no new outfit cores, so you would stay at ${from}.`;
  }

  return `${label} would give you ${gain.gain} more ${coreNoun(gain.gain)}${gloss}taking you from ${from} to ${gain.total}.`;
}

/**
 * The evidence sentence that precedes the gain — what the closet already holds
 * that is waiting for the missing piece.
 *
 * Computed from the tally, never written for a canonical closet, and null
 * whenever the closet holds nothing that would make the claim true (a closet
 * with no tops cannot be told that its tops are waiting for a bottom).
 */
export function gapEvidence(tally: Tally, gain: Gain): string | null {
  const count = (n: number, kind: 'tops' | 'bottoms' | 'dresses' | 'shoes') =>
    `${n} ${gapNoun(kind, n)}`;

  switch (gain.kind) {
    case 'bottoms': {
      if (tally.tops === 0) return null;
      const owned = count(tally.tops, 'tops');
      const verb = tally.tops === 1 ? 'works' : 'work';
      return tally.bottoms === 0
        ? `You own ${owned} that ${verb} with bottoms and no bottom at all.`
        : `You own ${owned} that ${verb} with bottoms and only ${count(tally.bottoms, 'bottoms')}.`;
    }
    case 'tops': {
      if (tally.bottoms === 0) return null;
      const owned = count(tally.bottoms, 'bottoms');
      return tally.tops === 0
        ? `You own ${owned} and nothing to wear over them.`
        : `You own ${owned} and only ${count(tally.tops, 'tops')} to wear over them.`;
    }
    case 'shoes': {
      const pairable = tally.tops + tally.bottoms + tally.dresses;
      if (pairable === 0) return null;
      return tally.dresses > 0
        ? 'Every top, bottom and dress you own would go with another pair.'
        : 'Every top and bottom you own would go with another pair.';
    }
    case 'dresses': {
      if (tally.shoes === 0) return null;
      return `It would pair with the ${count(tally.shoes, 'shoes')} you already own.`;
    }
  }
}

/** The card's whole explanation: the evidence, then the arithmetic. */
export function gapProse(tally: Tally, gain: Gain, options: GainSentenceOptions = {}): string {
  const evidence = gapEvidence(tally, gain);
  const sentence = gainSentence(tally, gain, options);
  return evidence ? `${evidence} ${sentence}` : sentence;
}

/**
 * GF-03's "Why this was suggested" — the same arithmetic, restated on the
 * product sheet so a sheet is never a decontextualised advert.
 *
 * It repeats the gap rather than describing the product: nothing here is read
 * from the catalogue, so no merchant copy can ever end up inside the reason a
 * suggestion exists.
 */
export function productReason(tally: Tally, gain: Gain): string {
  const from = gain.total - gain.gain;
  const noun = nounWithArticle(gain.kind);
  if (gain.gain <= 0) {
    return `It fills the ${gapNoun(gain.kind, 2)} gap, though it would not add a core on its own — you would stay at ${from} ${coreNoun(from)}.`;
  }
  return `It fills the ${gapNoun(gain.kind, 2)} gap: ${noun} is what your closet is short of, taking you from ${from} ${coreNoun(from)} to ${gain.total}.`;
}

/**
 * A guard, not a formatter: the base a sentence prints must be the count the
 * app computes. Exported so the tests can hold every call site to it rather
 * than only the ones they happened to think of.
 */
export function baseOf(tally: Tally, gain: Gain): number {
  const derived = gain.total - gain.gain;
  const actual = countOutfits(tally);
  if (derived !== actual) {
    throw new Error(`gap arithmetic disagrees with countOutfits(): ${derived} vs ${actual}`);
  }
  return actual;
}
