import { AcFrame, NotAvailable, type AcPose } from '@/dev-fixtures/ac-frames';

/**
 * Add clothes fixture — `cinch://dev-ac-05-consent-declined`. Redesign 23.
 *
 * A working mode, not a dead end: photographs stay on the device and the owner
 * tags them. The choice is reversible, and the way back is the action under
 * the sentence.
 *
 * Posed inert through `ac-frames.tsx`, which draws the real primitives and
 * reads the real copy tables; only the state is faked.
 */
const POSE: AcPose = { lead: false, camera: 'open', declined: true, used: 12, limit: 30 };

export default function DevAc05ConsentDeclined() {
  if (!__DEV__) return <NotAvailable />;
  return <AcFrame id="AC-05" name="processing consent declined — local mode" pose={POSE} />;
}
