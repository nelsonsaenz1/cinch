/**
 * Dates, as a lookbook prints them.
 *
 * Explore is a dated page, not a stream: the entries sit under day headings
 * ("TODAY", "YESTERDAY", "TUE 4 AUG") the way a printed spread carries its
 * date at the top of the leaf, and each line still says how long ago it was in
 * the caption. Both are here rather than in the screen because both are pure
 * functions of a timestamp and are the sort of thing that quietly drifts into
 * two dialects when each surface formats its own.
 *
 * `now` is injectable so the boundaries are testable without waiting for
 * midnight, and defaulted so no call site has to construct a clock.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Local midnight for a date — the boundary "yesterday" actually means. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * "Just now" · "12 min ago" · "5h ago" · "3d ago" · "14 Jul".
 *
 * Rendered through `colophon`, which upper-cases and tracks it; the strings are
 * written in sentence case so they read correctly anywhere else too.
 */
export function sinceLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const elapsed = now.getTime() - then;
  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 7 * DAY) return `${Math.max(1, Math.floor(elapsed / DAY))}d ago`;

  return new Date(then).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

/**
 * The heading over a day's entries: "Today", "Yesterday", else "Tue 4 Aug" —
 * the same weekday·day·month shape Today's masthead prints.
 */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';

  const weekday = at.toLocaleDateString('en-US', { weekday: 'short' });
  const month = at.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday} ${at.getDate()} ${month}`;
}

export interface DayGroup<T> {
  /** Stable key — the local calendar day, not the label (which changes at midnight). */
  key: string;
  label: string;
  entries: T[];
}

/**
 * Entries, already newest-first, cut into consecutive day groups.
 *
 * Order is preserved rather than re-sorted: the query decided the order, and a
 * grouping function that also sorts is a second opinion nobody asked for.
 */
export function groupByDay<T>(
  entries: T[],
  timestampOf: (entry: T) => string,
  now: Date = new Date(),
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];

  for (const entry of entries) {
    const iso = timestampOf(entry);
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) continue;

    const key = String(startOfDay(at));
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, label: dayLabel(iso, now), entries: [entry] });
    }
  }

  return groups;
}
