import { AvFrame } from './av-frames';

/**
 * DEV ONLY · AV-04 — the read failed and there is nothing cached.
 *
 * `cinch:///dev-av-04-read-error`. A blush card where the offline banner sits,
 * never a full-page apology, and never dressed as an empty inbox: those two look
 * identical from the outside and mean opposite things.
 *
 * The copy is the frame's and it answers the fear rather than the fault — "your
 * activity is safe on the server" is what a reader looking at a blank inbox
 * actually needs to hear, where "check your connection" answered a question
 * nobody was asking.
 */
export default function DevAv04ReadError() {
  return <AvFrame status="error" sections={[]} lastUpdated="5 hours ago" />;
}
