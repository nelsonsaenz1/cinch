import { TourPose } from '@/dev-fixtures/tour-pose';

/**
 * DEV ONLY · TR-01 — the promise, on the one dark ground.
 *
 * Deep-linkable: `cinch:///dev-tr-01-promise?composition=large`.
 *
 * The ink frame is the only one in the app, so it gets its own route: what is
 * checked here is whether the six-well plate, the clay eyebrow and the Skip
 * label survive being inverted — a different question from whether the deck
 * reads well.
 */
export default function DevTr01Promise() {
  return <TourPose id="TR-01" />;
}
