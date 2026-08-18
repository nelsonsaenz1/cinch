import { NotAvailable, StFrame, ST_PIECES, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-03-capacity-unknown`. Redesign 25.
 *
 * Capacity not yet resolved. The stored count is real so it prints; both
 * ceiling clauses are OMITTED rather than shown as zero, a dash or a guess —
 * and the control stays armed, because unknown is not the same as full.
 */
const POSE: StPose = { items: ST_PIECES, stored: 12, active: null, activeLimit: null, total: null, totalLimit: null };

export default function DevSt03() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-03" name="capacity unknown — clauses omitted" pose={POSE} />;
}
