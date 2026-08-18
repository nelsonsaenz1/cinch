import { AcFrame, NotAvailable, type AcPose } from '@/dev-fixtures/ac-frames';

/**
 * Add clothes fixture — `cinch://dev-ac-01-default`. Redesign 23.
 *
 * The chooser at rest. Four peers at identical size, tint weight and target;
 * imagery is the only difference between them and nothing marks one as primary
 * or as a fallback.
 *
 * Posed inert through `ac-frames.tsx`, which draws the real primitives and
 * reads the real copy tables; only the state is faked.
 */
const POSE: AcPose = { lead: false, camera: 'open', used: 12, limit: 30 };

export default function DevAc01Default() {
  if (!__DEV__) return <NotAvailable />;
  return <AcFrame id="AC-01" name="default — four peers, no favourite" pose={POSE} />;
}
