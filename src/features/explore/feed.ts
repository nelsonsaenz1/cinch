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
 */

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

/** Whether the closure line may print. */
export function showsCaughtUp(opts: {
  isError: boolean;
  isLoading: boolean;
  visibleCount: number;
}): boolean {
  return !opts.isError && !opts.isLoading && opts.visibleCount > 0;
}
