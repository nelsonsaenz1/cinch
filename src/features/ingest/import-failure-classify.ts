/**
 * The bounded vocabulary for `clothes_import_failed` — pure, so it can be
 * tested without the queue, the store or the network behind them.
 *
 * `job.error` is a DIAGNOSTIC string: it holds the Edge Function's sentence,
 * a Supabase error message, or whatever a thrown `Error` carried, and any of
 * those can embed a path, an id or a server detail. It is read here and never
 * sent — see the privacy note at the top of `lib/posthog.tsx`. Everything
 * unrecognised lands on 'unknown' rather than leaking, and 'unknown' rising is
 * itself the signal that a new failure mode needs a name here.
 */

/**
 * The one consent-refusal sentence, written to be TRUE for both people who
 * can receive it. `ai_consent_required` covers a user who turned tagging off
 * AND a user whose recorded consent predates a policy-version bump (their
 * version is non-null but below current — they never opted out, the text
 * changed under them). "Turned off for your account" was a lie to the second
 * group; "needs your OK in Settings" is a fact and an invitation for both,
 * without an async profile read inside sync classification.
 */
export const CONSENT_WITHDRAWN_MESSAGE =
  'Saved, but not tagged — AI tagging needs your OK in Settings.';

/** The row-write throw sites' own prefixes (`upload-queue.ts`). */
const ROW_WRITE = /Could not create item|Could not record upload/i;

/**
 * Whether a row-write failure was the server refusing a slot.
 *
 * Keyed on the message SENTINELS the triggers raise (`closet_limit_reached`,
 * `storage_limit_reached` — migration 20260808190100), never on the SQLSTATE:
 * both ceilings and every column CHECK raise `23514`, so the code alone cannot
 * tell a full closet from a malformed row. `commit_intake_session` and
 * `classifyDenial` (use-gate.ts) already match the same words.
 */
export function isCapacityRefusal(error: string | undefined): boolean {
  return /closet_limit_reached|storage_limit_reached/.test(error ?? '');
}

/**
 * Eleven values, and that is the whole vocabulary:
 *   consent_missing · unverified_session · quota_exhausted · item_missing ·
 *   bad_request · photo_unreadable · closet_limit_reached ·
 *   storage_limit_reached · row_write_failed · not_signed_in · unknown
 *
 * The two ceilings are named BEFORE `row_write_failed` on purpose: for a
 * month every refused slot read as a row-write defect, which is how a
 * free-tier boundary spent 2026-09-01 being investigated as a runtime bug
 * (ledger A15/A28).
 */
export function analyticsFailureReason(error: string | undefined): string {
  const raw = error ?? '';
  if (!raw) return 'unknown';

  // Account-level refusals from `classify()`, in its own order.
  if (raw === CONSENT_WITHDRAWN_MESSAGE || raw.includes('ai_consent_required')) {
    return 'consent_missing';
  }
  if (raw.includes('couldn’t verify your account')) return 'unverified_session';
  if (raw.includes('tagging allowance')) return 'quota_exhausted';
  if (raw.includes('find this garment')) return 'item_missing';
  if (raw.includes('read this request')) return 'bad_request';

  // The server's refusals, before the local-pipeline patterns: a refusal
  // message is the trigger's own words and must not be mistaken for a
  // photograph problem by a stray verb.
  if (raw.includes('closet_limit_reached')) return 'closet_limit_reached';
  if (raw.includes('storage_limit_reached')) return 'storage_limit_reached';
  if (ROW_WRITE.test(raw)) return 'row_write_failed';

  // Local pipeline failures, thrown rather than returned.
  if (/decode|unsupported|corrupt|read the image|prepare/i.test(raw)) return 'photo_unreadable';
  if (raw.includes('Not signed in')) return 'not_signed_in';

  return 'unknown';
}

/**
 * The database's own word for WHY a row write failed, as a bounded property.
 *
 * The row-write throw sites embed the SQLSTATE in brackets — `[23514]`,
 * `[PGRST301]`, `[no_code]` — and this extracts exactly that token and nothing
 * else. SQLSTATE and PostgREST codes are a fixed vocabulary, which is what
 * makes this sendable where the message itself is not.
 *
 * Three non-code tokens, kept distinct because they mean different things:
 *   no_code   — the error object carried no code at all
 *   net_error — postgrest-js answered with an EMPTY code, which is its shape
 *               for a transport failure (the request never reached Postgres)
 *   undefined — not a row-write failure; nothing to report
 */
export function analyticsFailureCode(error: string | undefined): string | undefined {
  const raw = error ?? '';
  if (!ROW_WRITE.test(raw)) return undefined;
  if (/\[\]/.test(raw)) return 'net_error';
  const match = /\[([0-9A-Za-z_]{1,12})\]/.exec(raw);
  return match ? match[1] : 'no_code';
}
