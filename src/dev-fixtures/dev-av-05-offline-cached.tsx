import { AvFrame, POPULATED } from './av-frames';

/**
 * DEV ONLY · AV-05 — offline, over a list the device already has.
 *
 * `cinch:///dev-av-05-offline-cached`. The banner sits ABOVE the rows and never
 * instead of them. A reader on a train wants yesterday's invitation, correctly
 * labelled as yesterday's, rather than an apology in front of data that is
 * already on the phone — and the line says what arrived before signal went, so
 * an absent row is not misread as a thing that never happened.
 */
export default function DevAv05OfflineCached() {
  return <AvFrame status="error" cached sections={POPULATED} />;
}
