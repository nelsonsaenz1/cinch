import { AcFrame, NotAvailable, type AcPose } from '@/dev-fixtures/ac-frames';

/**
 * Add clothes fixture — `cinch://dev-ac-02-lead-door`. Redesign 23.
 *
 * The Ten sits above the peers in oxblood: visually separate, never counted in
 * the peer sentence, and never presented as a fifth intake method.
 *
 * Posed inert through `ac-frames.tsx`, which draws the real primitives and
 * reads the real copy tables; only the state is faked.
 */
const POSE: AcPose = { lead: true, camera: 'open', used: 6, limit: 30 };

export default function DevAc02LeadDoor() {
  if (!__DEV__) return <NotAvailable />;
  return <AcFrame id="AC-02" name="the lead door — closet below its cap" pose={POSE} />;
}
