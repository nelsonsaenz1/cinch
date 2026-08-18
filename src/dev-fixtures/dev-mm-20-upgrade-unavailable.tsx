import { MuFrame } from './mm-frames';

/**
 * DEV ONLY · MM-20 — the paywall could not load.
 *
 * `cinch:///dev-mm-20-upgrade-unavailable`. The frame
 * `upgrade-paywall-unavailable`, carrying the exact shipped sentence
 * (`UPGRADE_UNAVAILABLE_LINE`). This is why the CTA is not a dead control:
 * `present()` resolves `unavailable` when no usable offer reached the reader,
 * the fail-safe in `use-gate.ts` tears the empty sheet down, and without this
 * branch they would be left with a button that appears to do nothing.
 */
export default function DevMm20UpgradeUnavailable() {
  return <MuFrame unavailable />;
}
