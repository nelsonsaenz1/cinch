/**
 * The import's error-body reading, pure so tests can hold it.
 *
 * `use-catalogue-import.ts` owns the request; this module owns the one decision
 * made about a refused one: which outcome the body's `error` code means. It is
 * split out for the same reason `planCatalogueBatch` and `classifySearchFailure`
 * are — the mapping is where being wrong hurts (a fresh account whose first act
 * is a catalogue import was dead-ending on the generic sentence when the server
 * was actually asking for consent), and proving it must not need React or a
 * Supabase client in the test runner.
 */

/** CPV2-11 — refused before anything was written, with the numbers. */
export type CapacityRefusal = {
  code: 'closet_limit_reached' | 'storage_limit_reached';
  requested: number;
  /** Present on `closet_limit_reached`. */
  active?: number;
  activeLimit?: number;
  /** Present on `storage_limit_reached`. */
  total?: number;
  totalLimit?: number;
};

/**
 * Every way the server can say no, as the client understands it.
 *
 * `consent-required` is the Edge Function's `ai_consent_required` gate — the
 * import never started because no current AI-processing consent is on record.
 * It is NOT an error and must never wear the generic failure sentence: the
 * remedy is the existing consent sheet, not "try again in a moment".
 */
export type ImportErrorOutcome =
  | { status: 'refused'; refusal: CapacityRefusal }
  | { status: 'consent-required'; requiredVersion: number | null }
  | { status: 'error'; message: string };

export const GENERIC = "Those pieces couldn’t be added. Try again in a moment.";

/** Map a refused import's error body to its outcome. `body` is the parsed JSON
 *  of the HTTP error response, or null when it could not be read. */
export function classifyImportError(
  body: Record<string, unknown> | null,
  requested: number,
): ImportErrorOutcome {
  const code = body?.error;

  if (code === 'ai_consent_required') {
    return {
      status: 'consent-required',
      requiredVersion:
        typeof body?.requiredVersion === 'number' ? body.requiredVersion : null,
    };
  }

  if (code === 'closet_limit_reached' || code === 'storage_limit_reached') {
    // CPV2-11 draws the numbers, so they are carried rather than flattened
    // into a sentence.
    return {
      status: 'refused',
      refusal: {
        code,
        requested: Number(body?.requested ?? requested),
        active: body?.active === undefined ? undefined : Number(body.active),
        activeLimit: body?.activeLimit === undefined ? undefined : Number(body.activeLimit),
        total: body?.total === undefined ? undefined : Number(body.total),
        totalLimit: body?.totalLimit === undefined ? undefined : Number(body.totalLimit),
      },
    };
  }

  return { status: 'error', message: typeof body?.message === 'string' ? body.message : GENERIC };
}
