import { AvFrame } from './av-frames';

/**
 * DEV ONLY · AV-02 — nothing has arrived.
 *
 * `cinch:///dev-av-02-empty`. Two ranged-left lines and the colophon, which is
 * the point of the frame: the empty page is the state where the two claims at
 * the foot matter MOST, because "who else sees this" and "how long is it kept"
 * are exactly the questions a blank inbox raises. It used to be the one state
 * that had no colophon at all.
 *
 * No button. There is nothing here to do — the page fills because other people
 * did things — and a call to action would be this surface borrowing Explore's
 * job in order to have something to ask for.
 */
export default function DevAv02Empty() {
  return <AvFrame status="ready" sections={[]} />;
}
