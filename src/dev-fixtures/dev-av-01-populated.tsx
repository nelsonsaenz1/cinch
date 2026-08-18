import { AvFrame, POPULATED } from './av-frames';

/**
 * DEV ONLY · AV-01 — the populated timeline, both sources, `New` over `Earlier`.
 *
 * `cinch:///dev-av-01-populated`. The frame the page brief describes: a face, one
 * written sentence, the day under it, and a warm dot at the trailing edge on the
 * three rows nobody has read. The borrow request in `New` comes from
 * `activity_feed()` and the invitation above it from `activity_events`; they are
 * drawn by two different components and the seam is meant to be invisible.
 *
 * ALSO THE AX FRAME. Redesign 28's row holds one arrangement at every Dynamic
 * Type size, so the accessibility state of this page is this page with the
 * system text size turned up — there is no second layout to pose. Open it, then
 * set Larger Text to AX-XXXL and look again.
 */
export default function DevAv01Populated() {
  return <AvFrame status="ready" sections={POPULATED} />;
}
