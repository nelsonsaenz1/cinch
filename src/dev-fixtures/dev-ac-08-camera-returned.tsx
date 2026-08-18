import { AcFrame, NotAvailable, type AcPose } from '@/dev-fixtures/ac-frames';

/**
 * Add clothes fixture — `cinch://dev-ac-08-camera-returned`. Redesign 23.
 *
 * The notice flips to the real state. Nothing auto-launches the camera — the
 * owner presses when ready.
 *
 * Posed inert through `ac-frames.tsx`, which draws the real primitives and
 * reads the real copy tables; only the state is faked.
 */
const POSE: AcPose = { lead: false, camera: 'returned-granted', used: 12, limit: 30 };

export default function DevAc08CameraReturned() {
  if (!__DEV__) return <NotAvailable />;
  return <AcFrame id="AC-08" name="returned from Settings with access granted" pose={POSE} />;
}
