import { NotAvailable, StFrame, ST_PIECES, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-01-populated-standard`. Redesign 25.
 *
 * The resting screen on Standard. Twelve put away, room on both ceilings, so no
 * notice and an armed control. The three-part line is DERIVED here, not typed:
 * 138 + 12 = 150, which is the total clause, and 150/450 is Standard from
 * `plans.ts`.
 */
const POSE: StPose = { items: ST_PIECES, stored: 12, active: 138, activeLimit: 150, total: 150, totalLimit: 450 };

export default function DevSt01() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-01" name="populated — standard, room on both" pose={POSE} />;
}
