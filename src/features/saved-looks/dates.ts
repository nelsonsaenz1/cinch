/**
 * The two date shapes the saved-looks frames print, and nothing else.
 *
 * ── WHY THIS IS NOT `lib/date.ts` ──────────────────────────────────────────
 *
 * That module holds `dateKey` (the plan calendar's local-day key) and
 * `compareIsoTimestamps`. Neither is a formatter, and neither of these two is a
 * general-purpose one: `savedAgo` is a deliberately coarse elapsed label that
 * exists because OS-03's cards print "4d" and "1mo", and `provenanceDate` is the
 * one long form OS-04 prints beside a source. Putting a pair of frame-specific
 * formatters in the shared module is how a shared module becomes a drawer.
 *
 * ── AND WHY COARSE IS THE POINT ────────────────────────────────────────────
 *
 * "4d" rather than "4 days, 3 hours ago". These labels sit under a title in a
 * two-column grid, they are read at a glance, and their job is ordering rather
 * than measurement — the reader wants to know which of these they kept recently,
 * not when. Precision here would also be mildly identifying about somebody
 * else's look, since the elapsed time is measured from a moment that belongs to
 * them.
 *
 * Pure, no locale switching, no `Intl.RelativeTimeFormat`: Hermes ships a
 * partial ICU and the app is English-only today, so a formatter that appears to
 * localise while quietly falling back is worse than one that plainly does not.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/** Thirty days. A "month" here is a bucket, not a calendar month. */
const MONTH = 30 * DAY;

/**
 * "now", "3h", "4d", "1w", "2mo" — the card and row label.
 *
 * `now` covers everything under a minute, including the negative case. A clock
 * that is a few seconds behind the server produces a save "in the future", and
 * "-0d" printed under somebody's own look is the kind of small wrongness that
 * makes a whole screen look untrustworthy.
 *
 * `at` is injectable so the tests are not a race with the wall clock.
 */
export function savedAgo(isoTimestamp: string, at: Date = new Date()): string {
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return '';

  const elapsed = at.getTime() - then;
  if (elapsed < MINUTE) return 'now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d`;
  if (elapsed < MONTH) return `${Math.floor(elapsed / WEEK)}w`;
  return `${Math.max(Math.floor(elapsed / MONTH), 1)}mo`;
}

/**
 * "Aug 3, 2026" — the provenance line's date, and the "Saved" row's.
 *
 * THE YEAR IS ALWAYS PRINTED, including for this year. A saved look has no upper
 * age: the shelf is a place things stay, and a bare "Aug 3" on a card kept two
 * years ago is a date that reads as recent. The frames print the year and this
 * is why.
 *
 * An unparseable timestamp returns an empty string rather than "Invalid Date",
 * and the callers compose with `·` separators that collapse — a missing date
 * leaves a line slightly short, never a line that says the app is broken.
 */
export function provenanceDate(isoTimestamp: string): string {
  const at = new Date(isoTimestamp);
  if (Number.isNaN(at.getTime())) return '';
  const month = at.toLocaleDateString('en-US', { month: 'short' });
  return `${month} ${at.getDate()}, ${at.getFullYear()}`;
}

/**
 * "Aug 3 · 9:12 AM" — the one place a TIME is shown, on OS-04's "Saved" row.
 *
 * It is shown there and nowhere else because that row is about the reader's own
 * act: they know what they were doing at 9:12, and the time is what makes the
 * row a memory rather than a field. No other line in this feature carries a
 * time, and in particular the provenance line does not — the moment somebody
 * else wore a look is theirs, and a minute-precise stamp of it on a private
 * shelf is more than the frame asks for.
 */
export function savedAtLine(isoTimestamp: string): string {
  const at = new Date(isoTimestamp);
  if (Number.isNaN(at.getTime())) return '';
  const month = at.toLocaleDateString('en-US', { month: 'short' });
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${month} ${at.getDate()} · ${time}`;
}
