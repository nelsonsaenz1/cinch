/**
 * The Reveal's copy — every sentence that derives a number rather than just
 * stating one (free-tier-contract.md, The Reveal atlas §03: "Every count is
 * followed by the sentence that derives it. A number with no derivation is
 * indistinguishable from a slogan.") The arithmetic itself is always
 * `outfit-count.ts`'s; this module only ever narrates it.
 */

import { countOutfits, missingForFirstOutfit, type CountedKind, type Tally } from '@/features/closet/outfit-count';

const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
];

/** "Twelve", "Fourteen" — the atlas's own register for a small count; numerals past twenty. */
export function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}

const ORDINAL_WORDS = [
  'zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
  'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth',
  'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
];

/**
 * "Fourth", "eleventh" — the ordinal half of `numberWord`, and its sibling
 * here rather than a second table elsewhere.
 *
 * There were three of these before this wave: one below in
 * `substitutionDerivation`, one private to `ten-copy.ts`, and one sentence in
 * the stop sheet that had simply typed the word "eleventh" into prose. The
 * third is the reason they are consolidated — the ten's eleventh piece is a
 * derived number (it is `PLANS.free.items` plus one), and the shortest table
 * of the three stopped at "seventh", so there was nowhere to derive it from.
 * Same range as `WORDS`, and numerals past twenty for the same reason.
 */
export function ordinalWord(n: number): string {
  return ORDINAL_WORDS[n] ?? `${n}th`;
}

/**
 * The indefinite article for an ordinal word — "an eleventh", "a twelfth".
 *
 * A vowel test is enough over the range above: the only ordinals that take
 * "an" are the ones spelled with a leading vowel (eighth, eleventh,
 * eighteenth), and none of them is one of English's written-vowel-but-spoken-
 * consonant traps.
 */
export function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * R-02's default derivation: "Twelve from your tops, bottoms and shoes. Two
 * more from the dress. Counted from what you photographed, not an estimate."
 * Drops the second sentence when there is no dress to add.
 */
export function defaultDerivation(tally: Tally): string {
  const core = tally.tops * tally.bottoms * tally.shoes;
  const fromDress = tally.dresses * tally.shoes;
  const parts = [`${cap(numberWord(core))} from your tops, bottoms and shoes.`];
  if (fromDress > 0) {
    parts.push(`${cap(numberWord(fromDress))} more from the dress.`);
  }
  parts.push('Counted from what you photographed, not an estimate.');
  return parts.join(' ');
}

/**
 * R-04's derivation, for a closet that redirected the dress slot during The
 * Ten. Named explicitly rather than inferred from the tally shape — a closet
 * that simply never owned a dress and one that traded it away read
 * differently, and only the flow that ran the trade knows which happened.
 */
export function substitutionDerivation(tally: Tally, redirectedTo: CountedKind): string {
  const kindWord = redirectedTo === 'bottoms' ? 'bottom' : redirectedTo.slice(0, -1);
  const count = tally[redirectedTo];
  const other: CountedKind = redirectedTo === 'tops' ? 'bottoms' : 'tops';
  return (
    `You swapped the dress for a ${ordinalWord(count)} ${kindWord}, so the maths changed: ` +
    `${numberWord(tally[redirectedTo])} ${redirectedTo} across ${numberWord(tally[other])} ${other} ` +
    `and ${numberWord(tally.shoes)} pair${tally.shoes === 1 ? '' : 's'} of shoes.`
  );
}

/** The composition chips — "3 tops", "2 bottoms" — the user's actual tally. */
export function compositionChips(tally: Tally, hasOuterwear: boolean, hasBag: boolean): string[] {
  const chips: string[] = [];
  if (tally.tops) chips.push(`${tally.tops} top${tally.tops === 1 ? '' : 's'}`);
  if (tally.bottoms) chips.push(`${tally.bottoms} bottom${tally.bottoms === 1 ? '' : 's'}`);
  if (tally.dresses) chips.push(`${tally.dresses} dress${tally.dresses === 1 ? '' : 'es'}`);
  if (tally.shoes) chips.push(`${tally.shoes} shoe${tally.shoes === 1 ? '' : 's'}`);
  if (hasOuterwear) chips.push('1 coat');
  if (hasBag) chips.push('1 bag');
  return chips;
}

/** R-02/R-04's headline: "Ten pieces. Fourteen outfits." */
export function headline(pieceCount: number, tally: Tally): string {
  const outfits = countOutfits(tally);
  return `${cap(numberWord(pieceCount))} piece${pieceCount === 1 ? '' : 's'}. ${cap(numberWord(outfits))} outfit${outfits === 1 ? '' : 's'}.`;
}

/** R-05's headline for a zero-outfit closet: "Ten pieces. No outfits yet." */
export function zeroHeadline(pieceCount: number): string {
  return `${cap(numberWord(pieceCount))} piece${pieceCount === 1 ? '' : 's'}. No outfits yet.`;
}

const NEEDED_NAME: Record<CountedKind, string> = {
  tops: 'a top', bottoms: 'a bottom', dresses: 'a dress', shoes: 'shoes',
};
/** Readable order: what goes on before what you walk out in. */
const NEEDED_ORDER: CountedKind[] = ['bottoms', 'dresses', 'tops', 'shoes'];

function neededList(missing: CountedKind[]): string {
  const named = NEEDED_ORDER.filter((k) => missing.includes(k)).map((k) => NEEDED_NAME[k]);
  return named.length === 1 ? named[0]! : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
}

/**
 * R-05's body — always true of the actual closet, never the ten-tops
 * example's specific wording. Names exactly what would unlock a first
 * outfit, from `missingForFirstOutfit`, the same source `missingRows` and
 * `smallestFix` read.
 */
export function zeroBody(tally: Tally): string {
  const missing = missingForFirstOutfit(tally);
  if (missing.length === 0) return '';
  return (
    `Nothing you photographed goes anywhere. Cinch won’t put a look together without ` +
    `something to wear with it — ${neededList(missing)} is all it needs.`
  );
}

export type MissingRow = { label: string; value: string; needed: boolean };

/**
 * R-05's breakdown rows. Names exactly what is missing rather than every
 * counted kind — `missingForFirstOutfit` already encodes "a dress needs only
 * shoes; separates need both halves", so a closet with a dress but no shoes
 * shows Dresses and Shoes, never a Bottoms row nobody's outfit needs.
 */
export function missingRows(tally: Tally): MissingRow[] {
  const missing = new Set(missingForFirstOutfit(tally));
  const rows: MissingRow[] = [];

  const row = (kind: CountedKind, label: string) => {
    const count = tally[kind];
    const needed = missing.has(kind);
    if (count === 0 && !needed) return; // irrelevant to this failure
    rows.push({ label, value: needed ? '0 — needed' : String(count), needed });
  };

  row('tops', 'Tops');
  row('dresses', 'Dresses');
  row('bottoms', 'Bottoms');
  row('shoes', 'Shoes');
  return rows;
}

/**
 * R-05's CTA — the smallest real fix, named from what's actually missing.
 * When the closet already has more tops than the ten ever needed, the fix
 * reads as a swap ("Swap two tops for a bottom and shoes") rather than an
 * add — the atlas's own framing for its ten-tops sample. Genuinely bare
 * closets get the plain "Add" form instead.
 */
export function smallestFix(tally: Tally): string | null {
  const missing = missingForFirstOutfit(tally);
  if (missing.length === 0) return null;

  const list = neededList(missing);

  // A swap only reads honestly when there are tops to spare beyond the three
  // the canonical ten already asks for — three tops short one pair of shoes
  // has nothing to swap, it just needs shoes.
  const CANONICAL_TOPS = 3;
  const surplus = tally.tops - CANONICAL_TOPS;
  if (!missing.includes('tops') && surplus >= missing.length) {
    const n = Math.min(missing.length, surplus);
    return `Swap ${numberWord(n)} top${n === 1 ? '' : 's'} for ${list}`;
  }
  return `Add ${list} to build your first outfit`;
}
