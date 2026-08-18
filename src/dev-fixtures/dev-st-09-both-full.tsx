import { NotAvailable, StFrame, ST_PIECES, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-09-both-full`. Redesign 25.
 *
 * Both ceilings reached. Both numbers are stated and the copy points at the one
 * action that resolves it — freeing an active place is SUFFICIENT, so nothing
 * here offers deleting or upgrading as though it were required.
 */
const POSE: StPose = { items: ST_PIECES, stored: 20, active: 10, activeLimit: 10, total: 30, totalLimit: 30, picked: 0 };

export default function DevSt09() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-09" name="both full — storing is enough" pose={POSE} />;
}
