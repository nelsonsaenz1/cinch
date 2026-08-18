import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-04 — the subscription read in flight.
 *
 * `cinch:///dev-mm-04-reading`. The frame `membership-loading`: "Checking…" in
 * the plate position and skeletons where the counts will land. No tier is
 * guessed, and the page keeps its shape so nothing jumps when the answer
 * arrives.
 */
export default function DevMm04Reading() {
  return <MmFrame loading />;
}
