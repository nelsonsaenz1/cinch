/**
 * The new-since-last-visit boundary — UX-10, the arithmetic half.
 *
 * The product rule this file exists to make untestable-by-inspection into
 * tested-by-assertion: **the app never invents unreadness.** A dot on the
 * Explore tab is a promise that something a friend did is genuinely new to you,
 * and there are exactly three ways to keep that promise honest:
 *
 * - The boundary is an *authoritative* timestamp. It is a `created_at` string
 *   that came back from the database with a friend's garment — never a local
 *   clock, which drifts, and never a device timezone, which travels. Storing
 *   the newest row the reader has actually been shown means the comparison
 *   later is server-time to server-time.
 * - **Unproven means silent.** If no boundary has ever been written (first
 *   launch, a cleared install, a Keychain/AsyncStorage read that threw), there
 *   is no fact about what this person has seen, so `boundary` is `null` and
 *   every helper below reports zero unseen. The dot is suppressed rather than
 *   guessed — the accepted design says so in as many words.
 * - **Your own pieces never count.** Not by a rule here, but by construction:
 *   callers pass rows that have already been through `circleEntries` in
 *   `feed.ts`, which drops `isSelf` (Variant A) and muted owners. A garment you
 *   photographed yourself cannot be news to you, and neither can one from
 *   someone you have quietened.
 *
 * Storage is user-scoped and lives beside the other device-local social state
 * (`muted.ts`); no schema, no column, no backend contract.
 */

/**
 * Bumped only when the stored value's *meaning* changes. It currently holds one
 * ISO timestamp string — the newest friend row the reader has been shown.
 */
const LAST_SEEN_VERSION = 'v1';

/**
 * Where one account's boundary lives.
 *
 * Scoped by user id rather than global: two accounts on one device (a founder
 * and a test account, most commonly) must not inherit each other's read state,
 * and signing out then back in must not silently mark a stranger's timeline
 * read.
 */
export function lastSeenStorageKey(userId: string): string {
  return `cinch.explore.last-seen.${LAST_SEEN_VERSION}.${userId}`;
}

/**
 * Two timestamps, compared as instants rather than as strings.
 *
 * Deliberately not a string compare at all. `byCreatedAtDescending` in
 * `feed.ts` can compare the strings themselves because both of its operands
 * come from the same Postgres column in the same response. Here one side has
 * been round-tripped through AsyncStorage and the other is fresh from the wire,
 * and `+00:00` versus `Z` — the same instant, spelled two ways — orders wrongly
 * under any lexicographic compare, `localeCompare` and codepoint order alike.
 * Returns `null` when either side is unparseable, which every caller reads as
 * "cannot prove", never as "newer".
 */
function compareInstants(a: string, b: string): number | null {
  const at = Date.parse(a);
  const bt = Date.parse(b);
  if (Number.isNaN(at) || Number.isNaN(bt)) return null;
  return at - bt;
}

/**
 * Is this row newer than the boundary?
 *
 * Strictly newer: the boundary is the newest row already shown, so a row with
 * exactly that timestamp is the one you were shown, not a new one.
 */
export function isUnseen(createdAt: string, boundary: string | null): boolean {
  if (!boundary) return false;
  const diff = compareInstants(createdAt, boundary);
  return diff !== null && diff > 0;
}

/** How many of these rows are genuinely new. Zero whenever the boundary is unproven. */
export function unseenCount<T>(
  entries: readonly T[],
  createdAtOf: (entry: T) => string,
  boundary: string | null,
): number {
  if (!boundary) return 0;
  return entries.reduce((n, entry) => (isUnseen(createdAtOf(entry), boundary) ? n + 1 : n), 0);
}

/** Whether the Explore tab may draw its dot. */
export function hasUnseen<T>(
  entries: readonly T[],
  createdAtOf: (entry: T) => string,
  boundary: string | null,
): boolean {
  return unseenCount(entries, createdAtOf, boundary) > 0;
}

/**
 * Where the "new since you last looked" rule is drawn, as an index into the
 * newest-first list — or `null` when there is nothing to divide.
 *
 * `null` covers three cases on purpose, because all three should render the
 * same nothing: no boundary (unproven), nothing new (the reader has seen the
 * top of the page), and nothing old (every row is new, so a rule above the
 * first row would separate the page from itself).
 *
 * The list is assumed newest-first, which is what `useNewAdditions` guarantees;
 * the index returned is that of the first already-seen row.
 */
export function unseenBoundaryIndex<T>(
  entries: readonly T[],
  createdAtOf: (entry: T) => string,
  boundary: string | null,
): number | null {
  if (!boundary) return null;
  const firstSeen = entries.findIndex((entry) => !isUnseen(createdAtOf(entry), boundary));
  if (firstSeen <= 0) return null;
  return firstSeen;
}

/**
 * The newest authoritative timestamp in a batch — the value to store once the
 * reader has been shown it.
 *
 * Scans rather than trusting position: the ordering contract belongs to the
 * query, and a boundary that silently depended on it would be a read-state bug
 * the day someone reorders the list. Unparseable rows are skipped, never
 * stored.
 */
export function newestTimestamp<T>(
  entries: readonly T[],
  createdAtOf: (entry: T) => string,
): string | null {
  let newest: string | null = null;
  for (const entry of entries) {
    const at = createdAtOf(entry);
    if (Number.isNaN(Date.parse(at))) continue;
    if (newest === null) {
      newest = at;
      continue;
    }
    const diff = compareInstants(at, newest);
    if (diff !== null && diff > 0) newest = at;
  }
  return newest;
}

/**
 * The boundary after a visit: the later of what was stored and what was shown.
 *
 * Monotonic on purpose. A refetch that returns a shorter window — a friendship
 * lapsed, a mute landed, the 40-row cap slid — must not walk the boundary
 * backwards and resurrect a dot for garments the reader already scrolled past.
 */
export function advanceBoundary(current: string | null, shown: string | null): string | null {
  if (!shown) return current;
  if (!current) return shown;
  const diff = compareInstants(shown, current);
  if (diff === null) return current;
  return diff > 0 ? shown : current;
}
