/**
 * What the tagger says, checked against what it is allowed to say.
 *
 * ── Why instructions were not enough ───────────────────────────────────────
 *
 * `TAG_SYSTEM_PROMPT` already tells the model most of these rules, at length
 * and in capitals: a solid garment cannot have a print scale, a boot is
 * footwear whatever the fabric looks like, leather is not water resistant.
 * Those paragraphs exist because each of them was got wrong in production.
 *
 * A rule in a prompt is a request. The same rule here is a fact about what can
 * reach the database, and the difference matters most exactly where the prompt
 * is longest — a model that ignored three sentences about categories is not
 * going to be persuaded by a fourth.
 *
 * ── The three things this file does ────────────────────────────────────────
 *
 *   REJECTS what is contradictory rather than clamping it. `normalizeTags`
 *   clamps, and clamping is right for a formality of 7 — the intent is legible.
 *   A tote filed as a top is not a value out of range, it is a wrong answer,
 *   and quietly coercing it would file somebody's handbag as a shirt.
 *
 *   REFUSES A BRAND THAT NOTHING SUPPORTS. This is the biggest change. A vision
 *   model reading a logo it cannot see writes a plausible maker's name onto a
 *   garment somebody owns, and it is the single field where a confident wrong
 *   answer is least recoverable — brands drive catalogue search, resale value
 *   and the person's own sense of their wardrobe. Brand now requires evidence:
 *   OCR (Packet 5, native), a catalogue match, or the user typing it.
 *
 *   WRITES THE DESCRIPTION ITSELF, from fields that survived validation, rather
 *   than asking for prose. Prose is where invented detail lives — "with contrast
 *   stitching and a half-belt" is unfalsifiable and arrives in the same sentence
 *   as the true parts.
 */

import {
  CATEGORIES,
  FITS,
  OCCASIONS,
  PATTERN_SCALES,
  SEASONS,
  type TagResult,
} from './tag-schema.ts';

// ---------------------------------------------------------------------------
// Where evidence for a brand can come from
// ---------------------------------------------------------------------------

/**
 * The only three things that make a brand claim admissible.
 *
 * `'model'` is deliberately absent. A vision model's brand guess is exactly the
 * confident invention this validator exists to stop, and there is no threshold
 * at which it becomes evidence — a logo it can actually read is a logo OCR can
 * read, which is `'ocr'`.
 */
export type BrandEvidence = 'ocr' | 'catalogue' | 'user';

export type ValidationContext = {
  /** A brand the user typed. Outranks everything, including a catalogue match. */
  userBrand?: string | null;
  /** Text OCR lifted from a visible label. Native; absent until Packet 5. */
  ocrText?: string | null;
  /** Brands a bounded catalogue lookup returned for this photo. */
  catalogueBrands?: readonly string[];
};

// ---------------------------------------------------------------------------
// Category / subcategory compatibility
// ---------------------------------------------------------------------------

/**
 * Words that settle a category on their own.
 *
 * Read as "where on the body does this go" — the prompt's own framing, made
 * enforceable. A subcategory containing "tote" is a bag no matter what the
 * model wrote in `category`, and the disagreement is a rejection rather than a
 * silent correction, because the two fields disagreeing means the answer was
 * not read off the photograph.
 */
const SUBCATEGORY_MARKERS: [RegExp, (typeof CATEGORIES)[number]][] = [
  [/\b(boot|shoe|loafer|sneaker|trainer|heel|pump|sandal|clog|mule|espadrille|brogue)s?\b/i, 'footwear'],
  [/\b(bag|tote|clutch|crossbody|backpack|satchel|purse|handbag)s?\b/i, 'bag'],
  [/\b(hat|cap|beanie|beret|fedora|visor)s?\b/i, 'headwear'],
  [/\b(necklace|bracelet|earring|ring|pendant|chain|choker)s?\b/i, 'jewelry'],
  [/\b(dress|gown|jumpsuit|romper)e?s?\b/i, 'dress'],
  [/\b(coat|jacket|blazer|parka|trench|overcoat|anorak|gilet)s?\b/i, 'outerwear'],
  [/\b(trouser|pant|jean|skirt|short|chino|legging|culotte|jogger)s?\b/i, 'bottom'],
  [/\b(shirt|tee|t.shirt|blouse|top|sweater|cardigan|jumper|hoodie|polo|tank|knit)s?\b/i, 'top'],
];

/** The category a subcategory implies, or null when it implies nothing. */
export function categoryFromSubcategory(
  subcategory: string,
): (typeof CATEGORIES)[number] | null {
  for (const [re, category] of SUBCATEGORY_MARKERS) {
    if (re.test(subcategory)) return category;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Water resistance
// ---------------------------------------------------------------------------

/**
 * Materials and cuts that can genuinely repel water, and the ones that cannot.
 *
 * The prompt already says leather and wool are not water resistant. This is
 * that sentence with teeth: `waterResistant: true` needs a supporting word in
 * the material or subcategory, and a claim without one is a contradiction
 * rather than a judgement call.
 */
const WATERPROOF_EVIDENCE =
  /\b(rain|waterproof|water.resistant|waxed|gore.?tex|shell|slicker|wellington|rubber|nylon|puffer|anorak|windbreaker|oilskin|neoprene|pvc|vinyl)\b/i;

/** Materials that specifically CANNOT be water resistant, whatever they look like. */
const NOT_WATERPROOF = /\b(wool|cashmere|linen|cotton|silk|suede|denim|merino|velvet|tweed|jersey|knit)\b/i;

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

export type ValidationFailure =
  | 'category_subcategory_conflict'
  | 'pattern_scale_contradiction'
  | 'water_resistance_unsupported'
  | 'enum_violation'
  | 'score_out_of_range'
  | 'empty_subcategory';

export type ValidationOutcome =
  | { ok: true; tags: TagResult; brandEvidence: BrandEvidence | null }
  | { ok: false; failures: ValidationFailure[] };

const isSolid = (pattern: string | null): boolean =>
  pattern === null || /^\s*(solid|plain|none)\s*$/i.test(pattern);

/**
 * Resolve the brand, or drop it.
 *
 * Precedence is fixed and the plan states it: a user correction outranks OCR,
 * OCR outranks a catalogue match, and a model's unsupported guess loses to all
 * three by being discarded rather than ranked.
 */
export function resolveBrand(
  modelBrand: string | null,
  ctx: ValidationContext,
): { brand: string | null; evidence: BrandEvidence | null } {
  const typed = ctx.userBrand?.trim();
  if (typed) return { brand: typed, evidence: 'user' };

  const claim = modelBrand?.trim();
  if (!claim) return { brand: null, evidence: null };

  // OCR read the label. Substring rather than equality: a label reads
  // "JAMES PERSE LOS ANGELES" and the brand is the part we recognise.
  const ocr = ctx.ocrText?.trim();
  if (ocr && ocr.toLowerCase().includes(claim.toLowerCase())) {
    return { brand: claim, evidence: 'ocr' };
  }

  const catalogue = ctx.catalogueBrands ?? [];
  if (catalogue.some((b) => b.toLowerCase() === claim.toLowerCase())) {
    return { brand: claim, evidence: 'catalogue' };
  }

  // Nothing supports it. Not a failure — the garment is fine, the claim is not
  // — so the field is emptied and the user can type it if they know it.
  return { brand: null, evidence: null };
}

/**
 * Check everything, and say what failed rather than what it thinks instead.
 *
 * Returns ALL failures rather than the first: a caller deciding whether to
 * spend a rescue call wants to know if one field slipped or the whole answer is
 * incoherent, and a single failure code cannot tell those apart.
 */
export function validateTags(raw: TagResult, ctx: ValidationContext = {}): ValidationOutcome {
  const failures: ValidationFailure[] = [];

  const subcategory = (raw.subcategory ?? '').trim();
  if (!subcategory) failures.push('empty_subcategory');

  if (!(CATEGORIES as readonly string[]).includes(raw.category)) {
    failures.push('enum_violation');
  }
  if (!(FITS as readonly string[]).includes(raw.fit)) failures.push('enum_violation');
  if (!(PATTERN_SCALES as readonly string[]).includes(raw.patternScale)) {
    failures.push('enum_violation');
  }
  if ((raw.seasons ?? []).some((s) => !(SEASONS as readonly string[]).includes(s))) {
    failures.push('enum_violation');
  }
  if ((raw.occasions ?? []).some((o) => !(OCCASIONS as readonly string[]).includes(o))) {
    failures.push('enum_violation');
  }

  for (const score of [raw.formalityScore, raw.warmthScore]) {
    if (!Number.isFinite(score) || score < 1 || score > 5 || !Number.isInteger(score)) {
      failures.push('score_out_of_range');
    }
  }

  // The one the prompt spends a paragraph on. A subcategory that names a boot
  // while the category says top is not a near miss.
  const implied = categoryFromSubcategory(subcategory);
  if (implied && implied !== raw.category) failures.push('category_subcategory_conflict');

  // A solid garment has no print, so it cannot have a print size.
  if (isSolid(raw.pattern) && raw.patternScale !== 'none') {
    failures.push('pattern_scale_contradiction');
  }
  // And a printed garment with no scale is the same contradiction, mirrored.
  if (!isSolid(raw.pattern) && raw.patternScale === 'none') {
    failures.push('pattern_scale_contradiction');
  }

  if (raw.waterResistant) {
    const haystack = `${raw.material ?? ''} ${subcategory}`;
    const supported = WATERPROOF_EVIDENCE.test(haystack);
    const contradicted = NOT_WATERPROOF.test(haystack) && !supported;
    if (!supported || contradicted) failures.push('water_resistance_unsupported');
  }

  if (failures.length) return { ok: false, failures: [...new Set(failures)] };

  const { brand, evidence } = resolveBrand(raw.brand, ctx);

  return {
    ok: true,
    brandEvidence: evidence,
    tags: {
      ...raw,
      subcategory,
      brand,
      // Written here, from what survived. See `describeGarment`.
      description: describeGarment({ ...raw, subcategory, brand }),
    },
  };
}

// ---------------------------------------------------------------------------
// The description
// ---------------------------------------------------------------------------

const FORMALITY_WORD: Record<number, string> = {
  1: 'relaxed',
  2: 'casual',
  3: 'smart-casual',
  4: 'dressy',
  5: 'formal',
};

const cap = (s: string) => (s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * One sentence, assembled from fields that passed.
 *
 * The model used to write this, and the prompt's last paragraph is a plea not
 * to invent belt loops and contrast stitching. It is a plea because prose is
 * the one output no schema can constrain: every other field is an enum or a
 * number, and this was a free string printed on the user's own garment.
 *
 * Assembling it costs a little voice and buys the guarantee that every clause
 * corresponds to a validated field. A field that is absent removes its clause
 * rather than being filled in.
 */
export function describeGarment(tags: TagResult): string {
  const parts: string[] = [];

  const colour = tags.colorNames?.[0]?.trim();
  const pattern = isSolid(tags.pattern) ? null : tags.pattern?.trim();
  const material = tags.material?.trim();

  // "Navy striped wool blazer" — colour, print, material, thing.
  const noun = [colour, pattern, material, tags.subcategory.trim()]
    .filter(Boolean)
    .join(' ');
  parts.push(cap(noun));

  if (tags.brand) parts.push(`by ${tags.brand}`);

  const register = FORMALITY_WORD[tags.formalityScore];
  if (register) parts.push(`— ${register}`);

  const occasions = (tags.occasions ?? []).slice(0, 2);
  if (occasions.length) parts.push(`for ${occasions.join(' or ')}`);

  return `${parts.join(' ').replace(/\s+/g, ' ').trim()}.`;
}
