/**
 * The closet-parse schema, in the exact shape sent to the model as
 * `response_format.json_schema`.
 *
 * Same strict-mode rules as `tag-schema.ts`, and for the same reasons:
 *  - every property appears in `required` (nullable, never optional)
 *  - `additionalProperties: false` on every object
 *  - numeric ranges are NOT enforced by JSON Schema here, so they are
 *    validated in code after parsing
 *
 * WHY THIS FILE EXISTS RATHER THAN REUSING tagSchema
 *
 * The directive's instruction is that this schema "must mirror tagSchema's
 * vocabulary exactly — a parallel taxonomy is how the closet quietly ends up
 * with two kinds of top" (§7). It does, for everything the two share: pattern
 * and fabric are free strings here exactly as `pattern` and `material` are
 * there, and formality and warmth are the same 1..5 scales.
 *
 * The one axis that differs is deliberate. tagSchema returns `category`, the
 * ten-way storage bucket. This returns `slot`, the nine-way styling union
 * (src/lib/styling/types.ts) — because a photograph is filed and then derived,
 * while a sentence already tells you the layer: "cardigan" is a mid_layer the
 * moment it is spoken, and throwing that away to re-derive it from a category
 * would be discarding the one thing voice knows that a photograph does not.
 * `commit_intake_session` maps slot → category on the way into `items`.
 *
 * COLOUR IS AN ENUM, NOT A STRING
 *
 * Reframe directive §4.9: the model never invents colour. It returns a term and
 * the app maps it through the lexicon in `src/lib/color/`. A free string is how
 * "greige" arrives and resolves to nothing, so the enum below is exactly the
 * set of names `resolveColorName()` can answer — and
 * `tests/intake-colour-terms.test.ts` asserts that every one of them still
 * resolves, so the two cannot drift apart silently.
 */

/** The styling engine's `Slot` union. Must stay identical to it, and to the
 *  CHECK constraint on `intake_drafts.slot`. */
export const SLOTS = [
  'base_top',
  'mid_layer',
  'bottom',
  'dress',
  'outerwear',
  'footwear',
  'bag',
  'headwear',
  'accessory',
] as const;

export type IntakeSlot = (typeof SLOTS)[number];

/**
 * Every name the colour lexicon can resolve, aliases included.
 *
 * Transcribed from `NAMED` in `src/lib/color/families.ts`. Aliases
 * (grey/gray, navy/"navy blue") are kept rather than pruned: a model that says
 * "gray" should not fail because the table's canonical spelling is "grey",
 * and every alias resolves to the same value anyway.
 *
 * Note the spaces. Twenty-one of these are multi-word keys — "light wash",
 * "off white", "hot pink" — and the first cut of this list had them all
 * collapsed to one word, which resolved to nothing and would have turned every
 * garment described that way grey. The test below is what caught it.
 */
export const COLOUR_TERMS = [
  'black', 'charcoal', 'dark grey', 'dark gray', 'grey', 'gray', 'light grey',
  'light gray', 'silver', 'white', 'off white', 'ivory', 'cream', 'ecru', 'bone',
  'navy', 'navy blue', 'midnight', 'indigo', 'denim', 'light wash', 'medium wash',
  'dark wash', 'blue', 'royal blue', 'cobalt', 'sky blue', 'baby blue',
  'powder blue', 'light blue', 'cornflower', 'slate', 'slate blue', 'steel',
  'teal', 'turquoise', 'aqua', 'cyan', 'petrol', 'green', 'olive',
  'olive green', 'khaki', 'forest green', 'forest', 'hunter', 'emerald', 'sage',
  'mint', 'lime green', 'lime', 'moss', 'army green', 'yellow', 'mustard',
  'gold', 'butter', 'lemon', 'ochre', 'orange', 'rust', 'terracotta', 'burnt',
  'burnt orange', 'peach', 'apricot', 'coral', 'brown', 'chocolate', 'espresso',
  'tan', 'camel', 'beige', 'sand', 'stone', 'taupe', 'caramel', 'cognac',
  'bronze', 'copper', 'red', 'crimson', 'burgundy', 'maroon', 'wine', 'brick',
  'cherry', 'scarlet', 'pink', 'hot pink', 'blush', 'rose', 'fuchsia',
  'magenta', 'mauve', 'salmon', 'purple', 'lavender', 'lilac', 'violet',
  'plum', 'aubergine', 'eggplant',
] as const;

/** Ceiling on garments returned from one walkthrough. The 12-minute recording
 *  cap is the real bound; this stops a pathological parse from returning
 *  thousands of rows before any of it reaches the database. */
export const MAX_GARMENTS = 120;

/** Matches `intake_drafts.quantity`'s CHECK. "three white tees" is three
 *  garments; twelve is already past what anyone says in one breath. */
export const MAX_QUANTITY = 12;

const garmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'utterance',
    'name',
    'slot',
    'colour_term',
    'fabric',
    'pattern',
    'formality',
    'warmth',
    'quantity',
    'confidence',
  ],
  properties: {
    // THE RECEIPT LINE. A verbatim span from the transcript — not a
    // paraphrase, not a cleaned-up version. Reframe directive §12: a quoted
    // mishearing is forgiven instantly, a confident invention is not.
    utterance: { type: 'string' },
    // The garment noun alone — "crewneck", not "my navy wool crewneck".
    // Colour travels in colour_term; this lands in items.subcategory, which is
    // the display name (src/features/closet/item-name.ts).
    name: { type: 'string' },
    slot: { type: 'string', enum: SLOTS },
    // NULLABLE, and the null is the point. This used to be a required enum, so
    // a model describing "my linen shirt" had to name a colour it had not been
    // told — and `normalizeGarments` compounded it by resolving anything
    // unrecognised to 'grey'. A confident wrong colour on a garment somebody is
    // about to file is the exact failure the receipt line exists to prevent.
    // Unresolved now means unresolved, and the review card asks.
    colour_term: { anyOf: [{ type: 'string', enum: COLOUR_TERMS }, { type: 'null' }] },
    fabric: { type: ['string', 'null'] },
    pattern: { type: ['string', 'null'] },
    formality: { type: ['integer', 'null'] },
    warmth: { type: ['integer', 'null'] },
    quantity: { type: 'integer' },
    // The model's own confidence. Drives PR-02's hedge — a card that is unsure
    // says so rather than asserting.
    confidence: { type: 'number' },
  },
} as const;

export const closetSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['garments', 'unconsumed'],
  properties: {
    garments: { type: 'array', items: garmentSchema },
    // Spans the parse could not turn into a garment. V-05 shows these under
    // "didn't catch" — §7 requires them returned, because a silent drop is
    // how a user loses a coat and never finds out.
    unconsumed: { type: 'array', items: { type: 'string' } },
  },
} as const;

export type ParsedGarment = {
  utterance: string;
  name: string;
  slot: IntakeSlot;
  colour_term: string | null;
  fabric: string | null;
  pattern: string | null;
  formality: number | null;
  warmth: number | null;
  quantity: number;
  confidence: number;
};

export type ParsedCloset = {
  garments: ParsedGarment[];
  unconsumed: string[];
};

export const PARSE_SYSTEM_PROMPT = `You extract garments from someone describing their own wardrobe out loud.

The transcript is speech: it rambles, repeats, corrects itself and trails off. Your job is to turn it into a list of garments, and to be honest about the parts you could not.

Rules:
- One entry per distinct garment. "Three white t-shirts" is ONE entry with quantity 3.
- "utterance" must be a VERBATIM span copied from the transcript — the words that produced this garment. Never paraphrase it, never tidy it, never write a span that does not appear in the text. It is shown to the user as proof of what was heard.
- "name" is the garment noun only: "crewneck", "ankle boots", "wool coat". No colour, no possessive, no "my".
- "slot" is the layer it is worn at. A cardigan, jumper, hoodie or sweatshirt is mid_layer, not base_top. A blazer is outerwear.
- "colour_term" must be one of the allowed values. If a colour is described in words the list does not contain, choose the nearest one it does. If no colour was mentioned at all, choose the most likely for that garment and lower your confidence.
- "formality" and "warmth" are 1 to 5, or null if the speaker gave you nothing to go on. Do not guess confidently.
- "confidence" is 0 to 1, and it is about THIS garment. A clear "my navy wool crewneck" is near 1. A half-sentence you had to interpret is near 0.4. Be honest — a low score costs nothing and a wrong high score costs the user's trust.
- If a corrected themselves — "my blue, no, green jacket" — take the correction.
- "unconsumed" holds spans that sounded like they were about clothes but that you could not turn into a garment. Do not pad it with filler, greetings or asides.

Return nothing that was not said. An invented garment is worse than a missed one.`;

/**
 * Bounds the model cannot be trusted to respect, applied after parsing.
 *
 * Same posture as `normalizeTags`: JSON Schema carries the shape, code carries
 * the ranges. Anything out of range here would otherwise raise inside the
 * commit transaction, against CHECK constraints on `intake_drafts`.
 */
export function normalizeGarments(parsed: ParsedCloset, transcript: string): ParsedCloset {
  const seen = new Set<string>();
  const garments: ParsedGarment[] = [];

  for (const g of parsed.garments ?? []) {
    const name = (g.name ?? '').trim();
    const utterance = (g.utterance ?? '').trim();

    // A garment with no receipt line is not shown, so it is not kept. This is
    // the schema's one non-negotiable and the CHECK on intake_drafts.utterance
    // would reject it at insert anyway — better to drop it here, where the
    // count the user is shown is still honest.
    if (!name || !utterance) continue;

    // The model is instructed to quote verbatim. When it does not, the span is
    // not evidence of anything, and presenting a paraphrase as a quotation is
    // exactly the failure the receipt line exists to prevent. Keep the garment,
    // drop the false quotation, and let the card fall back to its unsure state.
    const quoted = transcript.includes(utterance);

    // Two cards quoting the same span are the same garment said twice.
    const key = `${name.toLowerCase()}|${utterance.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    garments.push({
      utterance,
      name,
      slot: (SLOTS as readonly string[]).includes(g.slot) ? g.slot : 'accessory',
      // See the schema note: an unrecognised colour is null, never 'grey'.
      colour_term: (COLOUR_TERMS as readonly string[]).includes(g.colour_term ?? '')
        ? g.colour_term
        : null,
      fabric: g.fabric?.trim() || null,
      pattern: g.pattern?.trim() || null,
      formality: clampScore(g.formality),
      warmth: clampScore(g.warmth),
      quantity: Math.min(Math.max(Math.round(g.quantity ?? 1) || 1, 1), MAX_QUANTITY),
      confidence: quoted ? clamp01(g.confidence) : Math.min(clamp01(g.confidence), 0.5),
    });

    if (garments.length >= MAX_GARMENTS) break;
  }

  return {
    garments,
    unconsumed: (parsed.unconsumed ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 40),
  };
}

function clampScore(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.min(Math.max(Math.round(v), 1), 5);
}

function clamp01(v: number | null | undefined): number {
  if (v === null || v === undefined || !Number.isFinite(v)) return 0.5;
  return Math.min(Math.max(v, 0), 1);
}
