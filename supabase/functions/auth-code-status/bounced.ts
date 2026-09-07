/**
 * The pure half of auth-code-status — no Deno, so `tests/auth-code-bounce.test.ts`
 * executes it against a fixture page. See index.ts for the whole rule.
 */

/** The auth mailer's own subject, verbatim, so a support reply or a receipt never counts. */
export const SIGN_IN_SUBJECT = 'Your Cinch sign-in code';
/** How far back a bounce counts. The screen asks within the first half-minute. */
export const WINDOW_MS = 15 * 60 * 1000;

type ResendEmail = {
  to?: unknown;
  subject?: unknown;
  created_at?: unknown;
  last_event?: unknown;
};

/** The newest sign-in code sent to this address inside the window, if any. */
export function bouncedInWindow(
  page: unknown,
  address: string,
  now: number,
  windowMs = WINDOW_MS,
): boolean {
  const rows = (page as { data?: unknown })?.data;
  if (!Array.isArray(rows)) return false;
  for (const row of rows as ResendEmail[]) {
    if (row.subject !== SIGN_IN_SUBJECT) continue;
    const to = Array.isArray(row.to) ? row.to : [row.to];
    if (!to.some((t) => typeof t === 'string' && t.trim().toLowerCase() === address)) continue;
    const at = typeof row.created_at === 'string' ? Date.parse(row.created_at) : NaN;
    if (Number.isNaN(at) || now - at > windowMs) continue;
    // The newest matching send decides — a bounce followed by a delivered
    // resend to the same address is not a bounce any more.
    return row.last_event === 'bounced';
  }
  return false;
}

