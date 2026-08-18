import { NotAvailable, StFrame, ST_PIECES, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-02-free-arithmetic`. Redesign 25.
 *
 * The same grammar at Free ceilings, which is the point: the rule is the plan,
 * not the tier. 6 active of 10, 20 of 30 total, 14 stored.
 */
const POSE: StPose = { items: ST_PIECES, stored: 14, active: 6, activeLimit: 10, total: 20, totalLimit: 30 };

export default function DevSt02() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-02" name="free — same grammar, different scale" pose={POSE} />;
}
