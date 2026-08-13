/**
 * What did the person actually ask for?
 *
 * One parser, two inputs. A typed description and a finished voice transcript
 * of the same garment must produce the SAME query — not a similar one — because
 * the handoff makes them converge on one screen ("typed + spoken converge
 * here", CPV2-04) and a user who says a thing and then types it must not get
 * two different answers.
 *
 * That equivalence is the whole reason this is a separate, pure module. It is
 * asserted directly in `tests/catalog-query.test.ts` against the launch fixture:
 * "James Perse men's T-shirt" typed, and the several things a speech recogniser
 * plausibly returns for it, all reduce to one semantic triple.
 *
 * NOTHING HERE IS A MODEL, and that is a requirement rather than a preference.
 * Every decision below is a set lookup in `garment-lexicon.ts` or a match
 * against `COLOUR_TERMS`. There is no embedding, no similarity score and no
 * network call, so the parse is deterministic, offline, free, and testable
 * without a fixture of model outputs that would go stale.
 *
 * WHY THE PARSE MATTERS MORE THAN THE RANKING
 *
 * `catalog.ts` measured the failure this exists to prevent: `name LIKE` is AND
 * across every word, so one adjective the merchant did not type empties the
 * result set — and the measured worst offender is the gender word, which is the
 * first token of the launch fixture. Meanwhile a brand in the `brand` COLUMN
 * returned 20/20 real Reformation garments where the same word in free text
 * returned a Zadig & Voltaire dress and a keyword-stuffed SHEIN listing.
 *
 * So the parser's two jobs, in order of value:
 *   1. Get the brand out of the free text and into the `brand` field.
 *   2. Get the gender word into its own bucket so the ladder can drop it.
 *
 * Everything else here serves the family grouping downstream.
 */

import { type LadderRung, normaliseQuery } from './catalog.ts';
import {
  COLOUR_PHRASES,
  CUT_DISTINGUISHERS,
  type GarmentClass,
  GENDER_SET,
  headNoun,
  isDescriptiveToken,
  NOUN_PHRASES,
  WEAK_SET,
} from './garment-lexicon.ts';

/**
 * The most tokens a leading unknown run may claim as a brand.
 *
 * "Comme des Garcons" is three. Four is a sentence, and a four-word brand guess
 * pinned into the `brand` column would return nothing at all — which is the one
 * failure mode this parser is built to avoid.
 */
const MAX_BRAND_TOKENS = 3;

/**
 * Two repairs `normaliseQuery` cannot make on its own.
 *
 * POSSESSIVES. `normaliseQuery` turns punctuation into spaces, so "men's"
 * becomes "men s" and that orphaned "s" lands in the search terms — where
 * `name LIKE` ANDs it against every product title and empties the result set.
 * It is also, unhelpfully, a size token. Stripping the possessive whole is the
 * only reading that is right in both places.
 *
 * HYPHENS. `normaliseQuery` deliberately KEEPS them, because a hyphen is real
 * inside a product name. But "T-shirt" is the launch fixture's own spelling and
 * it must reach the same garment noun as "t shirt" and "tshirt".
 *
 * Applied to product TITLES as well as to queries, so a merchant who writes
 * "T-Shirt" and a person who types "t shirt" meet in the same place.
 *
 * Both repairs live here rather than in `normaliseQuery` on purpose: that
 * function's output is hashed into `catalog_lookups.cache_key`, and changing it
 * would silently invalidate every cached row in the table.
 */
export function prepareText(raw: string): string {
  return raw.replace(/['’‘`´]s\b/gi, '').replace(/-/g, ' ');
}

export type ParsedQuery = {
  /** The whole query, normalised. What the ladder's first rung searches. */
  normalised: string;
  /**
   * The maker, when one was recognised. Goes to Datafeedr's `brand` COLUMN and
   * never into the free-text match — see the file header for the measurement.
   */
  brand: string | null;
  /** How the brand was arrived at, because the two deserve different trust. */
  brandSource: 'known' | 'leading-run' | null;
  /** The garment noun the query is about — "t shirt", not "shirt". */
  noun: string | null;
  productClass: GarmentClass | null;
  /**
   * A `COLOUR_TERMS` value, or null. Never a hex and never a guess: the same
   * enum the voice parse is constrained to, so a spoken "navy" and a typed
   * "navy" are one value.
   */
  colour: string | null;
  /** Gender words, removed. The ladder's second rung is exactly this list. */
  gender: string[];
  /** Other words merchants do not title with. Dropped alongside the gender. */
  weak: string[];
  /** Everything left: the words a merchant plausibly wrote. */
  strong: string[];
  /**
   * Cuts that would make a row a NEAR MISS rather than a match — "henley" and
   * "polo" for a tee. Empty when the noun has no such table, which per the
   * handoff's §10.4 means no near-miss group is offered at all rather than a
   * guessed one.
   */
  nearMissCuts: readonly string[];
};

/**
 * A stable, comparable summary of what was asked for.
 *
 * This is the thing typed and spoken input must agree on, and the thing the
 * equivalence test compares. Deliberately NOT the raw string: a transcript
 * carries different punctuation, different contractions and often a different
 * word order for the same garment, and demanding string equality there would
 * be testing the speech recogniser rather than the parser.
 */
export function semanticTriple(parsed: ParsedQuery): string {
  return [parsed.brand ?? '-', parsed.productClass ?? '-', parsed.colour ?? '-'].join('|');
}

/** Does the token list contain this phrase, as whole words, and where? */
function phraseIndex(tokens: readonly string[], phrase: string): number {
  const parts = phrase.split(' ');
  outer: for (let i = 0; i + parts.length <= tokens.length; i += 1) {
    for (let j = 0; j < parts.length; j += 1) {
      if (tokens[i + j] !== parts[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * The brand, without a brand list.
 *
 * A curated brand lexicon does not exist in this repository and inventing one
 * would be worse than having none: a list that is wrong in the tail sends real
 * makers into the free-text match, which is the exact failure measured in
 * `catalog.ts`. So `known` is injected when a caller has a real list (a later
 * packet can build one from `catalog_lookups`), and when it does not, this
 * heuristic stands in.
 *
 * THE HEURISTIC, STATED PLAINLY SO ITS FAILURES ARE PREDICTABLE: the brand is
 * the run of leading tokens before the first word that proves the description
 * has begun — a colour, a garment noun, a gender word, a cut, a material, a
 * size or a filler word. "james perse mens t shirt" stops at "mens" and yields
 * "james perse". "cream mohair sweater" stops at token zero and yields nothing.
 * "reformation midi dress" stops at "midi" and yields "reformation".
 *
 * WHERE IT IS WRONG, AND WHAT THAT COSTS. A description opening on a word the
 * lexicon does not know is read as a maker. `DESCRIPTOR_TERMS` exists to make
 * that rare — "distressed black jeans" was the motivating case and is now
 * handled — but the tail is real and cannot be closed by a word list.
 *
 * The cost is NOT one wasted request, and it would be comfortable to pretend
 * otherwise: the brand travels as a `brand =` constraint on EVERY rung of the
 * ladder, so a wrong brand empties every rung and the whole search returns
 * nothing. The user sees CPV2-09 — "the licensed shop catalogue has no … right
 * now" — which is a true sentence about the query that was actually run and a
 * misleading one about the garment.
 *
 * Two things make that acceptable for now and neither is a shrug. A brand run
 * only starts at the FRONT of the query, so every ordinary description that
 * opens on a colour, a material, a cut or a garment noun is unaffected. And
 * `brandSource` is reported, so a later packet can drop a `leading-run` brand on
 * the ladder's last rung — the proper fix, which needs a per-rung brand and is
 * therefore not this packet's.
 */
function detectBrand(
  tokens: readonly string[],
  known: readonly string[],
): { brand: string | null; source: ParsedQuery['brandSource']; consumed: number } {
  // A real list always wins, longest match first, wherever it appears — a maker
  // named in the middle of a sentence is still the maker.
  const sorted = [...known].sort((a, b) => b.length - a.length);
  for (const candidate of sorted) {
    const normalised = normaliseQuery(candidate);
    if (!normalised) continue;
    if (phraseIndex(tokens, normalised) !== -1) {
      return { brand: candidate, source: 'known', consumed: normalised.split(' ').length };
    }
  }

  // Where the description begins. Two things can mark it, and BOTH have to be
  // checked or the run walks straight into a garment name: a single descriptive
  // token, and the first word of a MULTI-WORD noun or colour phrase whose own
  // first word is meaningless alone. Without the second check, "james perse t
  // shirt" reads "t" as unrecognised, claims "james perse t" as the brand, and
  // leaves "shirt" behind — a different garment, confidently.
  let boundary = tokens.length;
  for (let i = 0; i < tokens.length; i += 1) {
    if (isDescriptiveToken(tokens[i])) {
      boundary = i;
      break;
    }
  }
  for (const phrase of [...NOUN_PHRASES, ...COLOUR_PHRASES]) {
    if (!phrase.includes(' ')) continue;
    const at = phraseIndex(tokens, phrase);
    if (at !== -1 && at < boundary) boundary = at;
  }

  const run = Math.min(boundary, MAX_BRAND_TOKENS);

  if (run === 0) return { brand: null, source: null, consumed: 0 };

  // A run that swallows the ENTIRE query is not a brand; it is a description
  // made of words this lexicon does not know, and pinning all of it to
  // `brand =` would guarantee zero rows.
  if (run === tokens.length) return { brand: null, source: null, consumed: 0 };

  return { brand: tokens.slice(0, run).join(' '), source: 'leading-run', consumed: run };
}

/**
 * Parse one description — typed or transcribed — into a query.
 *
 * `known` is the injection seam for a real brand lexicon. It is empty today and
 * the heuristic above carries the load; passing a list changes only which
 * branch of `detectBrand` answers, never the shape of the result.
 */
export function parseQuery(raw: string, known: readonly string[] = []): ParsedQuery {
  // The SAME normalisation the cache key and the provider query already use, so
  // a parse cannot disagree with the lookup it produces — after two repairs
  // that `normaliseQuery` cannot make on its own without changing every cache
  // key in the table:
  //
  //   POSSESSIVES. `normaliseQuery` turns punctuation into spaces, so "men's"
  //   becomes "men s" and that orphaned "s" lands in the search terms — where
  //   `name LIKE` ANDs it against every product title and empties the result
  //   set. It is also, unhelpfully, a size token. Stripping the possessive
  //   whole is the only reading that is right in both places.
  //
  //   HYPHENS. `normaliseQuery` deliberately KEEPS them, because a hyphen is
  //   real inside a product name. But "T-shirt" is the launch fixture's own
  //   spelling and it must reach the same garment noun as "t shirt" and
  //   "tshirt", so the parser splits on them for its own purposes.
  //
  // Both repairs are made here rather than in `normaliseQuery` on purpose: that
  // function's output is hashed into `catalog_lookups.cache_key`, and changing
  // it would silently invalidate every cached row in the table.
  const normalised = normaliseQuery(prepareText(raw));
  const tokens = normalised.split(' ').filter(Boolean);

  if (tokens.length === 0) {
    return {
      normalised,
      brand: null,
      brandSource: null,
      noun: null,
      productClass: null,
      colour: null,
      gender: [],
      weak: [],
      strong: [],
      nearMissCuts: [],
    };
  }

  const { brand, source, consumed } = detectBrand(tokens, known);
  // The brand's own words leave the free text. Leaving them in would AND the
  // maker's name against the product title as well as the brand column, which
  // is the double constraint that returns nothing when a merchant titles a
  // garment without repeating its own name.
  const rest = source === 'leading-run' ? tokens.slice(consumed) : withoutKnownBrand(tokens, brand);

  // Longest phrase first, so "t shirt" claims the match before "shirt" can —
  // and head-position only, so "short sleeve tee" is a top rather than a pair
  // of shorts. See `headNoun`.
  const head = headNoun(rest);
  const noun = head?.noun ?? null;
  const productClass = head?.klass ?? null;

  // Multi-word colours before single words, for the reason `intake-schema.ts`
  // records: collapsing "light wash" to one token resolves to nothing and turns
  // every garment described that way grey.
  let colour: string | null = null;
  for (const phrase of COLOUR_PHRASES) {
    if (phraseIndex(rest, phrase) !== -1) {
      colour = phrase;
      break;
    }
  }

  const gender: string[] = [];
  const weak: string[] = [];
  const strong: string[] = [];
  for (const token of rest) {
    if (GENDER_SET.has(token)) gender.push(token);
    else if (WEAK_SET.has(token)) weak.push(token);
    else strong.push(token);
  }

  return {
    normalised,
    brand,
    brandSource: source,
    noun,
    productClass,
    colour,
    gender,
    weak,
    strong,
    nearMissCuts: noun ? (CUT_DISTINGUISHERS[noun] ?? []) : [],
  };
}

/** Remove an injected brand's words wherever they appeared. */
function withoutKnownBrand(tokens: readonly string[], brand: string | null): string[] {
  if (!brand) return [...tokens];
  const parts = normaliseQuery(brand).split(' ').filter(Boolean);
  const at = phraseIndex(tokens, parts.join(' '));
  if (at === -1) return [...tokens];
  return [...tokens.slice(0, at), ...tokens.slice(at + parts.length)];
}

/**
 * The relaxation ladder, rebuilt on top of the parse.
 *
 * Three rungs at most, and the ceiling is a cost rather than a preference: the
 * Starter plan meters REQUESTS, so a ladder that walks four rungs on a query
 * nobody can answer is four times the price of admitting the miss. The ladder
 * only advances when a rung returns NOTHING, so the common case remains one
 * request.
 *
 *   1. Everything the person said.
 *   2. The same, without the gender and filler words. This is the rung the
 *      launch fixture needs and the one `catalog.ts` measured: "James Perse
 *      mens white button down" returns nothing; the same words without "mens"
 *      return five real James Perse shirts.
 *   3. The same again, one trailing word shorter. Merchant titles lead with the
 *      maker and the garment and trail off into colour and cut, so the front of
 *      the phrase is where the identifying signal is.
 *
 * A GUESSED BRAND IS DROPPED ONCE, AT THE END. A brand travels as a `brand =`
 * column constraint on every rung, which is what makes it cheap to keep — and
 * also what makes a WRONG one catastrophic rather than merely wasteful: it
 * empties every rung at once, and the user is told the licensed catalogue has
 * nothing while their shirt sits in it.
 *
 * The parser reports HOW it arrived at a brand, and the two deserve different
 * treatment:
 *
 *   `known`        the caller supplied a real brand lexicon, or the user named
 *                  the brand themselves. NEVER relaxed. Silently widening a
 *                  question somebody asked deliberately would answer a
 *                  different question and present it as theirs — and "any tee"
 *                  is not a looser version of "a James Perse tee".
 *
 *   `leading-run`  a heuristic read the leading words as a maker. Usually right,
 *                  sometimes a word the lexicon has not met. So the LAST rung,
 *                  and only the last, asks the same words with no brand at all.
 *
 * Still three requests. The brandless rung REPLACES the trailing-word trim
 * rather than being added after it, because a bounded cost is the whole point
 * of the ladder and "one more, just in case" is how a cap stops meaning
 * anything.
 */
export const MAX_LADDER_RUNGS = 3;

/** One rung, with the decision that produced it. */
export type PlannedRung = LadderRung & {
  /** True on the rung that deliberately asks without the guessed brand. */
  brandRelaxed: boolean;
  /** Why this rung exists — for the report, and so the rule is testable. */
  why: 'as-said' | 'weak-terms-dropped' | 'shortened' | 'brand-relaxed' | 'last-resort';
};

/**
 * The ladder and the reasoning behind it.
 *
 * Exposed separately from `ladderFor` so the rule is testable as a RULE rather
 * than inferred from a list of strings — "a known brand is never relaxed" is a
 * claim about a decision, and a test that could only see the rungs would pass
 * for the wrong reason whenever two rungs happened to look alike.
 */
export function ladderPlan(parsed: ParsedQuery): {
  rungs: PlannedRung[];
  /** Index of the brandless rung, or null when none was warranted. */
  brandRelaxedAt: number | null;
  brandSource: ParsedQuery['brandSource'];
} {
  const all = [...parsed.gender, ...parsed.weak, ...parsed.strong];
  const ordered = parsed.normalised
    .split(' ')
    .filter(Boolean)
    .filter((t) => all.includes(t));

  const rungs: PlannedRung[] = [];
  const key = (brand: string | null | undefined) => (brand === undefined ? '=query' : String(brand));

  const push = (terms: string[], why: PlannedRung['why'], brand?: string | null) => {
    const value = terms.join(' ').trim();
    // Never below two terms: a one-word query ("shirt") is not a looser version
    // of the question, it is a useless different one, and answering it would be
    // worse than admitting the miss.
    if (terms.length < 2 || !value) return;
    // Deduplicated on the PAIR. Rung two and the brandless rung frequently
    // carry identical words and are different questions; collapsing them on the
    // string alone would silently delete the recovery.
    if (rungs.some((r) => r.value === value && key(r.brand) === key(brand))) return;
    rungs.push({
      value,
      ...(brand === undefined ? {} : { brand }),
      brandRelaxed: brand === null,
      why,
    });
  };

  push(ordered, 'as-said');
  push(parsed.strong, 'weak-terms-dropped');

  // Only a GUESSED brand is ever dropped, once, and only inside the cap.
  if (parsed.brandSource === 'leading-run' && parsed.brand !== null) {
    push(parsed.strong.length >= 2 ? parsed.strong : ordered, 'brand-relaxed', null);
  } else {
    const trimmed = [...parsed.strong];
    while (trimmed.length > 2 && rungs.length < MAX_LADDER_RUNGS) {
      trimmed.pop();
      push(trimmed, 'shortened');
    }
  }

  // A single strong term with a brand beside it is a legitimate question —
  // `brand = James Perse` plus "tee" is specific enough — so it is offered when
  // nothing longer survived the two-term floor.
  if (rungs.length === 0 && parsed.strong.length === 1 && parsed.brand) {
    rungs.push({ value: parsed.strong[0], brandRelaxed: false, why: 'last-resort' });
  }
  // And with no brand at all, the words themselves are all there is.
  if (rungs.length === 0 && parsed.normalised) {
    rungs.push({ value: parsed.normalised, brandRelaxed: false, why: 'last-resort' });
  }

  const capped = rungs.slice(0, MAX_LADDER_RUNGS);
  const at = capped.findIndex((r) => r.brandRelaxed);
  return { rungs: capped, brandRelaxedAt: at === -1 ? null : at, brandSource: parsed.brandSource };
}

/** The rungs alone, in the shape `searchCatalogue` consumes. */
export function ladderFor(parsed: ParsedQuery): LadderRung[] {
  return ladderPlan(parsed).rungs.map((r) =>
    'brand' in r ? { value: r.value, brand: r.brand } : { value: r.value },
  );
}
