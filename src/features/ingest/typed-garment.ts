/**
 * DS-03/04/05 — filing a garment from typed words alone.
 *
 * The Describe atlas ends every one of its paths in a filed piece: the escape
 * row under the results ("None of these — file my own words"), the empty
 * result ("Nothing matched, so your words stand"), a match the feed could not
 * give a picture for ("filed as a silhouette"), and all three of DS-05's
 * notices. Until now none of them could be honoured — there was no way to put
 * a garment in the closet without an image, so the rows were either undrawn or,
 * in the no-picture case, a tap that would have failed in the importer.
 *
 * WHY THIS FILE IS PURE, AND WHY THAT IS THE POINT
 *
 * Two of DS-05's three causes are OFFLINE and CONSENT DECLINED. A normaliser
 * that called anything — the search function, the parse function, a colour
 * service — could not run in either state, which is precisely where the atlas
 * most insists the words still become a piece. So everything here is local
 * arithmetic over two lexicons that already ship in the bundle, and there is no
 * import in this file that can reach the network.
 *
 * THE PRIVACY RULE THIS FILE EXISTS TO KEEP
 *
 * The typed sentence is the user's own writing. It is written to `items`, which
 * is theirs and RLS-scoped, exactly as voice intake writes `utterance`
 * (20260810140200). It is NOT sent anywhere, and specifically it never reaches
 * `catalog_cache` — the global table that 20260811165146 deliberately stripped
 * of raw query text. Filing is not searching: nothing about this path consults
 * a partner, so there is nothing for a cache to key.
 *
 * WHAT IS DERIVED, AND WHAT IS DELIBERATELY NOT GUESSED
 *
 * A category and a colour, and only when a word the app already knows appears
 * in the sentence. Everything else stays null. The alternative — inferring a
 * fabric from "wool crewneck", a formality from "blazer" — would be the app
 * telling somebody facts about their own clothes that it invented from four
 * words, and `colour_source = 'spoken'` already records that even the colour is
 * the weaker claim. An unrecognised sentence files as `other` with the words
 * intact, which is a real, usable, honest piece.
 */

import type { Database } from '@/types/database';
import { isKnownColourTerm, resolveSpokenColour } from '@/features/intake/colour-lexicon';

type ItemCategory = Database['public']['Enums']['item_category'];

/**
 * Garment noun → category. Ordered most specific first, because "denim jacket"
 * has to reach outerwear before "denim" could suggest anything else, and
 * "shirt dress" has to be a dress rather than a top.
 *
 * The noun is also written to `subcategory` VERBATIM rather than canonicalised,
 * for the reason 20260810140200 spells out at length: `toSlot()` separates a
 * base_top from a mid_layer by regex over the subcategory text, so a sentence
 * that says "cardigan" has to keep the word "cardigan" or the styling engine
 * cannot tell it from a t-shirt.
 */
const CATEGORY_NOUNS: [RegExp, ItemCategory][] = [
  [/\b(dress|gown|frock)\b/i, 'dress'],
  [
    /\b(coat|parka|anorak|trench|puffer|raincoat|mac|overcoat|denim jacket|leather jacket|bomber|blazer)\b/i,
    'outerwear',
  ],
  [
    /\b(jeans|trousers|pants|skirt|shorts|chinos|leggings|joggers|culottes|slacks)\b/i,
    'bottom',
  ],
  [
    /\b(boots?|shoes?|trainers?|sneakers?|heels?|loafers?|sandals?|flats?|pumps?|clogs?)\b/i,
    'footwear',
  ],
  [/\b(bag|tote|backpack|purse|clutch|satchel|holdall)\b/i, 'bag'],
  [/\b(hat|cap|beanie|beret|headscarf)\b/i, 'headwear'],
  [/\b(necklace|earrings?|bracelet|ring|pendant|brooch)\b/i, 'jewelry'],
  [/\b(scarf|belt|gloves|tie|sunglasses|watch)\b/i, 'accessory'],
  [
    /\b(shirt|blouse|t-?shirt|tee|top|sweater|jumper|cardigan|hoodie|sweatshirt|fleece|vest|gilet|overshirt|shacket|pullover|knit|turtleneck|crewneck|polo|camisole|tank)\b/i,
    'top',
  ],
];

export type TypedGarment = {
  /** The sentence, trimmed and whitespace-collapsed. Never rewritten. */
  description: string;
  category: ItemCategory;
  /** The recognised noun, verbatim, or null when none was recognised. */
  subcategory: string | null;
  /** `[{hex, name}]`, the shape `items.colors` holds. Empty when unrecognised. */
  colors: { hex: string; name: string }[];
  /** The recognised colour word, for the caller's copy. Null when none was. */
  colourTerm: string | null;
};

/**
 * The shortest sentence that can become a piece.
 *
 * Three characters, the same floor the search field already enforces, so the
 * escape row is never available on a field the search itself would refuse —
 * a user cannot reach a state where Find is inert but filing is not.
 */
export const MIN_TYPED_LENGTH = 3;

export function canFileTypedWords(raw: string): boolean {
  return raw.trim().length >= MIN_TYPED_LENGTH;
}

/** Local, synchronous, and reachable with the radio off. */
export function normalizeTypedGarment(raw: string): TypedGarment {
  const description = raw.trim().replace(/\s+/g, ' ');

  let category: ItemCategory = 'other';
  let subcategory: string | null = null;
  for (const [re, cat] of CATEGORY_NOUNS) {
    const hit = re.exec(description);
    if (hit) {
      category = cat;
      subcategory = hit[0].toLowerCase();
      break;
    }
  }

  // Every word is offered to the colour lexicon rather than only the first:
  // "navy wool crewneck" and "crewneck in navy" are the same garment, and a
  // positional rule would understand one of them.
  let colourTerm: string | null = null;
  for (const word of description.toLowerCase().split(/[^a-z]+/).filter(Boolean)) {
    if (isKnownColourTerm(word)) {
      colourTerm = word;
      break;
    }
  }

  const colors = colourTerm
    ? [{ hex: resolveSpokenColour(colourTerm).hex, name: colourTerm }]
    : [];

  return { description, category, subcategory, colors, colourTerm };
}
