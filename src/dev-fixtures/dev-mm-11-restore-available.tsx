import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-11 — the restore row, offered.
 *
 * `cinch:///dev-mm-11-restore-available`. The frame
 * `membership-restore-available`. Drawn only where Superwall is configured; a
 * restore row that cannot reach StoreKit is a dead end wearing a chevron. It
 * carries no chevron here either, because it acts in place rather than leading
 * anywhere — `settings-row-spec.ts` records why.
 */
export default function DevMm11RestoreAvailable() {
  return <MmFrame restoreAvailable />;
}
