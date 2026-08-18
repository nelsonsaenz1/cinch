import { AcFrame, NotAvailable, type AcPose } from '@/dev-fixtures/ac-frames';

/**
 * Add clothes fixture — `cinch://dev-ac-04-camera-unavailable`. Redesign 23.
 *
 * A different cause and a different remedy: updating, not Settings. Offering a
 * Settings control that cannot help would be a lie told to the one reader who
 * cannot check it.
 *
 * Posed inert through `ac-frames.tsx`, which draws the real primitives and
 * reads the real copy tables; only the state is faked.
 */
const POSE: AcPose = { lead: false, camera: 'no-module', used: 12, limit: 30 };

export default function DevAc04CameraUnavailable() {
  if (!__DEV__) return <NotAvailable />;
  return <AcFrame id="AC-04" name="no camera module in this build" pose={POSE} />;
}
