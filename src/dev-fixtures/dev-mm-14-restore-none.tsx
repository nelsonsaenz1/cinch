import { MM_NONE, MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-14 — nothing to restore.
 *
 * `cinch:///dev-mm-14-restore-none`. The frame `membership-restore-none-found`.
 * The store ANSWERED, and the answer was no purchase — which is not a failure,
 * and the sentence has to say so or a reader concludes their membership
 * vanished. The real cause, an Apple Account scope, is named.
 */
export default function DevMm14RestoreNone() {
  return <MmFrame restoreAvailable restoreEnding={MM_NONE} />;
}
