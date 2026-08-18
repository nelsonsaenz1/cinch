import { READING, SeFrame } from './se-frames';

/**
 * DEV ONLY · SE-03 — the subscription read is in flight.
 *
 * `cinch:///dev-se-03-membership-reading`. "Membership · Checking…", no chevron,
 * because there is nowhere honest to go yet. This state exists at all because
 * the silent fallback is indistinguishable from a real answer: before it, a
 * member on a slow network saw no membership row, which reads as "you are not a
 * member" — the app asserting something about somebody's money it had not read.
 */
export default function DevSe03MembershipReading() {
  return <SeFrame membership={READING} />;
}
