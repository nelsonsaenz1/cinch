import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-09 — three stored slots left.
 *
 * `cinch:///dev-mm-09-stored-near-limit`. The frame
 * `membership-standard-stored-near-limit`. The stored ceiling has NO in-app
 * remedy — storing another piece is what counts against it — so this card says
 * what stored counts rather than offering "make room", which would be the dead
 * end `use-capacity.ts` split its two counts to remove. It also wins over the
 * active card when both are close, for that reason.
 */
export default function DevMm09StoredNearLimit() {
  return <MmFrame used={96} stored={447} />;
}
