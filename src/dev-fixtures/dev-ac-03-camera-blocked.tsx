import { AcFrame, NotAvailable, type AcPose } from '@/dev-fixtures/ac-frames';

/**
 * Add clothes fixture — `cinch://dev-ac-03-camera-blocked`. Redesign 23.
 *
 * The door holds its fixed position and its full width, names the cause without
 * blame, names the three doors that still work, and offers Settings. One
 * blocked method never blocks the screen.
 *
 * Posed inert through `ac-frames.tsx`, which draws the real primitives and
 * reads the real copy tables; only the state is faked.
 */
const POSE: AcPose = { lead: false, camera: 'blocked', used: 12, limit: 30 };

export default function DevAc03CameraBlocked() {
  if (!__DEV__) return <NotAvailable />;
  return <AcFrame id="AC-03" name="camera denied at the OS level" pose={POSE} />;
}
