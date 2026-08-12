/**
 * Why an answered row does not vanish.
 *
 * AV-05's rule: "a row that has been answered keeps its place and states the
 * outcome in words rather than disappearing — the reader should be able to see
 * what they just did." Every answer this page offers removes its own row from
 * the next `activity_feed()` read: lending flips the request out of `pending`,
 * adding back turns a `follow_in` into a `follow_back` under a different key,
 * and "Not now" writes the dismissal that filters it in SQL. So the row cannot
 * survive a refetch on its own — the page has to hold on to it.
 *
 * It holds the resolved line, not the id, so a retained row keeps the exact
 * sentence it was answered under even after the underlying rows have moved.
 * Retention is per-visit by construction (it lives in component state), which
 * is the right lifetime: on the next visit the answer is history and belongs to
 * the object — the event, the item, the friend — not to this page.
 */

import type { ActivityLine } from './sentence';

// ---------------------------------------------------------------------------
// Correction 22 · what the page says about its own window
// ---------------------------------------------------------------------------

/**
 * THIRTY DAYS, AND IT IS THE QUERY'S NUMBER.
 *
 * `activity_feed()` bounds itself in SQL — `window_start as (select now() -
 * interval '30 days' as t)`, `20260810100100_activity_feed.sql:116` — and every
 * branch of the union reads that CTE. There is no pagination past it and no
 * client-side bound to disagree with it. So the copy below states the query's
 * own number; nothing was changed in SQL to make the sentence true.
 */
export const RETENTION_DAYS = 30;

/** The masthead's line. `The last 30 days`. */
export const RETENTION_SUBTITLE = `The last ${RETENTION_DAYS} days`;

/**
 * The foot of the list, and the correction that matters most here.
 *
 * The earlier line — "older items are not stored" — implied that the request,
 * the occasion or the comment itself had been deleted. Nothing of the kind
 * happens: `activity_feed()` is a WINDOW over rows that live in `follows`,
 * `borrow_requests`, `event_members`, `event_votes` and `closet_likes`, none of
 * which this page can delete. So the line names where an aged-out item still
 * lives instead of warning about a loss that does not occur.
 *
 * And nothing here is held open because a reader has not looked: the window is
 * `occurred_at`, full stop. `activity_seen_at` feeds the dot
 * (`retention.hasUnseen`) and appears nowhere in the feed's own SQL.
 */
export const RETENTION_LINE =
  `This list holds ${RETENTION_DAYS} days. Anything older still lives on the request, occasion or ` +
  'comment it belongs to.';

/**
 * AV-02's load error.
 *
 * It must NOT promise that nothing expires while unread — unread state has no
 * effect on retention, and a promise the window does not make is a promise the
 * page cannot keep. What it says instead is both true and more useful: the
 * thing waiting for you is waiting on its own record, not on this list.
 */
export const LOAD_ERROR_TITLE = 'Could not load';
export const LOAD_ERROR_BODY =
  'Cinch could not fetch your activity. Anything waiting for you is still waiting on the request ' +
  'or occasion it belongs to.';

/** AV-02's empty. Quiet is the normal state — this page never prompts for engagement. */
export const EMPTY_TITLE = 'Nothing lately';
export const EMPTY_BODY =
  `No requests, invitations or comments in the last ${RETENTION_DAYS} days. Quiet is the normal state.`;

/**
 * The live feed, with answered-and-gone rows put back where they were.
 *
 * Merged by `occurredAt` descending rather than by remembered index: both lists
 * are already newest-first, so one pass restores the exact order the row was
 * answered in, and a genuinely new arrival that landed above it still sorts
 * above it. A retained line whose row is still in the feed is dropped here —
 * the feed's copy is the one the page renders, and the answer state is keyed
 * separately.
 */
export function mergeRetained(
  feed: readonly ActivityLine[],
  retained: readonly ActivityLine[],
): ActivityLine[] {
  if (retained.length === 0) return [...feed];

  const live = new Set(feed.map((line) => line.key));
  const orphans = retained.filter((line) => !live.has(line.key));
  if (orphans.length === 0) return [...feed];

  const merged: ActivityLine[] = [];
  let i = 0;
  let j = 0;

  // Both inputs are newest-first. Lexicographic order on a Postgres
  // timestamptz IS chronological order (fixed width, one zone), the same
  // property `social-graph/queries.ts` leans on in `laterOf` — so no Date
  // parsing is needed to interleave them.
  while (i < feed.length && j < orphans.length) {
    const a = feed[i]!;
    const b = orphans[j]!;
    if (a.row.occurredAt >= b.row.occurredAt) {
      merged.push(a);
      i += 1;
    } else {
      merged.push(b);
      j += 1;
    }
  }
  while (i < feed.length) merged.push(feed[i++]!);
  while (j < orphans.length) merged.push(orphans[j++]!);

  return merged;
}

/**
 * Is there anything on the feed the reader has not seen?
 *
 * The dot, and only the dot — `profiles.activity_seen_at` against the newest
 * row's timestamp. No count is stored and none is derivable from this: the
 * answer is a boolean because the tab shows a dot, never a number.
 *
 * A never-opened page with any row at all is unseen. A feed that is empty is
 * never unseen, whatever the timestamp says.
 */
export function hasUnseen(
  newestOccurredAt: string | null | undefined,
  seenAt: string | null | undefined,
): boolean {
  if (!newestOccurredAt) return false;
  if (!seenAt) return true;
  return newestOccurredAt > seenAt;
}
