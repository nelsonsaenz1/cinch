import { NotAvailable, StFrame, ST_PIECES, type StPose } from "@/dev-fixtures/st-frames";

/**
 * Storage fixture — `cinch://dev-st-11-chooser`. Redesign 25.
 *
 * The chooser. Rows carry the real plate and the real name, and the sheet says
 * what activation MEANS before anything is written — this replaced an
 * `ActionSheetIOS` list of bare strings, in which you chose a coat without
 * seeing the coat.
 */
const POSE: StPose = { items: ST_PIECES, stored: 12, active: 138, activeLimit: 150, total: 150, totalLimit: 450, sheet: "chooser" };

export default function DevSt11() {
  if (!__DEV__) return <NotAvailable />;
  return <StFrame id="ST-11" name="chooser — pick by looking" pose={POSE} />;
}
