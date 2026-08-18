import { NotAvailable, StFrame, ST_PIECES, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-08-total-full`. Redesign 25.
 *
 * THE SUBTLE ONE. The total is full and the active side is not, and restoring
 * is still allowed — it moves a piece between two sides of a total it does not
 * change. The notice says so outright, because the reader assumes the opposite.
 */
const POSE: StPose = { items: ST_PIECES, stored: 24, active: 6, activeLimit: 10, total: 30, totalLimit: 30, picked: 0 };

export default function DevSt08() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-08" name="total full — restore still works" pose={POSE} />;
}
