/**
 * Time as this app stores it: plain calendar dates in the user's own zone, and
 * the ordering of the instants Postgres hands back.
 *
 * A `planned_date` is a plain date, not an instant: "Thursday" means Thursday
 * where the user is standing. `toISOString().slice(0, 10)` cannot express that,
 * because it renders the instant in UTC — so a Date sitting at local midnight
 * in Sydney serialises to the PREVIOUS day, and every plan made there is filed
 * twenty-four hours early. The same expression is a day LATE in Honolulu for
 * most of the evening.
 *
 * The fix is not to shift the Date but to read the fields the platform already
 * localised for us. `getFullYear`/`getMonth`/`getDate` are defined to return
 * the local calendar values, which is exactly the thing being stored.
 */

/** The local calendar date of `d`, as `YYYY-MM-DD`. */
export function dateKey(d: Date): string {
  const year = String(d.getFullYear()).padStart(4, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Two Postgres timestamps, oldest first — the comparator every list that
 * orders by `created_at` or `worn_at` should be built out of.
 *
 * It lives here rather than in whichever feature needed it first because the
 * fact it encodes is about the database, not about any one screen: Postgres
 * serialises `timestamptz` to a fixed-width ISO 8601 string in one timezone,
 * so as long as both operands come from the same column in the same response,
 * text order is chronological order and no Date parse is needed.
 *
 * `<` and `>` rather than `localeCompare`, and that is not a style choice.
 * `localeCompare` applies ICU collation, which gives punctuation variable
 * weight: `'…:00.5+00:00'.localeCompare('…:00+00:00')` reports the fractional
 * second as EARLIER than the whole second it follows. Every list sorted that
 * way can show its rows out of chronological order the moment two timestamps
 * differ only by a fraction — which is most of the interesting ties, because
 * that is what a burst of writes in one transaction looks like. The relational
 * operators are codepoint order, which for a fixed-format ISO string IS
 * chronological order.
 *
 * The one case this does NOT cover: comparing a stored string against a fresh
 * one, where `+00:00` and `Z` can spell the same instant two ways. That needs
 * real parsing — see `compareInstants` in `features/explore/unseen.ts`.
 */
export function compareIsoTimestamps(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
