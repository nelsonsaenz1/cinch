import type { Item } from '@/schemas/item';

/**
 * The closet's QUERY layer — the pure half of `use-closet-screen.ts`.
 *
 * ── WHY IT MOVED HERE ───────────────────────────────────────────────────────
 *
 * Every function below is pure and every one of them is a policy: which chip a
 * category files under, what a search matches, and which chips survive a
 * filter. None of them needed React, and all of them were living in a module
 * that imports react-query, expo-router and React Native — which the node test
 * bundler cannot follow past `import typeof` in React Native's own index.
 *
 * The result was that the closet's query policy could only ever be asserted as
 * TEXT, by grepping the hook for a regex. Moving it costs one file and buys
 * tests that execute the thing they are about. `use-closet-screen.ts`
 * re-exports every name, so no call site changes.
 */

export type CategoryFilter = 'All' | 'Tops' | 'Bottoms' | 'Outerwear' | 'Shoes' | 'Accessories';
export const CATEGORIES: CategoryFilter[] = [
  'All',
  'Tops',
  'Bottoms',
  'Outerwear',
  'Shoes',
  'Accessories',
];

/** Which of the five browsing chips a stored `ItemCategory` falls under. Total: every value maps somewhere. */
export function chipFor(category: Item['category']): CategoryFilter {
  switch (category) {
    case 'top':
    case 'dress':
      return 'Tops';
    case 'bottom':
      return 'Bottoms';
    case 'outerwear':
      return 'Outerwear';
    case 'footwear':
      return 'Shoes';
    default:
      return 'Accessories';
  }
}

/** Top-N cutoffs. Small enough to stay highlights, not an inventory. */
export const MOST_WORN_LIMIT = 5;
/**
 * How many pieces the closet's wear rail carries, and how many the Latest rail
 * matches it at. Named `FAVOURITE_LIMIT` until UX-02 — see `mostWornRail`.
 */
export const MOST_WORN_RAIL_LIMIT = 8;

/**
 * How many reactions the style engine wants before it will say anything about
 * taste. Mirrors the constant of the same name in app/profile.tsx — the chips
 * below fall back to the learned style summary, and showing a "taste" the
 * engine itself would disown breaks the app's honesty rule.
 */
export const TASTE_THRESHOLD = 8;

/** Chips and captions open with a capital; tags arrive lowercase from the DB. */
export function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "1 Piece", not "1 Pieces". The stats row is the app's most-read line of
 *  type and it was ungrammatical at n=1 on three of its four numbers. */
export function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

/**
 * Live search over the words a person would actually type: what it is, its
 * colour, the brand — and now the fabric, because the search footer promises
 * "name, colour and fabric" and a matcher that skipped `material` made that
 * sentence a lie. `q` must arrive trimmed and lowercased; the hook does that
 * once per keystroke rather than once per item.
 */
export function matchesSearch(item: Item, q: string): boolean {
  if (!q) return true;
  return [item.subcategory, item.category, item.brand, item.material, ...item.colors.map((c) => c.name)]
    .filter(Boolean)
    .some((s) => s!.toLowerCase().includes(q));
}

/** One chip's label and its live count, for the browsing row. */
export type CategoryCount = { category: CategoryFilter; count: number };

/**
 * Counts for the category chips — `All 148`, `Tops 41`, … — computed over the
 * query-matched set so the numbers stay honest inside search, where chip and
 * typed query compose. Categories with nothing filed under them are dropped
 * (a chip promising an empty grid teaches people to stop reading the row);
 * `All` always survives, because zero pieces is a fact the row must still
 * be able to state.
 */
export function categoryCounts(items: Item[], q: string): CategoryCount[] {
  const matched = items.filter((i) => matchesSearch(i, q));
  const byChip = new Map<CategoryFilter, number>();
  for (const item of matched) {
    const chip = chipFor(item.category);
    byChip.set(chip, (byChip.get(chip) ?? 0) + 1);
  }
  return CATEGORIES.flatMap((category) => {
    const count = category === 'All' ? matched.length : (byChip.get(category) ?? 0);
    if (count === 0 && category !== 'All') return [];
    return [{ category, count }];
  });
}

/** The insight card's numbers — see `wornThisYear` for what each one claims. */
