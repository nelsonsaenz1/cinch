import { MuFrame } from './mm-frames';

/**
 * DEV ONLY · MM-18 — opening the vendor paywall.
 *
 * `cinch:///dev-mm-18-upgrade-opening`. The frame `upgrade-opening-paywall`:
 * both controls lock and the label says LOADING rather than implying a
 * purchase began. Nothing has been charged and nothing has been started.
 */
export default function DevMm18UpgradeOpening() {
  return <MuFrame opening />;
}
