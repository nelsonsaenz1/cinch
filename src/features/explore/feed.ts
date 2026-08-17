/**
 * What Explore's timeline is allowed to contain — UX-04, Variant A.
 *
 * Two filters, applied in one place so the screen, the tab-bar dot and the
 * tests cannot disagree about what "your circle" means:
 *
 * 1. **Not you.** The accepted design ships Variant A: the caller's own recent
 *    pieces are dropped at this existing client seam (`isSelf`, already set by
 *    `useNewAdditions`), and nothing about the query, the `friend_items` view,
 *    RLS or any privacy contract changes. The page is called Explore and its
 *    one honest sentence is "New in your circle" — a timeline whose top half is
 *    your own uploads is neither. Your own pieces remain reachable everywhere
 *    they already were: Closet, Item, Today, Plan.
 * 2. **Not muted.** Device-local, per-friend, reversible — see `muted.ts`. It
 *    used to carry an explicit "your own pieces are never filtered" exception;
 *    with Variant A that exception is dead, because you are not in the list at
 *    all.
 *
 * Both run before day grouping and before the signed-URL batch, so a hidden row
 * costs no header, no fetch, and no unread mark.
 *
 * The timeline's *order* lives here too, for the same reason the filters do:
 * `useNewAdditions` merges two server-ordered halves into one list, and the rule
 * that re-establishes "newest first" across that seam is the part most worth
 * testing and the part least in need of React.
 */

import { compareIsoTimestamps } from '@/lib/date';

/** The shape both filters need. Structural, so tests need no query fixtures. */
export interface CircleRow {
  ownerId: string;
  isSelf: boolean;
}

/**
 * The rows Explore may draw, in the order they arrived.
 *
 * Order is preserved rather than re-sorted: `useNewAdditions` decided it, and a
 * filter that also sorts is a second opinion nobody asked for.
 */
export function circleEntries<T extends CircleRow>(
  entries: readonly T[],
  muted: ReadonlySet<string>,
): T[] {
  return entries.filter((entry) => !entry.isSelf && !muted.has(entry.ownerId));
}

/**
 * The end of the page — UX-10's finite closure.
 *
 * Explore stops. A feed that never says so is telling the reader there is
 * always more, which is the mechanic this product rejects by name. The line
 * only prints under a timeline that actually loaded and actually has rows; an
 * empty circle has its own hero, and "caught up" over a failed read would be a
 * claim the app cannot make.
 */
export const CAUGHT_UP_LINE = 'You’re caught up with your circle.';

/** The shape the ordering rule needs. Structural, like `CircleRow`. */
export interface CreatedAtRow {
  createdAt: string;
}

/**
 * Most recently added first.
 *
 * The string comparison is `compareIsoTimestamps` rather than `localeCompare`,
 * for the ICU-collation reason spelled out in `lib/date.ts` — under collation a
 * garment added a fraction of a second later sorts EARLIER, and the timeline
 * shows its own days out of order. Both operands come from the same
 * `created_at` column in the same response, which is the precondition that
 * makes comparing the text legitimate at all.
 *
 * Ties report 0 rather than inventing a second key: `sort` is stable, so two
 * garments added in the same instant keep the order the query returned them in.
 */
export function byCreatedAtDescending(a: CreatedAtRow, b: CreatedAtRow): number {
  return compareIsoTimestamps(b.createdAt, a.createdAt);
}

/** Whether the closure line may print. */
export function showsCaughtUp(opts: {
  isError: boolean;
  isLoading: boolean;
  visibleCount: number;
}): boolean {
  return !opts.isError && !opts.isLoading && opts.visibleCount > 0;
}
