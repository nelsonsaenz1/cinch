import { MuFrame } from './mm-frames';

/**
 * DEV ONLY · MM-19 — the paywall was closed.
 *
 * `cinch:///dev-mm-19-upgrade-declined`. The frame
 * `upgrade-paywall-declined-return-unchanged`. A normal decline: one quiet line
 * confirms nothing was charged, and there is NO second ask anywhere on the
 * page. The page they came back to is still true.
 */
export default function DevMm19UpgradeDeclined() {
  return <MuFrame declined />;
}
