import { AcFrame, NotAvailable, type AcPose } from '@/dev-fixtures/ac-frames';

/**
 * Add clothes fixture — `cinch://dev-ac-06-at-cap`. Redesign 23.
 *
 * The Ten is gone entirely rather than dimmed — a guided run at ten pieces has
 * nothing to offer at thirty — and all four peers stay available. Capacity is
 * settled after the garment exists, never at the door (W-02).
 *
 * Posed inert through `ac-frames.tsx`, which draws the real primitives and
 * reads the real copy tables; only the state is faked.
 */
const POSE: AcPose = { lead: false, camera: 'open', used: 30, limit: 30, full: true };

export default function DevAc06AtCap() {
  if (!__DEV__) return <NotAvailable />;
  return <AcFrame id="AC-06" name="at the ceiling — every door still open" pose={POSE} />;
}
