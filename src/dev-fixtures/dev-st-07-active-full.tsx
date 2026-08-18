import { NotAvailable, StFrame, ST_PIECES, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-07-active-full`. Redesign 25.
 *
 * Active full, storage with room. The database WILL refuse a restore here, so
 * the control disarms rather than inviting a doomed tap, and the remedy offered
 * is the one that actually works: store an active piece.
 */
const POSE: StPose = { items: ST_PIECES, stored: 15, active: 10, activeLimit: 10, total: 25, totalLimit: 30, picked: 0 };

export default function DevSt07() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-07" name="active full — restore refused, action disarmed" pose={POSE} />;
}
