/**
 * The email address shape check, extracted pure so the screens, the auth
 * actions and the unit tests all agree on what "parses" means.
 *
 * Deliberately cheap: the real validation is the six-digit code arriving.
 * The check exists to arm the Continue button and to catch the obvious
 * typo class ("maya@hey") before a network round-trip is spent on it.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}
