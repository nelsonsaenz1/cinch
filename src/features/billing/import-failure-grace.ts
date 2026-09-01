/**
 * The grace window after a failed import, during which Cinch does not ask for
 * money.
 *
 * On 2026-09-01 a production user spent fourteen hours failing to add clothes
 * (`clothes_import_failed / row_write_failed`, twenty times), and two minutes
 * after the last failure the app showed him `add_garment_over_limit` — a
 * paywall, in reply to a defect. The CMO ledger carries this as A16, and the
 * category's worst-reviewed competitor (Acloset) is worst-reviewed for exactly
 * this mechanic: charging at the moment adding clothes stopped working.
 *
 * So: for ten minutes after any terminal import failure, the garment-limit
 * paywall does not present. The rule is deliberately flat — it does not ask
 * WHY the import failed, because from the user's chair every reason reads the
 * same: the app dropped my photo and then asked me to pay. The cost of being
 * wrong is a delayed ask, which is the safe direction (`use-gate.ts` makes the
 * same trade for the same reason).
 *
 * The server's refusal is untouched. The closet limit is enforced by the
 * `items_enforce_limit` trigger, not by this module; suppressing the paywall
 * changes what is SHOWN at the refusal, never whether the refusal happens.
 * The caller's own "closet is full" copy remains on screen — `present()`
 * resolves 'unavailable', the outcome every call site already handles.
 *
 * MODULE STATE, NOT STORAGE, on purpose. The wound this covers is minutes old
 * by construction — the live repro was failure at 16:34, paywall at 16:36 —
 * and a process restart starting the window fresh is acceptable where a
 * storage read on the paywall's hot path is not.
 */

/** Ten minutes, per ledger item A16. */
export const IMPORT_FAILURE_GRACE_MS = 10 * 60 * 1000;

let lastFailureAtMs: number | null = null;

/**
 * Called by the upload queue at every TERMINAL failure — the same transitions
 * that emit `clothes_import_failed`, and only those. A retry that will run
 * again has not failed the user yet, and must not open the window.
 */
export function recordImportFailure(atMs: number = Date.now()): void {
  lastFailureAtMs = atMs;
}

/**
 * Whether an ask should hold its tongue right now.
 *
 * A clock that moved backwards makes the difference negative, which reads as
 * "within" — deliberately, because the failure mode of being wrong here is
 * one suppressed paywall, not one shown to a person the app just failed.
 */
export function withinImportFailureGrace(nowMs: number = Date.now()): boolean {
  return lastFailureAtMs !== null && nowMs - lastFailureAtMs < IMPORT_FAILURE_GRACE_MS;
}

/** Test seam. Production code has no business forgetting a failure. */
export function resetImportFailureGraceForTest(): void {
  lastFailureAtMs = null;
}
