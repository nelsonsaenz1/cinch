/**
 * Turning a parsed query into the only four things worth keeping.
 *
 * SPLIT FROM `demand.ts` FOR A MECHANICAL REASON, not a design one: the test
 * runner bundles these modules for Node, and `demand.ts` imports
 * `npm:@supabase/supabase-js` for one type — a specifier Node's TypeScript
 * cannot resolve. The canonicalisation is the part worth testing directly, so
 * it lives here where a test can import it, and the database call stays next
 * door. Same precedent as `features/intake/buckets.ts`.
 *
 * ── The question this exists to answer ─────────────────────────────────────
 *
 * "Thirty people this month wanted a brand we do not carry" is worth knowing;
 * it is the difference between adding a merchant and guessing. The obvious way
 * to learn it is to keep the queries, and that is the one thing this codebase
 * will not do — the privacy line on CPV2-01 says what you type goes to Cinch
 * and the licensed catalogue to be matched, and a table of everybody's
 * sentences is not that.
 *
 * ── How it is safe, structurally rather than by promise ────────────────────
 *
 * A sentence is turned into at most four values, every one of which comes from
 * a CLOSED VOCABULARY THE SERVER ALREADY OWNS:
 *
 *   brand    only when `parseQuery` matched a KNOWN catalogue brand. Never
 *            when it merely guessed one from a leading run of words — that
 *            path returns whatever the user typed first, so storing it would
 *            be storing a fragment of the sentence under a respectable name.
 *            This is the single most important line in the file.
 *   class    one of nine `GarmentClass` values.
 *   audience one of three buckets, from the lexicon's own gender terms.
 *   colour   a broad family derived from `COLOUR_TERMS`, itself a fixed list.
 *
 * Anything unrecognised becomes NULL, not text. There is no field in the
 * output — and no parameter on the database function — that a caller could put
 * a user phrase into, which is what makes this a structural guarantee rather
 * than a rule somebody has to remember.
 *
 * The daily row is keyed on a hash of those four values in a fixed order, so
 * "men's James Perse t-shirt" and "James Perse t-shirt for men" are one intent:
 * word order cannot make a second row because word order never gets this far.
 */

import type { ParsedQuery } from './catalog-query.ts';

/** The three audience buckets. Deliberately coarse; this is not a profile. */
export type Audience = 'mens' | 'womens' | 'unisex';

export type DemandIntent = {
  brandSlug: string | null;
  garmentClass: string | null;
  audience: Audience | null;
  colourFamily: string | null;
};

export type LatencyBucket = 'fast' | 'medium' | 'slow';

/**
 * Broad families, because a hundred and ten shades answer no question.
 *
 * "Navy", "midnight" and "cobalt" are three ways to want a blue shirt, and
 * splitting them turns one legible demand signal into three illegible ones.
 * The families below are the ones a buyer would group by; anything outside
 * them is null rather than invented, since an unmapped colour is exactly the
 * case where a guess would be a fragment of somebody's words.
 */
const COLOUR_FAMILIES: Record<string, readonly string[]> = {
  black: ['black', 'charcoal', 'espresso'],
  grey: ['grey', 'gray', 'dark grey', 'dark gray', 'light grey', 'light gray', 'silver', 'slate', 'steel', 'stone'],
  white: ['white', 'off white', 'ivory', 'cream', 'ecru', 'bone'],
  blue: [
    'navy', 'navy blue', 'midnight', 'indigo', 'denim', 'light wash', 'medium wash', 'dark wash',
    'blue', 'royal blue', 'cobalt', 'sky blue', 'baby blue', 'powder blue', 'light blue',
    'cornflower', 'slate blue', 'teal', 'turquoise', 'aqua', 'cyan', 'petrol',
  ],
  green: [
    'green', 'olive', 'olive green', 'khaki', 'forest green', 'forest', 'hunter', 'emerald',
    'sage', 'mint', 'lime green', 'lime', 'moss', 'army green',
  ],
  yellow: ['yellow', 'mustard', 'gold', 'butter', 'lemon', 'ochre'],
  orange: ['orange', 'rust', 'terracotta', 'burnt', 'burnt orange', 'peach', 'apricot', 'coral'],
  brown: ['brown', 'chocolate', 'tan', 'camel', 'beige', 'sand', 'taupe', 'caramel', 'cognac', 'bronze', 'copper'],
  red: ['red', 'crimson', 'burgundy', 'maroon', 'wine', 'brick', 'cherry', 'scarlet'],
  pink: ['pink', 'hot pink', 'blush', 'rose', 'fuchsia', 'magenta', 'salmon'],
  purple: ['purple', 'lavender', 'lilac', 'violet', 'plum', 'aubergine', 'eggplant', 'mauve'],
};

const COLOUR_TO_FAMILY: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [family, terms] of Object.entries(COLOUR_FAMILIES)) {
    for (const term of terms) map.set(term, family);
  }
  return map;
})();

const MENS_WORDS = new Set(['men', 'mens', "men's", 'man', 'male', 'boys', 'boy']);
const WOMENS_WORDS = new Set(['women', 'womens', "women's", 'woman', 'female', 'girls', 'girl', 'ladies']);
const UNISEX_WORDS = new Set(['unisex']);

/**
 * A brand slug, or null.
 *
 * Slugified because the aggregate's column refuses anything that is not a slug
 * — no spaces, no punctuation — which is the constraint that makes a sentence
 * structurally unable to land there even if this function were wrong.
 */
function brandSlug(parsed: ParsedQuery): string | null {
  // The whole rule. A guessed brand is a piece of the user's sentence.
  if (parsed.brandSource !== 'known' || !parsed.brand) return null;
  const slug = parsed.brand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 && slug.length <= 64 ? slug : null;
}

function audienceOf(parsed: ParsedQuery): Audience | null {
  let mens = false;
  let womens = false;
  for (const word of parsed.gender) {
    const w = word.toLowerCase();
    if (UNISEX_WORDS.has(w)) return 'unisex';
    if (MENS_WORDS.has(w)) mens = true;
    if (WOMENS_WORDS.has(w)) womens = true;
  }
  // Both, or neither, is not an audience. "Unisex" is a thing somebody asked
  // for; "we could not tell" is not, and recording it as unisex would invent
  // demand for a category nobody named.
  if (mens && womens) return null;
  if (mens) return 'mens';
  if (womens) return 'womens';
  return null;
}

/** Turn a parsed query into the only four things worth keeping. */
export function demandIntent(parsed: ParsedQuery): DemandIntent {
  return {
    brandSlug: brandSlug(parsed),
    garmentClass: parsed.productClass ?? null,
    audience: audienceOf(parsed),
    colourFamily: parsed.colour ? COLOUR_TO_FAMILY.get(parsed.colour.toLowerCase()) ?? null : null,
  };
}

/** Whether there is anything recognised enough to be worth a row. */
export function isRecordableIntent(intent: DemandIntent): boolean {
  return intent.brandSlug !== null || intent.garmentClass !== null;
}

export function latencyBucket(ms: number): LatencyBucket {
  if (ms < 1_000) return 'fast';
  if (ms <= 3_000) return 'medium';
  return 'slow';
}
