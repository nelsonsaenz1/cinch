import { NotAvailable, StFrame, ST_PIECES, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-10-two-ways`. Redesign 25.
 *
 * The both-full recovery sheet, reached from that notice’s action. Storing is
 * the filled path and plans are secondary. The artifact’s third line —
 * permanent deletion — is absent: this route carries no destructive
 * confirmation, and the artifact’s own deviation note says ship without it
 * rather than add an unconfirmed delete.
 */
const POSE: StPose = { items: ST_PIECES, stored: 20, active: 10, activeLimit: 10, total: 30, totalLimit: 30, sheet: "twoWays" };

export default function DevSt10() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-10" name="both full — two ways forward" pose={POSE} />;
}
