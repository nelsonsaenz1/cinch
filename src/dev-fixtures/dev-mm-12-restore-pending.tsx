import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-12 — the App Store is being asked.
 *
 * `cinch:///dev-mm-12-restore-pending`. The frame `membership-restore-pending`:
 * the row is locked and its sub-line says what is happening, and nothing is
 * claimed yet. The row does not DIM — a row greying under the thumb reads as
 * the tap being rejected.
 */
export default function DevMm12RestorePending() {
  return <MmFrame restoreAvailable restoring />;
}
