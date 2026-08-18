import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-16 — restore is not configured on this build.
 *
 * `cinch:///dev-mm-16-restore-unavailable`. The frame
 * `membership-restore-unavailable-row-absent`. No row at all — a control that
 * cannot work is worse than no control. `useRestorePurchases` answers
 * `available: false` in a keyless build, and this is that page.
 */
export default function DevMm16RestoreUnavailable() {
  return <MmFrame restoreAvailable={false} />;
}
