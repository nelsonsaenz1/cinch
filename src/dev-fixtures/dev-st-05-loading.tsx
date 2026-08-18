import { NotAvailable, StFrame, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-05-loading`. Redesign 25.
 *
 * First read in flight. Plate-shaped skeletons in the real grid rhythm, and NO
 * capacity line at all: every figure in it is still unknown, so the screen
 * prints none of them rather than a partial one.
 */
const POSE: StPose = { items: [], stored: 0, active: null, activeLimit: null, total: null, totalLimit: null, body: "loading" };

export default function DevSt05() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-05" name="loading — no invented arithmetic" pose={POSE} />;
}
