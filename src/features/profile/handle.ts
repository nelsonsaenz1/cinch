import type { HandleAvailability } from './queries';

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
 *
 * `import type { HandleAvailability } from './queries'` above is erased at
 * compile time, so it does not create a runtime cycle even though
 * `queries.ts` imports `handleProblem`/`normaliseHandle` from this file.
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

export type HandleHint = { text: string; tone: 'error' | 'quiet' };

/**
 * The line under the handle field (EP-02). One line, four things it can say,
 * in order of how much the user needs to hear it: what is malformed
 * ("not-allowed" characters), what is taken, that the check is in flight, and
 * — when there is nothing to report — what the field is for.
 *
 * Pure, so `edit-profile-sheet.tsx` and `dev-account.tsx`'s deterministic
 * fixture strip compute the identical sentence from the identical inputs
 * rather than one of them hand-retyping the copy.
 */
export function handleHintFor(
  handle: string,
  handleError: string | null,
  availability: HandleAvailability,
): HandleHint {
  if (handleError !== null) {
    const normal = normaliseHandle(handle);
    // If the length is fine, the problem `handleProblem` found is the characters.
    const formatProblem = normal.length >= HANDLE_MIN && normal.length <= HANDLE_MAX;
    return {
      text: formatProblem
        ? 'Spaces and punctuation will not work here. Letters, numbers and underscores only.'
        : handleError,
      tone: 'error',
    };
  }
  if (availability === 'taken') {
    return { text: 'Someone has this one. Try adding a word or a number.', tone: 'error' };
  }
  if (availability === 'checking') {
    return { text: 'Hold on a second.', tone: 'quiet' };
  }
  return {
    text: 'Letters, numbers and underscores. This is how friends find your closet.',
    tone: 'quiet',
  };
}

/**
 * A handful of alternatives when the handle she wants is held.
 *
 * Derived locally — a compressed display name, the `_wears` suffix, a short
 * number — and NOT availability-checked here: the field's own live check
 * answers for whatever is typed, including a tapped suggestion. The number is
 * a deterministic function of the base so the rail does not reshuffle on
 * every keystroke.
 */
export function suggestHandles(taken: string, displayName: string): string[] {
  const base = normaliseHandle(taken);
  const fromName = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const digits = String(((base.charCodeAt(0) || 0) + base.length) % 90 + 10);
  const candidates = [fromName, `${base}_wears`, `${base}${digits}`];
  return [...new Set(candidates)]
    .filter((c) => c !== base && handleProblem(c) === null && c.length > 0)
    .slice(0, 3);
}
