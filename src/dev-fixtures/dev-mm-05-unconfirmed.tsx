import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-05 — the read failed.
 *
 * `cinch:///dev-mm-05-unconfirmed`. The frame
 * `membership-unconfirmed-read-failed`. NEVER drawn as free: telling a paying
 * member they have no membership is the worst available lie on this page. No
 * alarm colour either — the server checks entitlements independently, so
 * nothing has been taken away while this cannot read.
 */
export default function DevMm05Unconfirmed() {
  return <MmFrame unconfirmed plan="free" currentPeriodEnd={null} />;
}
