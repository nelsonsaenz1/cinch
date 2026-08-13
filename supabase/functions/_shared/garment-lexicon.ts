/**
 * The words a garment description is made of, as one table.
 *
 * WHY THIS FILE EXISTS RATHER THAN AN IMPORT
 *
 * Three modules already hold overlapping vocabularies, each for its own good
 * reason and none of them reusable as-is:
 *
 *   `gap-shop-match/relevance.ts`  SLOT_FAMILY — garment nouns grouped by slot,
 *       used to refuse a row that is a DIFFERENT garment. It is deliberately
 *       dependency-free ("kept as a literal union rather than imported so this
 *       module has no dependencies at all"), and it belongs to a different
 *       Edge Function.
 *   `_shared/catalog.ts`  WEAK_TERMS — the words merchants do not write, and
 *       RETAINED_TERMS — the vocabulary the cache is allowed to remember. Both
 *       are private to that file and shaped for those two jobs.
 *   `_shared/intake-schema.ts`  COLOUR_TERMS — the colour enum the voice parse
 *       is constrained to, which is imported here directly because it is
 *       already the single source and already has a drift test.
 *
 * So this is the vocabulary the QUERY PARSER needs, which is a fourth job: not
 * "is this row the right garment" and not "may we remember this word", but
 * "what did the person actually ask for". Duplicating the nouns is the house
 * pattern — `intake-schema.ts` duplicates the colour lexicon and
 * `tests/intake-colour-terms.test.ts` asserts the two cannot drift. This file
 * gets the same treatment in `tests/catalog-query.test.ts`, which asserts every
 * noun here is known to `relevance.ts`'s SLOT_FAMILY and vice versa.
 *
 * NOTHING HERE IS A MODEL. Every decision the parser makes is a lookup in one
 * of these sets, which is what makes typed and spoken input provably equal
 * rather than approximately similar.
 */

import { COLOUR_TERMS } from './intake-schema.ts';

/**
 * The garment classes a catalogue query can be about.
 *
 * Same nine names as `relevance.ts`'s `RelevanceSlot`, in the same spelling, so
 * a family's class can be handed to that module later without a mapping table.
 */
export type GarmentClass =
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'footwear'
  | 'dress'
  | 'accessory'
  | 'bag'
  | 'headwear'
  | 'jewelry';

/**
 * Garment nouns by class. Mirrors `relevance.ts`'s SLOT_FAMILY and extends it
 * with the words people TYPE that merchants rarely title with — "tshirt",
 * "t-shirt" and "tee" are one garment and a shopper reaches for all three.
 *
 * Order within a class matters in exactly one place: `parseQuery` reports the
 * FIRST noun it matched as the head noun, and a longer compound must therefore
 * be listed before the word it contains ("t shirt" before "shirt").
 */
export const CLASS_NOUNS: Record<GarmentClass, readonly string[]> = {
  top: [
    't shirt', 'tshirt', 'tee', 'shirt', 'blouse', 'top', 'sweater', 'cardigan',
    'polo', 'knit', 'tank', 'jumper', 'henley', 'sweatshirt', 'hoodie', 'camisole',
  ],
  bottom: [
    'trouser', 'pant', 'jean', 'skirt', 'short', 'chino', 'legging', 'culotte', 'jogger',
  ],
  outerwear: ['coat', 'jacket', 'blazer', 'parka', 'trench', 'overcoat', 'anorak', 'gilet'],
  footwear: [
    'shoe', 'boot', 'sneaker', 'loafer', 'sandal', 'heel', 'pump', 'flat', 'trainer', 'clog',
  ],
  dress: ['dress', 'gown', 'frock', 'jumpsuit', 'romper'],
  accessory: ['scarf', 'scarves', 'shawl', 'wrap', 'stole', 'belt', 'glove', 'tie'],
  bag: ['handbag', 'bag', 'tote', 'satchel', 'clutch', 'purse', 'crossbody', 'backpack'],
  headwear: ['hat', 'cap', 'beanie', 'beret', 'fedora', 'visor'],
  jewelry: ['necklace', 'pendant', 'chain', 'choker', 'locket', 'bracelet', 'earring', 'ring'],
};

/**
 * Words that mean a DIFFERENT CUT of the same class.
 *
 * This is the near-miss table, and it is the whole of CPV2-04's subordinate
 * group. "Henley" is a top and so is a tee; a person who asked for a tee and is
 * shown a henley has been shown the wrong shirt, not the wrong garment — which
 * is why the handoff demotes rather than excludes it ("Not a T-shirt, but
 * close").
 *
 * Keyed by the HEAD NOUN the query asked for, because the distinction only
 * exists relative to a question. A henley is not a near-miss of a coat; it is
 * simply not a coat, and `CLASS_NOUNS` already settles that.
 *
 * The handoff's §10.4 governs the empty case: "if it cannot be derived, omit
 * the near-miss group rather than mixing cuts." A noun absent from this table
 * therefore produces NO near-miss group at all rather than a guessed one.
 */
export const CUT_DISTINGUISHERS: Record<string, readonly string[]> = {
  't shirt': ['henley', 'polo', 'long sleeve', 'longsleeve', 'three quarter', 'tank', 'thermal', 'turtleneck'],
  tshirt: ['henley', 'polo', 'long sleeve', 'longsleeve', 'three quarter', 'tank', 'thermal', 'turtleneck'],
  tee: ['henley', 'polo', 'long sleeve', 'longsleeve', 'three quarter', 'tank', 'thermal', 'turtleneck'],
  shirt: ['henley', 'polo', 'sleeveless', 'tank'],
  sweater: ['cardigan', 'vest', 'sleeveless'],
  jean: ['legging', 'jogger'],
  boot: ['bootie', 'ankle boot'],
};

/**
 * Gender words, kept apart from the other weak terms because they are the ones
 * the ladder exists for.
 *
 * `catalog.ts` measured this and wrote it down: *"James Perse mens white button
 * down" returns NOTHING, while the same phrase without "mens" returns five
 * actual James Perse shirts.* The garment exists; the word does not. And
 * `gender` is present on only 68% of feed rows, so it cannot be recovered as a
 * filter afterwards either.
 *
 * They are therefore parsed OUT as their own bucket rather than merged into the
 * general weak list, so the ladder's second rung can drop exactly these and the
 * report can say which token cost the result.
 */
export const GENDER_TERMS: readonly string[] = [
  'mens', 'men', 'man', 'womens', 'women', 'woman', 'ladies', 'gents',
  'unisex', 'boys', 'girls',
];

/**
 * Everything else a person says that a merchant does not title with.
 *
 * A subset of `catalog.ts`'s WEAK_TERMS minus the gender words, which have
 * moved to their own list above. Kept in sync by `tests/catalog-query.test.ts`.
 */
export const WEAK_TERMS: readonly string[] = [
  'my', 'a', 'an', 'the', 'and', 'with', 'for', 'from', 'in', 'of', 'that', 'those', 'this',
  'size', 'new', 'vintage', 'old', 'favourite', 'favorite', 'some', 'about',
];

/**
 * Cut and length words. Not garments, not colours, not weak — they are real
 * signal a merchant often does write, so they stay in the query.
 *
 * They appear here only so the brand heuristic below can recognise that it has
 * reached the description and stop. "Midi" is where "Reformation midi dress"
 * stops being a brand name.
 */
export const CUT_TERMS: readonly string[] = [
  'midi', 'maxi', 'mini', 'cropped', 'crop', 'oversized', 'slim', 'straight', 'wide',
  'skinny', 'relaxed', 'tailored', 'pleated', 'quilted', 'striped', 'floral',
  'checked', 'plaid', 'ribbed', 'crewneck', 'crew', 'vneck', 'collar', 'button',
  'sleeve', 'sleeveless', 'longsleeve', 'long', 'short', 'high', 'waisted', 'heavy', 'light',
  'down', 'neck', 'fit', 'fitted', 'classic', 'essential', 'standard',
];

/**
 * Materials. Same role as the cut terms — real signal, and a boundary for the
 * brand heuristic. "Cream mohair sweater" must not read "mohair" as a maker.
 */
export const MATERIAL_TERMS: readonly string[] = [
  'wool', 'cotton', 'linen', 'silk', 'cashmere', 'denim', 'leather', 'suede',
  'merino', 'corduroy', 'velvet', 'satin', 'tweed', 'nylon', 'fleece', 'jersey',
  'mohair', 'shearling', 'poplin', 'chambray', 'boucle', 'twill', 'canvas',
];

/**
 * Adjectives people put in front of a garment that are unmistakably NOT a
 * maker's name.
 *
 * This list is load-bearing for the brand heuristic and for nothing else. The
 * heuristic reads a leading run of unrecognised words as a brand, so every word
 * missing from the lexicon is a word that can be mistaken for one — and a wrong
 * brand is worse than a wrong term, because the brand travels as a `brand =`
 * constraint on every rung of the ladder and an unknown brand matches nothing
 * at all.
 *
 * "Distressed black jeans" is the shape of the problem: without `distressed`
 * here, the parser pins it into `brand =` and the search returns nothing while
 * the garment sits in the catalogue.
 */
export const DESCRIPTOR_TERMS: readonly string[] = [
  'distressed', 'washed', 'faded', 'heather', 'heathered', 'brushed', 'sueded',
  'ribbed', 'textured', 'plain', 'basic', 'simple', 'soft', 'thick', 'thin',
  'warm', 'cool', 'summer', 'winter', 'autumn', 'spring', 'casual', 'smart',
  'formal', 'everyday', 'weekend', 'work', 'going', 'out', 'good', 'nice',
  'little', 'big', 'huge', 'baggy', 'loose', 'tight', 'comfy', 'comfortable',
  'lightweight', 'heavyweight', 'chunky', 'fine', 'sheer', 'opaque',
];

/** Size tokens, stripped from a product title before it becomes a family key. */
export const SIZE_TERMS: readonly string[] = [
  'xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '2xl', '3xl',
  'small', 'medium', 'large', 'petite', 'plus', 'regular', 'tall',
];

/** Every colour word the parser will recognise. The voice enum, unchanged. */
export const COLOUR_WORDS: readonly string[] = COLOUR_TERMS;

// ---------------------------------------------------------------------------
// Derived lookup sets. Built once at module load; nothing here allocates per
// call, because the parser runs on every keystroke of the client's field.
// ---------------------------------------------------------------------------

/** noun -> class, for every noun and its plural. */
export const NOUN_TO_CLASS: ReadonlyMap<string, GarmentClass> = (() => {
  const map = new Map<string, GarmentClass>();
  for (const [klass, nouns] of Object.entries(CLASS_NOUNS) as [GarmentClass, readonly string[]][]) {
    for (const noun of nouns) {
      // First writer wins, so a noun listed under two classes keeps the class
      // that declared it first rather than silently changing meaning.
      if (!map.has(noun)) map.set(noun, klass);
      const plural = noun.endsWith('s') ? noun : `${noun}s`;
      if (!map.has(plural)) map.set(plural, klass);
      if (!noun.endsWith('s')) {
        const esPlural = `${noun}es`;
        if (!map.has(esPlural)) map.set(esPlural, klass);
      }
    }
  }
  return map;
})();

/**
 * Every noun phrase, longest first.
 *
 * Longest-first is what makes "t shirt" win over "shirt" — the parser scans
 * this list in order and takes the first phrase the query contains, so a
 * shorter noun contained inside a longer one can never claim the match.
 */
export const NOUN_PHRASES: readonly string[] = [...NOUN_TO_CLASS.keys()].sort(
  (a, b) => b.length - a.length || a.localeCompare(b),
);

const set = (words: readonly string[]) => new Set(words);

export const GENDER_SET: ReadonlySet<string> = set(GENDER_TERMS);
export const WEAK_SET: ReadonlySet<string> = set(WEAK_TERMS);
export const CUT_SET: ReadonlySet<string> = set(CUT_TERMS);
export const MATERIAL_SET: ReadonlySet<string> = set(MATERIAL_TERMS);
export const SIZE_SET: ReadonlySet<string> = set(SIZE_TERMS);
export const DESCRIPTOR_SET: ReadonlySet<string> = set(DESCRIPTOR_TERMS);
export const COLOUR_SET: ReadonlySet<string> = set(COLOUR_WORDS);

/**
 * Single-word colour tokens, for the token-by-token scan.
 *
 * Twenty-one of `COLOUR_TERMS` are multi-word ("light wash", "off white", "hot
 * pink"), and the note on that constant records what happens when they are
 * collapsed to one word: everything described that way resolves to nothing.
 * So the parser matches multi-word colours as PHRASES first and falls back to
 * this set for the rest.
 */
export const COLOUR_PHRASES: readonly string[] = [...COLOUR_WORDS].sort(
  (a, b) => b.length - a.length || a.localeCompare(b),
);

/**
 * The garment noun a phrase is actually ABOUT.
 *
 * The naive version — first matching noun, longest phrase first — gets "Short
 * Sleeve Crew Tee" wrong, and wrong in the worst available direction: `short`
 * is a garment noun (shorts), it is longer than `tee`, so the shirt is filed as
 * a BOTTOM and then excluded from a query for a top. The garment is in the
 * catalogue and the user never sees it.
 *
 * So a noun only counts when it is the HEAD of its phrase rather than a
 * modifier of what follows. This is the same rule `gap-shop-match/relevance.ts`
 * arrived at from the other direction — there it separates "Navy Dress Pant"
 * from a dress — reduced here to the part this module needs. A noun followed by
 * a cut word, a material or another garment noun is describing that other
 * thing: "short SLEEVE", "tank TOP is fine but "sleeve" settles it.
 */
export function headNoun(tokens: readonly string[]): { noun: string; klass: GarmentClass } | null {
  const flat = ` ${tokens.join(' ')} `;

  for (const phrase of NOUN_PHRASES) {
    const parts = phrase.split(' ');
    if (!flat.includes(` ${phrase} `)) continue;

    // Every position the phrase appears at, so one modifier use does not hide a
    // later head use — "Sleeve Tee" and "Short Sleeve" behave differently.
    for (let i = 0; i + parts.length <= tokens.length; i += 1) {
      let matches = true;
      for (let j = 0; j < parts.length; j += 1) {
        if (tokens[i + j] !== parts[j]) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;

      const next = tokens[i + parts.length];
      const demoted =
        next !== undefined &&
        (CUT_SET.has(next) || MATERIAL_SET.has(next) || NOUN_TO_CLASS.has(next));
      if (demoted) continue;

      const klass = NOUN_TO_CLASS.get(phrase);
      if (klass) return { noun: phrase, klass };
    }
  }
  return null;
}

/**
 * Any word that proves the description has begun — i.e. that whatever came
 * before it was the maker's name and whatever follows is not.
 */
export function isDescriptiveToken(token: string): boolean {
  return (
    NOUN_TO_CLASS.has(token) ||
    COLOUR_SET.has(token) ||
    GENDER_SET.has(token) ||
    WEAK_SET.has(token) ||
    CUT_SET.has(token) ||
    MATERIAL_SET.has(token) ||
    SIZE_SET.has(token) ||
    DESCRIPTOR_SET.has(token)
  );
}
