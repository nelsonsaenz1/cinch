/**
 * The `@handle` rules, in one place.
 *
 * Every rule here is a copy of a constraint that already exists in the schema,
 * restated client-side so the user hears about a problem while typing rather
 * than after a round trip. The database remains the authority — in particular
 * uniqueness, which only it can answer without a race.
 *
 * This is a separate module from `mutations.ts` because both the write path
 * and the availability read need it, and the read must not import the write.
 */

/** `profiles_username_format`, verbatim (20260803210000). */
export const HANDLE_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

/**
 * The stored form of what the user typed.
 *
 * Lowercased, because uniqueness is enforced on `lower(username)` and storing
 * mixed case would mean "@Dana" and "@dana" are the same claim rendered two
 * different ways depending on which screen you are looking at. The leading
 * `@` belongs to the field, never to the value: it would fail the format
 * check.
 */
export function normaliseHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Why this handle will be refused, or null if it looks fine.
 *
 * Uniqueness is NOT checked here — see `useHandleAvailability`.
 */
export function handleProblem(raw: string): string | null {
  const handle = normaliseHandle(raw);
  if (handle.length === 0) return null; // Unclaimed is a valid state.
  if (handle.length < HANDLE_MIN) return `Handles are at least ${HANDLE_MIN} characters.`;
  if (handle.length > HANDLE_MAX) return `Handles are at most ${HANDLE_MAX} characters.`;
  if (!HANDLE_PATTERN.test(handle)) return 'Letters, numbers and underscores only.';
  return null;
}
