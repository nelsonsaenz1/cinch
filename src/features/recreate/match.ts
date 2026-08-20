/**
 * Matching an analysed inspiration against the closet — arithmetic, on device.
 *
 * The model's half of "Recreate this look" ends at structured pieces; this
 * half answers each piece from the wardrobe the person actually owns. It is
 * deliberately pure and deliberately local, for the outfit engine's own
 * three reasons: it cannot hallucinate a garment (it can only rank ids it
 * was handed), it costs nothing per run, and it works offline once the
 * analysis is in hand.
 *
 * ── How a candidate is scored ──────────────────────────────────────────────
 *
 * Four signals, weighted by how much each one is worth trusting:
 *
 *   colour 0.40 — the strongest thing a photograph actually communicates,
 *                 and the one the app measures rather than infers: garment
 *                 colours come from real pixels (toGarmentColors), the
 *                 piece's names resolve through the same lexicon, and the
 *                 distance is OKLab deltaE.
 *   kind   0.30 — subcategory words, through a small synonym fold so "tee"
 *                 finds a t-shirt and "trainers" find sneakers. Words, not
 *                 embeddings: the vocabulary is garment nouns, which is
 *                 exactly where a lexicon beats a model.
 *   formality 0.15, pattern 0.15 — cheap, honest tiebreakers.
 *
 * The SLOT is a gate, not a signal — trousers are not a candidate for a
 * dress at any colour distance — with two deliberate tolerances: base_top
 * and mid_layer interchange (the engine's own knits-as-tops argument), and
 * an accessory piece only meets accessories of the same KIND (a belt is not
 * a stand-in for sunglasses; `accessoryKind` draws the line).
 *
 * ── The threshold ──────────────────────────────────────────────────────────
 *
 * Below MATCH_THRESHOLD the answer is null, which the screen renders as an
 * honest gap. 0.62 is calibrated against the weights: a right-kind garment
 * in the WRONG colour tops out at 0.60 (kind 1.0 + formality 1.0 + pattern
 * 1.0, colour 0) and fails; the right colour with only the head noun in
 * common lands near 0.70 and passes. The failure mode this feature refuses
 * is the confident bad match, so the threshold errs toward gaps —
 * `tests/recreate-match.test.ts` pins both sides of the line.
 */

import { deltaE, resolveColorName } from '@/lib/color';
import { accessoryKind, toSlot, type Garment, type Slot } from '@/lib/styling';

import type { InspirationPiece, PieceMatch, RecreateResult } from './types';

export const MATCH_THRESHOLD = 0.62;

/** deltaE at or past this reads as "a different colour" — scores zero. */
const COLOR_FLOOR = 0.32;

// ---------------------------------------------------------------------------
// Kind words
// ---------------------------------------------------------------------------

/**
 * Words that name the same garment. Folded to the FIRST entry before
 * comparison. Small on purpose: every row is a claim that two words are the
 * same noun, and a wrong row here files somebody's dress as a skirt.
 */
const SYNONYMS: string[][] = [
  ['tshirt', 'tee'],
  ['sweater', 'jumper', 'pullover', 'knit'],
  ['sweatshirt', 'crewneck'],
  ['trousers', 'pants', 'slacks'],
  ['jeans', 'denim'],
  ['sneakers', 'trainers', 'kicks'],
  ['handbag', 'purse', 'bag'],
  ['jacket', 'coat'],
  ['skirt', 'midi', 'mini'],
  ['boots', 'booties'],
  ['sunglasses', 'shades'],
];

const FOLD = new Map<string, string>();
for (const row of SYNONYMS) for (const word of row) FOLD.set(word, row[0]!);

const STOP = new Set([
  'a', 'an', 'the', 'and', 'with', 'of', 'in', 'for', 'on',
  // Colour words live in the colour signal; letting them vote here would
  // count the same evidence twice.
  'black', 'white', 'grey', 'gray', 'navy', 'blue', 'green', 'red', 'brown',
  'tan', 'beige', 'cream', 'pink', 'purple', 'yellow', 'orange', 'gold', 'silver',
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      // Hyphens fold INTO the word before splitting, so "t-shirt" and
      // "tshirt" are one token rather than a stranded "t" and a "shirt"
      // that would collide with actual shirts.
      .replace(/-/g, '')
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => FOLD.get(w) ?? w),
  );
}

/** 0..1 — how much the piece's kind words and the garment's agree. */
export function kindScore(piece: InspirationPiece, garment: Garment): number {
  const wanted = tokens(piece.subcategory);
  if (!wanted.size) return 0.5; // nothing asked for, nothing to disagree with
  const have = tokens(`${garment.subcategory ?? ''} ${garment.category}`);
  if (!have.size) return 0.35; // an untagged garment is unknown, not wrong

  let shared = 0;
  for (const w of wanted) if (have.has(w)) shared += 1;
  // Overlap over the ASK, not Jaccard: "pleated midi skirt" against "skirt"
  // should score for the noun that matters, not be punished for the
  // adjectives the closet's tagger didn't write.
  return shared / wanted.size;
}

// ---------------------------------------------------------------------------
// The other signals
// ---------------------------------------------------------------------------

/** 0..1 — nearest OKLab distance between the piece's names and real pixels. */
export function colorScore(piece: InspirationPiece, garment: Garment): number {
  const wanted = piece.colorNames
    .map((name) => resolveColorName(name))
    .filter((c): c is NonNullable<ReturnType<typeof resolveColorName>> => c !== null);
  const have = garment.colors.map((c) => c.oklch);
  // Either side colourless — an unresolvable name, an untagged garment —
  // is unknown rather than wrong.
  if (!wanted.length || !have.length) return 0.5;

  let best = Infinity;
  for (const w of wanted) for (const h of have) best = Math.min(best, deltaE(w, h));
  return Math.max(0, 1 - best / COLOR_FLOOR);
}

const isSolid = (pattern: string | null) =>
  !pattern || /^(solid|plain|none)$/i.test(pattern.trim());

export function patternScore(piece: InspirationPiece, garment: Garment): number {
  const a = isSolid(piece.pattern);
  const b = isSolid(garment.pattern);
  if (a && b) return 1;
  if (a !== b) return 0.35;
  const same =
    piece.pattern!.toLowerCase().trim() === (garment.pattern ?? '').toLowerCase().trim();
  return same ? 1 : 0.55;
}

const formalityScore = (piece: InspirationPiece, garment: Garment): number =>
  1 - Math.abs(piece.formalityScore - garment.formality) / 4;

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

export function pieceSlot(piece: InspirationPiece): Slot {
  return toSlot({
    category: piece.category as Parameters<typeof toSlot>[0]['category'],
    subcategory: piece.subcategory,
  });
}

function slotCompatible(piece: InspirationPiece, want: Slot, garment: Garment): boolean {
  if (want === garment.slot) {
    if (want !== 'accessory') return true;
    // Same-kind accessories only. An unknown kind on either side stays
    // eligible — 'other' meeting 'other' is the old behaviour, and 'other'
    // meeting a known kind is a guess this gate refuses to make into a veto
    // only when the PIECE is the unknown one (the closet's kind is read from
    // its own tag and is the better evidence).
    const wanted = accessoryKind({ category: 'accessory', subcategory: piece.subcategory });
    if (wanted === 'other') return true;
    return accessoryKind(garment) === wanted;
  }
  // The engine's own tolerance: a knit is worn as a top half the year.
  const tops: Slot[] = ['base_top', 'mid_layer'];
  return tops.includes(want) && tops.includes(garment.slot);
}

// ---------------------------------------------------------------------------
// The match
// ---------------------------------------------------------------------------

const WEIGHTS = { color: 0.4, kind: 0.3, formality: 0.15, pattern: 0.15 } as const;

export function scoreCandidate(piece: InspirationPiece, garment: Garment): number {
  return (
    WEIGHTS.color * colorScore(piece, garment) +
    WEIGHTS.kind * kindScore(piece, garment) +
    WEIGHTS.formality * formalityScore(piece, garment) +
    WEIGHTS.pattern * patternScore(piece, garment)
  );
}

/**
 * Answer every piece, one garment each.
 *
 * Greedy in PIECE ORDER, which the analysis returns most-dominant-first: the
 * dress gets first pick of the closet, and an accessory can never claim the
 * garment the look actually turns on. One garment fills at most one piece —
 * a photograph of a white shirt over a white skirt must not come back as the
 * same shirt twice.
 */
export function matchInspiration(pieces: InspirationPiece[], wardrobe: Garment[]): RecreateResult {
  const taken = new Set<string>();
  const matches: PieceMatch[] = pieces.map((piece) => {
    const slot = pieceSlot(piece);
    let best: Garment | null = null;
    let bestScore = 0;
    for (const garment of wardrobe) {
      if (taken.has(garment.id)) continue;
      if (!slotCompatible(piece, slot, garment)) continue;
      const score = scoreCandidate(piece, garment);
      if (score > bestScore) {
        best = garment;
        bestScore = score;
      }
    }
    if (best && bestScore >= MATCH_THRESHOLD) {
      taken.add(best.id);
      return { piece, slot, item: best, confidence: bestScore };
    }
    return { piece, slot, item: null, confidence: 0 };
  });

  const matchedItems = matches
    .filter((m): m is PieceMatch & { item: Garment } => m.item !== null)
    .map((m) => m.item);

  return { matches, matchedItems, gapCount: matches.length - matchedItems.length };
}
