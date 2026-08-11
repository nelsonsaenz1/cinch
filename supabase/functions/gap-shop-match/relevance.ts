/**
 * Is this row actually the garment that was asked for?
 *
 * WHY A POST-FILTER EXISTS AT ALL
 *
 * Datafeedr's `name LIKE black dress` is AND-across-words, not a phrase match,
 * and it has no idea what a product IS. Measured against 2,558 recorded rows
 * from 82 curated apparel retailers, the query alone still returns:
 *
 *   "L'AGENCE Marguerite Coated Skinny Jean In Black Coated"   coat -> coatED
 *   "Lucky Brand Men's Navy Dress Pant"                        trousers, not a dress
 *   "Baby & Toddler Ice Cream Dress"                           ICE cream, not cream
 *   "Black Shoe Polish Cream 75ml Tube"                        polish, not shoes
 *   "Halston Satin Maxi Dress in Navy Scarf Print"             a dress, scarf-PRINTED
 *   "Black Clover Adjustable Hat"                              brand contains "black"
 *   "Necklace Bust Display Stand"                              furniture for a necklace
 *
 * Every one of those satisfies the query exactly. None of them is the garment.
 * The rows are already in hand by the time this runs, so filtering them costs
 * nothing extra — the metered request was spent at the query, not here.
 *
 * WHY IT IS A SEPARATE, PURE MODULE
 *
 * So it can be tested against recorded fixtures without a network or a Deno
 * runtime (`tests/slot-relevance.test.ts`), and so a slot cannot be switched on
 * in `index.ts` without a fixture that proves it survives this. See
 * `SLOT_QUERY`'s `verified` flag.
 *
 * WHAT THIS IS NOT
 *
 * Not a quality judgement and not a taste filter. It answers one question — is
 * the noun in this title the thing being sold, or a word about something else —
 * and nothing about price, brand, or how good the garment is. Ranking is
 * `score()`'s job and stays there.
 */

/** Mirrors `CatalogSlot`. Kept as a literal union rather than imported so this
 *  module has no dependencies at all and the Node test runner can read it. */
export type RelevanceSlot =
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
 * Words that, when they FOLLOW the slot's noun, mean the noun was describing
 * something else: "scarf print" is a pattern, "shoe polish" is a tin, "necklace
 * holder" is furniture, "handbag belt" is a strap. The noun is a modifier, not
 * the head of the phrase.
 *
 * This is the single highest-yield rule in the file — most surviving junk is of
 * exactly this shape, because a merchant writing "Black Handbag Belt Buckles"
 * genuinely is selling something related to a black handbag.
 */
const MODIFIER_FOLLOWERS = new Set([
  // representations of the thing rather than the thing
  'print', 'printed', 'pattern', 'patterned', 'style', 'graphic', 'motif', 'mockup', 'design',
  // furniture and storage FOR the thing
  'holder', 'stand', 'stands', 'organizer', 'organiser', 'display', 'rack', 'hook', 'hooks',
  'cabinet', 'box', 'tree', 'hanger', 'form', 'mannequin', 'bust', 'cupboard', 'bench', 'shelf',
  'storage', 'organization',
  // care products FOR the thing
  'polish', 'cleaner', 'protector', 'spray', 'brush', 'wax', 'shampoo', 'conditioner',
  // parts and trimmings OF the thing
  'charm', 'charms', 'clip', 'clips', 'buckle', 'buckles', 'strap', 'straps', 'pull', 'pulls',
  'insert', 'inserts', 'cord', 'cords', 'chain', 'chains', 'brim', 'liner', 'lining', 'patch',
  'button', 'buttons', 'zipper', 'fastener', 'fasteners', 'notion', 'notions', 'trim',
  'plate', 'plates', 'ornament', 'sole', 'heel', 'lace', 'laces',
  'string', 'strings', 'thread', 'wire', 'ribbon', 'elastic', 'bulk',
  // containers FOR the thing
  'bag', 'bags', 'case', 'cases', 'cover', 'covers', 'pouch', 'sleeve', 'carrier',
  // the thing as a topic
  'costume', 'accessory', 'accessories', 'kit',
]);

/**
 * Every garment noun the feed uses, grouped by the slot it belongs to.
 *
 * Grouping rather than one flat list is what makes the "is this a DIFFERENT
 * garment" test possible: `satchel` next to `bag` is the same thing said twice,
 * while `pant` next to `dress` is a different product wearing the word.
 *
 * `other` has no family on purpose — it is never searched.
 */
const SLOT_FAMILY: Record<RelevanceSlot, string[]> = {
  top: ['shirt', 'blouse', 'top', 'tee', 'sweater', 'cardigan', 'polo', 'knit', 'tank', 'jumper'],
  bottom: ['trouser', 'pant', 'jean', 'skirt', 'short', 'chino', 'legging', 'culotte'],
  outerwear: ['coat', 'jacket', 'blazer', 'parka', 'trench', 'overcoat', 'anorak'],
  footwear: ['shoe', 'boot', 'sneaker', 'loafer', 'sandal', 'heel', 'pump', 'flat', 'trainer'],
  dress: ['dress', 'gown', 'frock'],
  accessory: ['scarf', 'scarves', 'shawl', 'wrap', 'stole'],
  bag: ['handbag', 'bag', 'tote', 'satchel', 'clutch', 'purse', 'crossbody', 'backpack'],
  headwear: ['hat', 'cap', 'beanie', 'beret', 'fedora', 'visor'],
  jewelry: ['necklace', 'pendant', 'chain', 'choker', 'locket'],
};

/**
 * Garments that belong to no slot Cinch searches, but whose presence still
 * settles what a row is. "Boxer Brief 3-Pack Men's Underwear" is not a dress
 * however the words fall.
 */
const UNSLOTTED_GARMENTS = [
  'swimsuit', 'bodysuit', 'romper', 'jumpsuit', 'pajama', 'pyjama', 'underwear',
  'sock', 'brief', 'bra', 'glove', 'mitten', 'tie', 'belt', 'watch', 'earring', 'bracelet', 'ring',
  'bikini', 'swimwear', 'trunk', 'towel', 'blanket', 'pillow', 'rug', 'curtain',
];

/**
 * Whole-title refusals. A garment whose title says "costume" is not the coat
 * somebody's closet is missing, whatever else the row says.
 *
 * The children's terms are here because Cinch is a wardrobe for the person
 * holding the phone: a toddler's dress is never the answer to an adult's gap,
 * and merchant feeds mix the two freely inside one department.
 */
const REFUSED_ANYWHERE = [
  'costume', 'halloween', 'cosplay', 'mockup', 'party supplies',
  'ornament', 'figurine', 'wall art', 'decor',
  'baby', 'toddler', 'infant', 'newborn', 'kids', 'kid\'s', 'child', 'children',
  'girls', 'boys', 'youth', 'junior', 'juniors', 'nursery',
  'doll', 'pet ', 'dog ', 'cat ',
];

/**
 * Compounds in which a colour word is not a colour. "Ice Cream Dress" is a
 * toddler's frock printed with ice creams, and it satisfies `cream dress`
 * perfectly. There is no general rule here, only the handful of English
 * compounds that swallow a colour name — so the list is short and literal
 * rather than clever.
 */
const COLOUR_COMPOUNDS: Record<string, string[]> = {
  cream: ['ice cream', 'sour cream', 'cream cheese', 'shoe cream', 'hand cream', 'face cream'],
  black: ['black friday', 'black label', 'black clover', 'blackout'],
  navy: ['old navy', 'u.s. navy', 'us navy', 'navy seal', 'navy federal'],
  tan: ['tan lines'],
  rose: ['rose gold', 'rose water'],
  olive: ['olive oil'],
  camel: ['camel toe'],
};

/** Lowercase, strip punctuation to spaces, collapse runs. Word order is kept —
 *  this function is entirely about which word sits next to which. */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export type Refusal =
  | 'noun_absent'
  | 'noun_is_modifier'
  | 'other_garment'
  | 'refused_term'
  | 'colour_absent'
  | 'colour_in_compound'
  | 'colour_only_in_brand';

export type Verdict = { admitted: true } | { admitted: false; reason: Refusal };

/** Both spellings of a noun, so `shoe`/`shoes` and `scarf`/`scarves` are one
 *  concept. Irregulars are listed in SLOT_FAMILY rather than derived. */
function forms(noun: string): string[] {
  const singular = noun.endsWith('s') ? noun.slice(0, -1) : noun;
  return [singular, `${singular}s`, `${singular}es`];
}

/**
 * Decide whether one row is the garment the slot asked for.
 *
 * `noun` is the word the query was built from, so it is present in every row by
 * construction — what this checks is whether it is present as the THING.
 */
export function admitProduct(
  title: string,
  opts: { slot: RelevanceSlot; noun: string; colour?: string | null; brand?: string | null },
): Verdict {
  const words = tokenise(title);
  const flat = ` ${words.join(' ')} `;

  for (const term of REFUSED_ANYWHERE) {
    if (flat.includes(` ${term.trim()} `) || flat.includes(term)) {
      return { admitted: false, reason: 'refused_term' };
    }
  }

  // Our own family never counts as foreign: "Satchel Bag" is one product said
  // twice, and refusing it would empty the bag slot for no reason.
  const own = new Set(SLOT_FAMILY[opts.slot].flatMap(forms));
  const foreign = new Set(
    [
      ...Object.entries(SLOT_FAMILY)
        .filter(([s]) => s !== opts.slot)
        .flatMap(([, nouns]) => nouns),
      ...UNSLOTTED_GARMENTS,
    ]
      .flatMap(forms)
      .filter((w) => !own.has(w)),
  );

  /** Is the word at `i` the head of its phrase, or a modifier of what follows? */
  const isHead = (i: number): boolean => {
    const next = words[i + 1];
    if (next === undefined) return true; // nothing follows to demote it
    if (MODIFIER_FOLLOWERS.has(next)) return false;
    if (foreign.has(next)) return false;
    return true;
  };

  // ── The row must not claim to be a DIFFERENT garment ──────────────────────
  //
  // This is the rule that separates "Halter Scarf Top" from a scarf and "Navy
  // Dress Pant" from a dress. A title carrying another slot's noun in head
  // position is describing that other garment, whichever word came first.
  //
  // It costs some true positives — "Scarf Coat", "Hat and Scarf Set" are real
  // garments refused for naming two things. That trade is deliberate and it is
  // the same one C-01 already makes: an absent row is a shape the surface knows
  // how to render, and a wrong one is not.
  for (let i = 0; i < words.length; i += 1) {
    if (foreign.has(words[i]) && isHead(i)) {
      return { admitted: false, reason: 'other_garment' };
    }
  }

  // ── The noun must appear as a WHOLE word, and as a head ────────────────────
  //
  // Whole-word is what separates `coat` from `coated`, which was three of the
  // nine slots' top result on its own.
  const isNoun = (w: string) => forms(opts.noun.toLowerCase()).includes(w);

  let sawNoun = false;
  let sawHead = false;
  for (let i = 0; i < words.length; i += 1) {
    if (!isNoun(words[i])) continue;
    sawNoun = true;
    if (isHead(i)) {
      sawHead = true;
      break;
    }
  }

  if (!sawNoun) return { admitted: false, reason: 'noun_absent' };
  if (!sawHead) return { admitted: false, reason: 'noun_is_modifier' };

  // ── The colour must be a colour ────────────────────────────────────────────
  if (opts.colour) {
    const colour = opts.colour.toLowerCase();
    const compounds = COLOUR_COMPOUNDS[colour] ?? [];

    // Blank out every compound occurrence, then ask whether any colour word is
    // left. "Black Clover Land Of The Free Black Hat" keeps its second `black`
    // and is admitted; "Black Clover Adjustable Hat" does not and is refused.
    let remaining = flat;
    for (const compound of compounds) remaining = remaining.split(compound).join(' ');
    if (!remaining.includes(` ${colour} `)) {
      return {
        admitted: false,
        reason: compounds.some((c) => flat.includes(c)) ? 'colour_in_compound' : 'colour_absent',
      };
    }

    // A brand whose NAME carries the colour is not a garment in that colour.
    // Checked last because it is the narrowest case and the most expensive to
    // get wrong: "Black Clover" the brand versus a black Clover-brand hat.
    if (opts.brand) {
      const brandWords = tokenise(opts.brand);
      if (brandWords.includes(colour)) {
        const outsideBrand = words.filter((w) => w === colour).length;
        const insideBrand = brandWords.filter((w) => w === colour).length;
        if (outsideBrand <= insideBrand) {
          return { admitted: false, reason: 'colour_only_in_brand' };
        }
      }
    }
  }

  return { admitted: true };
}

export const __testables = {
  MODIFIER_FOLLOWERS,
  SLOT_FAMILY,
  UNSLOTTED_GARMENTS,
  REFUSED_ANYWHERE,
  COLOUR_COMPOUNDS,
  tokenise,
};
