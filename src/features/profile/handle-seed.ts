/**
 * A handle for a person who never chose one — CMO ledger A54.
 *
 * ── WHAT PRODUCTION SAID ────────────────────────────────────────────────────
 *
 * The referral loop is one permanent link per person and the handle IS the
 * link (`features/invite/link.ts`). Nothing at sign-up asks for a handle, so
 * a person who reaches the invite screen — from the Today card the 09-06 ship
 * added, or any of the six other doors — lands on "Choose a handle first"
 * instead of a share sheet. On 09-13, **17 of the 22 real ten-piece closets
 * had no handle** (77%); three of that weekend's five new ten-closets had
 * none; `invite_shared` read 0 in seven days. Three quarters of the loop's
 * audience meets a form before the sheet.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 *
 * Seed one, then say so. The first time a handle is needed and none exists,
 * the app claims one on the person's behalf — from their display name, then
 * their email's local part, then a closet-prefixed stub — and tells them in
 * one line ("You're @dana on Cinch. Change it any time in Profile."). The
 * profile sheet's own handle field stays the way to change it; nothing here
 * removes a choice, it removes a blocking step.
 *
 * ── PURE, AND WHY ───────────────────────────────────────────────────────────
 *
 * This module produces the CANDIDATE LIST and nothing else, so
 * `tests/handle-seed.test.ts` can execute every rule under `node --test`.
 * Uniqueness is the database's alone (`profiles_username_key` on
 * `lower(username)`): the claim in `handle-seed-io.ts` walks this list in
 * order and lets the unique index refuse what is taken. Every candidate here
 * already satisfies `profiles_username_format` — the same `handleProblem`
 * the profile form runs — so the only refusal the walk can meet is "taken".
 *
 * The numeric suffix is derived from the account id rather than drawn at
 * random, so a retry produces the same list and two devices racing for the
 * same account converge on the same handle instead of two.
 */

import { HANDLE_MAX, HANDLE_MIN, handleProblem, normaliseHandle } from './handle';

export type SeedSource = 'name' | 'email' | 'fallback';

export interface SeedCandidate {
  /** Normalised (lowercase, no `@`), format-valid. */
  readonly handle: string;
  readonly source: SeedSource;
}

/** The most candidates a single claim will try before giving up. */
export const SEED_MAX_ATTEMPTS = 6;

/**
 * `"Dana Kowalski-Ng"` → `"danakowalskng"`: fold accents, keep letters, digits
 * and underscores, drop the rest. Null when what is left is too short to be a
 * handle — "Al" is a name, not a handle, and padding it would invent one.
 */
export function stemForHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const folded = raw
    .normalize('NFD')
    // Combining marks — the accents `normalize('NFD')` split off.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, HANDLE_MAX);
  return folded.length >= HANDLE_MIN ? folded : null;
}

/**
 * The part of an address a person would recognise as theirs: the local part,
 * with any `+tag` removed (`sim-test+ja@…` is `sim-test`, not `simtestja`).
 */
export function stemFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  const local = at === -1 ? email : email.slice(0, at);
  return stemForHandle(local.replace(/\+.*$/, ''));
}

/**
 * Three digits, 100–999, a pure function of the account id. Any account id
 * yields something; a malformed one yields a stable something.
 */
export function suffixFor(userId: string): string {
  const hex = userId.replace(/[^0-9a-f]/gi, '').slice(0, 6);
  const n = Number.parseInt(hex || '0', 16);
  return String(((Number.isFinite(n) ? n : 0) % 900) + 100);
}

/**
 * The candidates, in the order the claim should try them.
 *
 *   1. the display name
 *   2. the email's local part
 *   3–4. each of those with the account's three-digit suffix
 *   5. `closet_` + the first eight hex characters of the account id
 *   6. `closet_` + the first twelve
 *
 * De-duplicated, every entry format-valid, never empty: the two `closet_`
 * stubs are always valid for a UUID, and the list is bounded at
 * `SEED_MAX_ATTEMPTS` so a pathological run of collisions cannot become a
 * loop against the unique index.
 */
export function seedHandleCandidates(input: {
  displayName: string | null | undefined;
  email: string | null | undefined;
  userId: string;
}): SeedCandidate[] {
  const name = stemForHandle(input.displayName);
  const mail = stemFromEmail(input.email);
  const digits = suffixFor(input.userId);
  const hex = input.userId.replace(/[^0-9a-f]/gi, '').toLowerCase();

  const raw: [string | null, SeedSource][] = [
    [name, 'name'],
    [mail, 'email'],
    [name ? `${name.slice(0, HANDLE_MAX - digits.length)}${digits}` : null, 'name'],
    [mail ? `${mail.slice(0, HANDLE_MAX - digits.length)}${digits}` : null, 'email'],
    [`closet_${hex.slice(0, 8)}`, 'fallback'],
    [`closet_${hex.slice(0, 12)}`, 'fallback'],
  ];

  const seen = new Set<string>();
  const out: SeedCandidate[] = [];
  for (const [candidate, source] of raw) {
    if (!candidate) continue;
    const handle = normaliseHandle(candidate);
    if (seen.has(handle) || handleProblem(handle) !== null) continue;
    seen.add(handle);
    out.push({ handle, source });
  }
  return out.slice(0, SEED_MAX_ATTEMPTS);
}
