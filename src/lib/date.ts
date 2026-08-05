/**
 * Plain calendar dates, in the user's own zone.
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
