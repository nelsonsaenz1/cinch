import type { Item } from '@/schemas/item';

/**
 * What the tagger did not manage to say about a garment.
 *
 * The review deck exists so a human can correct a machine, and the fastest way
 * to waste that person's attention is to ask them about the things the machine
 * already got right. The founder's instruction is exactly this: only interrogate
 * the uncertain fields. So the deck reads a garment, works out where the tagger
 * fell short, and puts the invitation to correct only on those rows — everything
 * else stays a settled spec line the user can confirm with one gesture.
 *
 * These are deliberately *absence* tests, not confidence scores. The tagging
 * model returns no per-field confidence (see `supabase/functions/_shared/
 * tag-schema.ts`), and inventing one from the prose would be a number with
 * nothing behind it. What a missing material or an empty colour array actually
 * means is unambiguous: nobody has answered this yet.
 */

/** The rows the review card shows, in the order the design lists them. */
export type TagGap = 'category' | 'colours' | 'details' | 'brand';

/**
 * `category` is a gap in three cases and only three: the tagging run failed
 * outright (`needs_review`), the model reached for the catch-all bucket, or it
 * named a category but never got as far as the subcategory the design's
 * "Tops · Knitwear" line is built from.
 */
function categoryIsUnsure(item: Item): boolean {
  if (item.status === 'needs_review') return true;
  if (item.category === 'other') return true;
  return !item.subcategory;
}

/**
 * "Details" has no column of its own — the card composes it from material and
 * pattern, falling back to the description. It is missing when all three are.
 */
function detailsAreMissing(item: Item): boolean {
  if (item.material) return false;
  if (item.pattern && item.pattern !== 'none') return false;
  return !item.description;
}

/** Everything about this garment the tagger left for a person to fill in. */
export function gapsFor(item: Item): TagGap[] {
  const gaps: TagGap[] = [];
  if (categoryIsUnsure(item)) gaps.push('category');
  if (item.colors.length === 0) gaps.push('colours');
  if (detailsAreMissing(item)) gaps.push('details');
  if (!item.brand) gaps.push('brand');
  return gaps;
}

/**
 * The gaps the review deck can actually do something about.
 *
 * `useVerifyItem` writes category, subcategory, occasions, seasons and price and
 * nothing else, so category is the only gap on this list with a control behind
 * it. That is a real limitation and it is stated here rather than papered over:
 * an "unsure about its colour" prompt on a card with no colour control is the
 * same broken promise as the decorative "Edit" this deck already removed once.
 * Colours, details and brand are still worth REPORTING — they explain why a card
 * looks sparse — they are simply not worth ASKING about yet.
 */
const EDITABLE: readonly TagGap[] = ['category'];

/** Split the gaps into the ones worth asking about and the ones worth admitting. */
export function partitionGaps(gaps: TagGap[]): { askable: TagGap[]; unfixable: TagGap[] } {
  return {
    askable: gaps.filter((g) => EDITABLE.includes(g)),
    unfixable: gaps.filter((g) => !EDITABLE.includes(g)),
  };
}

/** True when the tagger answered everything the card can show. */
export function isFullyTagged(item: Item): boolean {
  return gapsFor(item).length === 0;
}

/**
 * The gaps as one readable clause: "the colour and the brand".
 *
 * Oxford-comma-free and sentence-cased by the caller. Capped at three so a
 * badly tagged garment produces an invitation rather than an inventory. The
 * atlas sets the register — "Cinch wasn't sure about the category" — so the
 * invitation and the footnote below share one noun list rather than keeping a
 * wordier paraphrase alive beside it.
 */
export function describeGaps(gaps: TagGap[]): string {
  return joinClause(gaps.slice(0, 3).map((g) => GAP_NOUN[g]));
}

/** The gap as a plain noun — "the colour" — for both lines above. */
const GAP_NOUN: Record<TagGap, string> = {
  category: 'the category',
  colours: 'the colour',
  details: 'the fabric',
  brand: 'the brand',
};

/**
 * The unfixable gaps as one quiet line for the foot of the review card.
 *
 * This sentence used to be a screen-wide banner above the deck — a full-bleed
 * notice pinned over the first card a new user ever sees, announcing a defect
 * before it announced the garment. The atlas keeps the admission word for word
 * and drops only the volume: it lives under the spec rows it explains, in the
 * faint tone, where it reads as a footnote instead of an error report.
 *
 * Returns null when there is nothing to admit, so the card renders no footnote
 * at all rather than an empty line.
 */
export function noteGaps(gaps: TagGap[]): string | null {
  if (gaps.length === 0) return null;
  return `Cinch left ${joinClause(gaps.slice(0, 3).map((g) => GAP_NOUN[g]))} blank. Nothing here fills that in — confirm the rest.`;
}

/** "a", "a and b", "a, b and c" — Oxford-comma-free, as the copy deck sets it. */
function joinClause(words: string[]): string {
  if (words.length === 0) return '';
  if (words.length === 1) return words[0]!;
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]!}`;
}
