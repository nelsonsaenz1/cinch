/**
 * Phone numbers for the sign-in run — shape, not truth.
 *
 * The same contract `email.ts` holds: a cheap client-side check whose only job
 * is refusing obvious non-numbers before a request is spent, and a normalizer
 * that produces the one canonical form the server is given. The REAL
 * validation is the text arriving; nothing here claims a number is reachable.
 *
 * The canonical form is E.164 (`+13334445555`) because it is the only shape
 * Supabase's phone OTP accepts, and because a number that verifies as
 * `+1 (333) 444-5555` and re-signs-in as `3334445555` would be two accounts.
 *
 * A BARE NUMBER IS READ AS US/CANADA. Cinch ships to the US App Store and the
 * field's own keyboard is a number pad with no `+` on it; asking every US user
 * to know their country code to satisfy the one international tester is the
 * wrong trade. Anyone else types `+` and their code, which the pad's paste
 * path and the `phone-pad` keyboard both allow.
 */

/** E.164's own bounds: a country code plus subscriber number, 8–15 digits. */
const E164 = /^\+[1-9]\d{7,14}$/;

/** Ten digits, first of area code and exchange each 2–9 — NANP's own shape. */
const NANP = /^[2-9]\d{2}[2-9]\d{6}$/;

/**
 * The one canonical form, or null for anything that has no honest reading.
 *
 * `null` rather than a thrown error or a best guess: the caller's question is
 * "can this be sent to the server", and a number this cannot shape is answered
 * by the field's refusal line, not by an exception.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (plus) {
    const candidate = `+${digits}`;
    return E164.test(candidate) ? candidate : null;
  }
  // 11 digits leading with 1 is a US number typed with its country code —
  // "13334445555" — which paste from Contacts produces constantly.
  if (digits.length === 11 && digits.startsWith('1') && NANP.test(digits.slice(1))) {
    return `+${digits}`;
  }
  if (NANP.test(digits)) return `+1${digits}`;
  return null;
}

export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

/**
 * The number as the code screen says it back — "Sent to (333) 444-5555".
 *
 * US numbers get the national convention because that is how their owners
 * recognise them; anything else is grouped E.164, which is at least honest.
 * Display only: nothing downstream parses this.
 */
export function formatPhoneForDisplay(e164: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (us) return `(${us[1]}) ${us[2]}-${us[3]}`;
  return e164;
}
