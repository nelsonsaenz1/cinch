import { NotAvailable, StFrame, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-04-empty`. Redesign 25.
 *
 * Nothing stored. Drawn garments rather than a paragraph, and the arithmetic
 * still prints — the stored clause is worded ("Nothing stored") rather than a
 * zero, which would read as a failed count.
 */
const POSE: StPose = { items: [], stored: 0, active: 138, activeLimit: 150, total: 138, totalLimit: 450, body: "empty" };

export default function DevSt04() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-04" name="empty — nothing put away yet" pose={POSE} />;
}
