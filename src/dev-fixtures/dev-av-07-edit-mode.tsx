import { AvFrame, POPULATED } from './av-frames';

/**
 * DEV ONLY · AV-07 — Edit mode.
 *
 * `cinch:///dev-av-07-edit-mode`. The visible equivalent of swipe and
 * long-press, so removal never requires a gesture — §11's rule, and the reason
 * this mode exists at all rather than being a convenience.
 *
 * Three things change in it and each is deliberate: the note above the list says
 * that removing a notice ANSWERS NOTHING (a reader clearing "Marisol invited you
 * to Sunday Roasts" has every reason to think they just declined an invitation,
 * and they did not); the stamps come off, because the question here is which row
 * to remove and a notice's age is not part of it; and Clear all sits at the foot
 * as a tinted 56pt bar with the weight held back for the confirmation sheet.
 */
export default function DevAv07EditMode() {
  return <AvFrame status="ready" sections={POPULATED} editing onToggleEdit={() => {}} onClearAll={() => {}} />;
}
