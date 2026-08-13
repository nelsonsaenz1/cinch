/**
 * A spoken wardrobe, parsed without asking anybody's opinion.
 *
 * ── What this replaces, and why the replacement is safer ───────────────────
 *
 * `parse-closet` sent every transcript to a model, whole. That was defensible
 * when the alternative was nothing, but most of what people say when they walk
 * a closet is not ambiguous at all — "three white t-shirts, a navy wool
 * cardigan, black jeans" is a list, and a list is a parsing problem with a
 * fixed vocabulary on both sides. The lexicons this file reads are the SAME
 * ones the catalogue matcher already searches with, so a garment named here and
 * a garment searched for there cannot drift apart.
 *
 * The model still exists, for the spans this cannot place. What changed is that
 * it is asked about a phrase rather than about a wardrobe.
 *
 * ── The rule that governs every field ──────────────────────────────────────
 *
 * NEVER INVENT AN ABSENT VALUE. `normalizeGarments` used to resolve an
 * unrecognised colour to `'grey'` — a silent, confident guess, applied to a
 * garment the user is about to file. Somebody says "my linen shirt", the card
 * says grey, and they either notice or own a grey shirt they do not have. Here
 * an unresolved colour is `null` and the review card asks. That is one more tap
 * and no lie.
 *
 * ── Receipts ───────────────────────────────────────────────────────────────
 *
 * Every garment carries a VERBATIM span from the transcript, sliced by offset
 * rather than reconstructed, so `transcript.includes(utterance)` is true by
 * construction and not by good behaviour. A parser that assembled its own
 * quotation would be doing the exact thing the receipt line exists to catch.
 */

import {
  CLASS_NOUNS,
  MATERIAL_TERMS,
  type GarmentClass,
} from './garment-lexicon.ts';
import {
  COLOUR_TERMS,
  MAX_GARMENTS,
  MAX_QUANTITY,
  SLOTS,
  type IntakeSlot,
  type ParsedGarment,
} from './intake-schema.ts';

// ---------------------------------------------------------------------------
// Vocabularies — all fixed, all shared, none of them derived at call time
// ---------------------------------------------------------------------------

/**
 * A garment class is not a slot, and the difference matters to the scorer.
 *
 * `CLASS_NOUNS` groups by what a thing IS; the styling engine slots by what a
 * thing DOES in an outfit. A cardigan and a t-shirt are both `top`, but one is
 * worn over the other and the beam search must not stack two base layers.
 */
const CLASS_TO_SLOT: Record<GarmentClass, IntakeSlot> = {
  top: 'base_top',
  bottom: 'bottom',
  outerwear: 'outerwear',
  footwear: 'footwear',
  dress: 'dress',
  accessory: 'accessory',
  bag: 'bag',
  headwear: 'headwear',
  // The engine has no jewelry slot. Accessory is where it already lives.
  jewelry: 'accessory',
};

/** Tops that are worn OVER another top. Overrides the class mapping above. */
const MID_LAYER_NOUNS = new Set([
  'sweater', 'cardigan', 'jumper', 'knit', 'hoodie', 'sweatshirt', 'fleece',
]);

/**
 * Spoken numbers, in the order they are tested.
 *
 * ARTICLES LAST, and that ordering is load-bearing: "a couple of shirts" begins
 * with "a", and testing the article first read it as one shirt. An article only
 * means "one" when no actual quantity word is present.
 */
const NUMBER_WORDS: [string, number][] = [
  ['twelve', 12], ['eleven', 11], ['couple', 2], ['three', 3], ['seven', 7],
  ['eight', 8], ['four', 4], ['five', 5], ['nine', 9], ['pair', 1], ['two', 2],
  ['six', 6], ['ten', 10], ['few', 3], ['one', 1], ['an', 1], ['a', 1],
];

/** Patterns somebody says out loud. Deliberately short — see `pattern` below. */
const PATTERN_TERMS = [
  'striped', 'stripe', 'checked', 'check', 'plaid', 'tartan', 'floral',
  'polka dot', 'dotted', 'houndstooth', 'herringbone', 'leopard', 'animal print',
  'camo', 'camouflage', 'paisley', 'gingham', 'argyle', 'pinstripe',
];

/**
 * The words that end one garment and begin the next.
 *
 * `and` is here and `with` is not, deliberately: "a navy blazer and grey
 * trousers" is two garments, "a navy blazer with gold buttons" is one. The
 * split is conservative — an over-split produces two cards the user can merge
 * by deleting one, while an under-split loses a garment silently, and §7's
 * whole posture is that a silent drop is the unforgivable one.
 */
const SPLIT_WORDS = /\b(?:and then|and also|and|plus|also)\b/gi;

/**
 * A correction, spoken.
 *
 * People correct themselves constantly when reading a closet aloud, and the
 * correction almost always follows the mistake immediately. Anything matching
 * this replaces the garment before it rather than adding one.
 */
const CORRECTION_PREFIX =
  /^\s*(?:no|nope|sorry|wait|actually|i mean|i meant|scratch that|rather)\b[,\s]*/i;

/** Phrases that point at something already said. Only the model can resolve these. */
const RELATIVE_MARKERS =
  /\b(?:same|another|the other|that one|those|these|it|them|as before|like that|matching)\b/i;

/** Speech that stopped mid-thought. Not a garment; not an error either. */
const UNFINISHED = /\b(?:um+|uh+|erm+|and then|also)\s*$/i;

// Longest-first, so "light blue" is found before "blue" and "t shirt" before
// "shirt". Built once at module load.
const byLengthDesc = (a: string, b: string) => b.length - a.length || a.localeCompare(b);

const COLOUR_SORTED = [...COLOUR_TERMS].sort(byLengthDesc);
const MATERIAL_SORTED = [...MATERIAL_TERMS].sort(byLengthDesc);
const PATTERN_SORTED = [...PATTERN_TERMS].sort(byLengthDesc);

const NOUN_TO_CLASS: ReadonlyMap<string, GarmentClass> = (() => {
  const map = new Map<string, GarmentClass>();
  for (const [klass, nouns] of Object.entries(CLASS_NOUNS) as [GarmentClass, readonly string[]][]) {
    for (const noun of nouns) map.set(noun, klass);
  }
  return map;
})();

const NOUNS_SORTED = [...NOUN_TO_CLASS.keys()].sort(byLengthDesc);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedSpan = {
  /** Verbatim, sliced from the transcript by offset. */
  text: string;
  start: number;
  end: number;
};

export type DeterministicParse = {
  /** Garments the lexicons placed outright. `colour_term` may be null. */
  garments: ParsedGarment[];
  /**
   * Spans with no recognised garment noun at all. Shown under "didn't catch",
   * and NOT sent anywhere — a span nothing recognised is usually a false start.
   */
  unconsumed: string[];
  /**
   * Spans that look like a garment but need something this cannot do: a
   * relative reference, or a noun outside the lexicon. THESE, and only these,
   * are what the model is asked about.
   */
  ambiguous: string[];
};

// ---------------------------------------------------------------------------
// Clause splitting — offsets preserved throughout
// ---------------------------------------------------------------------------

/**
 * Cut the transcript into clauses, keeping every offset.
 *
 * Punctuation first, then conjunctions inside what is left. Offsets are carried
 * so the receipt line can be `transcript.slice(start, end)` — the only way to
 * guarantee a quotation is real.
 */
export function splitClauses(transcript: string): ParsedSpan[] {
  const spans: ParsedSpan[] = [];

  const pushTrimmed = (start: number, end: number) => {
    let s = start;
    let e = end;
    while (s < e && /[\s,.;!?]/.test(transcript[s]!)) s += 1;
    while (e > s && /[\s,.;!?]/.test(transcript[e - 1]!)) e -= 1;
    if (e > s) spans.push({ text: transcript.slice(s, e), start: s, end: e });
  };

  // Sentence-level first.
  const sentences: [number, number][] = [];
  let cursor = 0;
  const punctuation = /[,.;!?]/g;
  let m: RegExpExecArray | null;
  while ((m = punctuation.exec(transcript)) !== null) {
    sentences.push([cursor, m.index]);
    cursor = m.index + 1;
  }
  sentences.push([cursor, transcript.length]);

  for (const [start, end] of sentences) {
    const chunk = transcript.slice(start, end);
    if (!chunk.trim()) continue;

    // Then conjunctions inside the sentence.
    SPLIT_WORDS.lastIndex = 0;
    let last = 0;
    let hit: RegExpExecArray | null;
    while ((hit = SPLIT_WORDS.exec(chunk)) !== null) {
      pushTrimmed(start + last, start + hit.index);
      last = hit.index + hit[0].length;
    }
    pushTrimmed(start + last, end);
  }

  return spans;
}

// ---------------------------------------------------------------------------
// Field extraction — each one returns null rather than a guess
// ---------------------------------------------------------------------------

/** Whole-word match at a word boundary, case-insensitive. */
function findTerm(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i').test(haystack);
}

/**
 * The same, but a noun may be plural.
 *
 * `CLASS_NOUNS` is written in the singular because it is a SEARCH vocabulary —
 * the catalogue matcher stems queries before it uses it. Somebody reading their
 * closet aloud says "jeans", "boots", "three t-shirts", and matching those
 * against `jean`, `boot`, `t shirt` needs the suffix. Without it every plural
 * garment fell through to the ambiguous pile and bought a model call to be told
 * a shirt is a shirt — which is exactly what the fixtures caught.
 *
 * Deliberately only `s` and `es`: an irregular plural that matters here
 * ("scarves") is already listed in the lexicon as its own entry, and inventing
 * a stemmer would put guessing back into the one file built not to guess.
 */
function findNounTerm(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\W)${escaped}(?:e?s)?(?:$|\\W)`, 'i').test(haystack);
}

/** The first term from a longest-first list that appears in the clause. */
function firstMatch(clause: string, sorted: readonly string[]): string | null {
  for (const term of sorted) {
    if (findTerm(clause, term)) return term;
  }
  return null;
}

/**
 * The colour, or null.
 *
 * Multiword-first is not a nicety: "light blue" collapsed to "blue" was the bug
 * that would file every pale shirt as royal, and the same list's multiword keys
 * are already the subject of a test in `intake-colour-terms`.
 */
export function findColour(clause: string): string | null {
  return firstMatch(clause, COLOUR_SORTED);
}

export function findMaterial(clause: string): string | null {
  return firstMatch(clause, MATERIAL_SORTED);
}

export function findPattern(clause: string): string | null {
  const hit = firstMatch(clause, PATTERN_SORTED);
  if (!hit) return null;
  // Spoken adjectives, stored as the noun the tagger uses.
  if (hit === 'stripe' || hit === 'striped' || hit === 'pinstripe') return 'striped';
  if (hit === 'check' || hit === 'checked') return 'checked';
  if (hit === 'dotted' || hit === 'polka dot') return 'polka dot';
  if (hit === 'camouflage') return 'camo';
  if (hit === 'animal print') return 'leopard';
  return hit;
}

/** The garment noun and the slot it implies, or null when nothing matched. */
export function findNoun(clause: string): { noun: string; slot: IntakeSlot } | null {
  const noun = NOUNS_SORTED.find((candidate) => findNounTerm(clause, candidate)) ?? null;
  if (!noun) return null;
  const klass = NOUN_TO_CLASS.get(noun)!;
  const slot = MID_LAYER_NOUNS.has(noun) ? 'mid_layer' : CLASS_TO_SLOT[klass];
  return { noun, slot };
}

/**
 * How many. Digits, then number words, then one.
 *
 * "A pair of jeans" is ONE garment, not two — `pair` maps to 1 for exactly that
 * reason, and it is the only word in the table whose plain meaning it
 * contradicts.
 */
export function findQuantity(clause: string): number {
  const digits = clause.match(/\b(\d{1,2})\b/);
  if (digits) {
    const n = Number(digits[1]);
    if (n >= 1 && n <= MAX_QUANTITY) return n;
  }
  for (const [word, n] of NUMBER_WORDS) {
    if (findTerm(clause, word)) return Math.min(n, MAX_QUANTITY);
  }
  return 1;
}

// ---------------------------------------------------------------------------
// The parse
// ---------------------------------------------------------------------------

/**
 * Confidence, from what was actually resolved.
 *
 * A number the screen uses to decide whether a card hedges, so it has to mean
 * something: 1.0 is "every field came from a lexicon", and each unresolved
 * field costs a fixed amount. It is never derived from a model's self-report,
 * which is the one number in the old pipeline that could not be checked.
 */
function confidenceFor(colour: string | null, material: string | null): number {
  let score = 1;
  if (!colour) score -= 0.35;
  if (!material) score -= 0.05;
  return Math.round(Math.max(score, 0.1) * 100) / 100;
}

export function parseCloset(transcript: string): DeterministicParse {
  const clauses = splitClauses(transcript);
  const garments: ParsedGarment[] = [];
  const unconsumed: string[] = [];
  const ambiguous: string[] = [];

  for (const span of clauses) {
    if (garments.length >= MAX_GARMENTS) break;

    const correcting = CORRECTION_PREFIX.test(span.text);
    // The correction word is not part of the garment, but the receipt line is
    // the SPAN — what they actually said, including "no, sorry". Quoting the
    // words back with the hesitation removed would be tidying up evidence.
    const body = span.text.replace(CORRECTION_PREFIX, '');

    if (UNFINISHED.test(span.text) && !findNoun(body)) {
      // Trailing "um" or a sentence that stopped. Not a garment, not a failure.
      continue;
    }

    const noun = findNoun(body);

    if (!noun) {
      // A relative phrase with no noun ("the same in black") is a garment we
      // cannot resolve alone — that is the model's job. Anything else is a
      // false start.
      if (RELATIVE_MARKERS.test(body) || findColour(body)) ambiguous.push(span.text);
      else if (body.trim().split(/\s+/).length >= 2) unconsumed.push(span.text);
      continue;
    }

    // A recognised noun WITH a relative marker still needs the model: "another
    // one of those shirts" names a shirt but points at a specific one.
    if (RELATIVE_MARKERS.test(body)) {
      ambiguous.push(span.text);
      continue;
    }

    const colour = findColour(body);
    const material = findMaterial(body);

    const garment: ParsedGarment = {
      utterance: span.text,
      name: noun.noun,
      slot: noun.slot,
      // NULL, not a guess. See the file header.
      colour_term: colour as ParsedGarment['colour_term'],
      fabric: material,
      pattern: findPattern(body),
      // Neither is spoken often enough to infer, and both feed the scorer.
      formality: null,
      warmth: null,
      quantity: findQuantity(body),
      confidence: confidenceFor(colour, material),
    };

    if (correcting && garments.length > 0) {
      garments[garments.length - 1] = garment;
    } else {
      garments.push(garment);
    }
  }

  return { garments, unconsumed, ambiguous };
}

/**
 * Whether the deterministic pass answered the whole transcript.
 *
 * This is the gate on the model call, and it is deliberately strict about only
 * one thing: `ambiguous`. Unconsumed spans do NOT trigger a fallback — they are
 * false starts and filler, and sending them would spend a call to be told a
 * cough is not a cardigan.
 */
export function needsFallback(parse: DeterministicParse): boolean {
  return parse.ambiguous.length > 0;
}

/**
 * The exact-span proof, applied to whatever the model returns.
 *
 * The deterministic parse cannot fail this — its spans are slices. The model
 * can, and this is where it is caught: a garment whose `utterance` is not a
 * substring of the transcript is a fabricated quotation and is dropped
 * entirely, not merely marked unsure.
 */
export function provenSpans(
  garments: readonly ParsedGarment[],
  transcript: string,
): ParsedGarment[] {
  return garments.filter((g) => Boolean(g.utterance) && transcript.includes(g.utterance));
}

/** Every slot value this module can emit, for the contract test to walk. */
export const EMITTED_SLOTS: readonly IntakeSlot[] = SLOTS;
