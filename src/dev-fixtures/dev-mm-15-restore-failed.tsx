import { MM_FAILED, MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-15 — the restore failed.
 *
 * `cinch:///dev-mm-15-restore-failed`. The frame
 * `membership-restore-failed-retry`. A connection problem, not a purchase
 * problem: nothing has changed on the membership, and the retry is offered in
 * place rather than sending anybody back to look for the row.
 */
export default function DevMm15RestoreFailed() {
  return <MmFrame restoreAvailable restoreEnding={MM_FAILED} />;
}
