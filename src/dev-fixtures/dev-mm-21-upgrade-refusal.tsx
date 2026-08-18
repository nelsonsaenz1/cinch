import { MuFrame } from './mm-frames';

/**
 * DEV ONLY · MM-21 — a deep link into the upgrade page from Pro.
 *
 * `cinch:///dev-mm-21-upgrade-refusal`. The frame
 * `upgrade-nonstandard-deep-link-refusal`. The row that leads here is drawn
 * only for a member who can actually make the move, so this state exists only
 * for a typed URL. Refused truthfully with a way back, rather than opening a
 * placement that could not apply to this account.
 */
export default function DevMm21UpgradeRefusal() {
  return <MuFrame plan="pro" />;
}
