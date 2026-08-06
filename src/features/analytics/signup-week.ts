/**
 * The ISO-8601 week an account was created in, as `YYYY-Www`.
 *
 * A cohort key, deliberately coarser than the timestamp it is derived from: a
 * week is enough to line users up on a retention curve, and it is not a moment
 * that could help re-identify anyone.
 *
 * ISO weeks, not "week of the year", and the difference is the whole reason
 * this is eight lines rather than one. An ISO week runs Monday to Sunday and
 * belongs to the year containing its Thursday — so 1 January 2027 is
 * `2026-W53`, and a naive `weekOfYear(jan 1) = 1` would file that account in a
 * cohort with users who signed up a full year later. Pivoting on the Thursday
 * is what makes the year and the week agree.
 *
 * Computed in UTC throughout. `created_at` is a UTC instant from Postgres, and
 * bucketing it by the device's local calendar would put the same account in
 * different cohorts depending on which timezone happened to read it.
 *
 * Pure: it reads only its argument. There is no `Date.now()` here, so it is
 * safe to call from anywhere including a render path — see the React Compiler
 * note in `use-plan.ts` for why that matters in this repo.
 */
export function isoWeek(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;

  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return null;

  // Midnight UTC on the day itself — the time of day is irrelevant to a week
  // bucket and only adds rounding hazards to the arithmetic below.
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));

  // Move to this week's Thursday. `getUTCDay()` is 0 for Sunday; ISO counts
  // Sunday as 7, so the `|| 7` re-bases the week onto Monday.
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);

  const year = day.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.ceil(((day.getTime() - jan1) / 86_400_000 + 1) / 7);

  return `${year}-W${String(week).padStart(2, '0')}`;
}
