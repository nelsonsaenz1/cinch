import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-01 — a confirmed Standard member, every read landed.
 *
 * `cinch:///dev-mm-01-standard`. The frame `membership-standard-default`:
 * masthead, the two counted entitlements with their meters, the CHANGE plate
 * carrying the one upsell and the external cancel row, and the free-line note.
 *
 * ALSO THE AX FRAME. Every row here holds its arrangement at every Dynamic
 * Type size — label and figure wrap independently, and the meter is a band
 * under them rather than a column competing for width. Open it, set Larger
 * Text to AX-XXXL, and look again.
 */
export default function DevMm01Standard() {
  return <MmFrame />;
}
