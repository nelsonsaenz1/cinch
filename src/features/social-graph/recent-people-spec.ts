/**
 * The pure half of the RECENT list — ordering, bound, and storage key.
 *
 * Split from `recent-people.ts` so the tests can assert these without
 * bundling the store: that file imports AsyncStorage and the session, which
 * the node test bundle cannot carry. Same split, same reason, as
 * `people-search-spec.ts` beside it.
 */

/** How many searches are worth remembering. The frames draw three. */
export const RECENT_LIMIT = 8;

/** Per-signed-in-user, so one phone can hold two people without leaking. */
export function recentKey(userId: string): string {
  return `cinch.people-search.recent.v1.${userId}`;
}

/**
 * Newest first, no duplicates, bounded.
 *
 * Pure so the ordering can be asserted without a store: "search someone you
 * already searched" must MOVE them to the top rather than add a second row,
 * and the bound must drop the oldest rather than refuse the newest.
 */
export function withRecent(ids: string[], userId: string): string[] {
  return [userId, ...ids.filter((id) => id !== userId)].slice(0, RECENT_LIMIT);
}
