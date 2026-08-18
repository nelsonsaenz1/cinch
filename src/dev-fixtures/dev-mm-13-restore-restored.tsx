import { MM_RESTORED, MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-13 — restored.
 *
 * `cinch:///dev-mm-13-restore-restored`. The frame `membership-restore-success`.
 * It names the TIER that came back — from the read, not from a generic "you're
 * all set" the reader cannot verify — and it is drawn in place rather than
 * raised as an alert, so the row that caused it is still on screen.
 */
export default function DevMm13RestoreRestored() {
  return <MmFrame restoreAvailable restoreEnding={MM_RESTORED} />;
}
