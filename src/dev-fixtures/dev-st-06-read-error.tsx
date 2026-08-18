import { NotAvailable, StFrame, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-06-read-error`. Redesign 25.
 *
 * The read failed, and this is explicitly NOT the empty state. It names that
 * the pieces are safe on the server, which is the fear this screen exists to
 * answer.
 */
const POSE: StPose = { items: [], stored: 0, active: null, activeLimit: null, total: null, totalLimit: null, body: "error" };

export default function DevSt06() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-06" name="read error — never an empty drawer" pose={POSE} />;
}
