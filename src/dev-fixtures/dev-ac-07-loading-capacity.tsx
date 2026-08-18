import { AcFrame, NotAvailable, type AcPose } from '@/dev-fixtures/ac-frames';

/**
 * Add clothes fixture — `cinch://dev-ac-07-loading-capacity`. Redesign 23.
 *
 * Every door is live: capacity has never gated entry. The colophon is simply
 * absent rather than showing a placeholder or a dash.
 *
 * Posed inert through `ac-frames.tsx`, which draws the real primitives and
 * reads the real copy tables; only the state is faked.
 */
const POSE: AcPose = { lead: false, camera: 'open', used: null, limit: 30 };

export default function DevAc07LoadingCapacity() {
  if (!__DEV__) return <NotAvailable />;
  return <AcFrame id="AC-07" name="capacity query unresolved" pose={POSE} />;
}
