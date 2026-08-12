import type { CategoryFilter } from '@/features/closet/use-closet-screen';

/**
 * C-02 and C-03 — the one sentence above the grid that states the COMPOSITION
 * of what is on screen.
 *
 * ── Why this exists as a derivation rather than a template at the call site ──
 *
 * C-02's annotation: "the held chip and the typed query compose rather than
 * override, and the sentence above the grid states the composition in words."
 * The frame draws `4 tops matching “wool”` while the All chip beside it reads
 * 7 — two different numbers that are both true, and the only thing that makes
 * them legible is a sentence saying which set the grid is showing.
 *
 * The closet used to print `7 pieces` there, which is the count of the matched
 * set and says nothing about the chip. That is the line this replaces.
 *
 * C-03 is the same sentence with no query: `8 accessories`.
 *
 * ── The two rules inside it ───────────────────────────────────────────────
 *
 * 1. NOTHING IS INVENTED IN THE SINGULAR. The frames only ever draw plurals,
 *    and the plural nouns are the atlas's own words. For a count of one the
 *    sentence says `1 piece` rather than reaching for a singular this module
 *    would have to make up — "1 shoe" for a filed pair, "1 outerwear" for a
 *    mass noun. The held chip is on screen directly above, so the category is
 *    never in doubt; guessing a noun to keep the grammar symmetrical would be
 *    inventing a fact about the garment.
 *
 * 2. ZERO IS QUIET. A count of nought returns null: the grid's own empty state
 *    is already saying which filter emptied it, and printing "0 pieces
 *    matching" above it is the same sentence twice.
 *
 * Pure and argument-shaped so it can be tested without a render — see
 * `tests/w3-g3-search-summary.test.ts`.
 */

/** The atlas's own plural for each chip. `All` has no noun of its own. */
const PLURAL: Record<Exclude<CategoryFilter, 'All'>, string> = {
  Tops: 'tops',
  Bottoms: 'bottoms',
  Outerwear: 'outerwear pieces',
  Shoes: 'shoes',
  Accessories: 'accessories',
};

export type SearchSummaryInput = {
  /** How many pieces the grid is actually drawing — never an estimate. */
  count: number;
  /** The held chip. `All` means no category is composing with the query. */
  category: CategoryFilter;
  /** What the user typed. Untrimmed is fine; this trims. */
  query: string;
};

/**
 * The sentence, or null when there is nothing worth saying above the grid.
 *
 * Null for a count of nought (the empty state has it) and null for the
 * unfiltered, unsearched grid (C-01 prints its total under the title instead,
 * and repeating it here would be the same fact twice on one screen).
 */
export function searchSummary({ count, category, query }: SearchSummaryInput): string | null {
  if (count <= 0) return null;

  const q = query.trim();
  const filtered = category !== 'All';
  if (!q && !filtered) return null;

  // See rule 1: the singular is always the neutral unit.
  const noun = count === 1 ? 'piece' : filtered ? PLURAL[category] : 'pieces';
  const subject = `${count} ${noun}`;

  // The curly quotes are the frame's, and they are what make a typed word read
  // as a quotation rather than as part of the sentence.
  return q ? `${subject} matching “${q}”` : subject;
}
