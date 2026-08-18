import { NotAvailable, StFrame, ST_PIECES, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-12-restored`. Redesign 25.
 *
 * The light celebration. A warm mark, not confetti: the counts have moved by
 * one, the piece has left the grid, and the sentence states the thing that was
 * untrue the whole time it sat in storage — it can be styled again.
 */
const POSE: StPose = { items: ST_PIECES.slice(1), stored: 11, active: 139, activeLimit: 150, total: 150, totalLimit: 450, mark: "restored" };

export default function DevSt12() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-12" name="restored — a light warm confirmation" pose={POSE} />;
}
