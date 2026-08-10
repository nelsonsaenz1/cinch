import { hexToOklch, oklchToHex, resolveColorName, type Oklch } from '@/lib/color';

/**
 * A spoken colour word becomes a colour.
 *
 * The one place in voice intake where the model is not trusted with a value.
 * `parse-closet` returns a TERM — "navy" — constrained to an enum, and this
 * turns it into the OKLCH the styling engine scores on and the hex the closet
 * draws with. Reframe directive §4.9: the model never invents OKLCH.
 *
 * WHY THIS RUNS ON THE DEVICE AND NOT IN THE EDGE FUNCTION
 *
 * The lexicon is `src/lib/color/families.ts`, which is client code and stays
 * client code. Resolving in `parse-closet` would mean a second copy of a
 * hundred-entry colour table in a second runtime, drifting on its own schedule
 * — so the Edge Function writes `colour_oklch: null` on purpose and the
 * procession fills it in as it walks. That also means a correction in V-07
 * re-resolves through exactly the same path as the original parse, rather than
 * through a second implementation that might disagree.
 *
 * THE HONEST LIMIT
 *
 * A spoken "navy" resolves to *a* navy, not to *your* navy. That is the one
 * real cost of voice intake over photography (§1), it is recorded on the
 * garment as `colour_source = 'spoken'`, and it is recoverable: V-08's
 * photograph replaces it with measured OKLCH and everything downstream
 * improves silently.
 */

/**
 * What a draft's `colour_oklch` column holds.
 *
 * The hex rides along with the OKLCH because `commit_intake_session` builds
 * `items.colors` — a `[{hex, name}]` array — and has no colour maths of its
 * own. Doing the conversion here keeps all of it in one place.
 */
export type ResolvedColour = {
  l: number;
  c: number;
  h: number;
  hex: string;
};

/**
 * The fallback when a term resolves to nothing.
 *
 * It should be unreachable: the parse enum is exactly the lexicon's key set and
 * `tests/intake-colour-terms.test.ts` holds those together. It exists because
 * the alternative — a garment with no colour — is a drawn silhouette with no
 * fill, which is a garment with no body on the one screen whose job is to show
 * the user what was heard.
 *
 * A mid grey, deliberately: wrong in a way that reads as "not sure" rather than
 * wrong in a way that reads as a confident claim about somebody's coat.
 */
const UNRESOLVED: ResolvedColour = { l: 0.62, c: 0.01, h: 0, hex: '#9A9691' };

/** Term → colour. Never throws; an unknown term degrades to `UNRESOLVED`. */
export function resolveSpokenColour(term: string): ResolvedColour {
  const oklch = resolveColorName(term);
  if (!oklch) return UNRESOLVED;
  return toResolved(oklch);
}

/** True when the term is one the lexicon actually knows — the signal a card
 *  uses to decide whether it may state a colour confidently. */
export function isKnownColourTerm(term: string): boolean {
  return resolveColorName(term) !== null;
}

/**
 * A measured hex replaces a spoken term.
 *
 * V-08's upgrade path. Kept here rather than at the call site so that both
 * directions of the colour story live in one file, and so the shape written to
 * the column is identical whichever way the colour arrived.
 */
export function resolveMeasuredColour(hex: string): ResolvedColour {
  // `hexToOklch` is nullable — it parses, and a string that is not a colour
  // returns null rather than throwing. A malformed hex here would mean the
  // sampler produced garbage, which is not a reason to lose the garment.
  const oklch = hexToOklch(hex);
  return oklch ? toResolved(oklch) : UNRESOLVED;
}

function toResolved(oklch: Oklch): ResolvedColour {
  return {
    l: oklch.L,
    c: oklch.C,
    h: oklch.h,
    // Round-tripped through the lexicon's own converter rather than kept from
    // the table, so a colour that arrived as OKLCH and one that arrived as hex
    // produce byte-identical rows.
    hex: oklchToHex(oklch),
  };
}
