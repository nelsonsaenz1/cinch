/**
 * What the New Event form changes about itself at large Dynamic Type.
 *
 * The sibling of `detail-layout.ts`, written for the same reason and to the
 * same rules: each decision below was a constant sitting in JSX — a `width`, a
 * `numberOfLines={2}`, a `flex-row` — each correct at the size it was written
 * at and wrong two steps up, and none of them testable from a Node runner
 * while it lived in the markup. A function of `fontScale` can be called.
 *
 * READ FROM `useWindowDimensions().fontScale`, never guessed and never inferred
 * from a measured text height. It is the reader's real setting and re-renders
 * on change like any other window dimension.
 *
 * THE DEFAULT COMPOSITION IS UNTOUCHED. Every function here returns what the
 * markup used to hard-code while `fontScale` sits in the standard range, so the
 * form a reader at the default size sees is the one the New Occasion atlas
 * accepted — same order, same two-across When row, same clamps.
 *
 * NOTHING HERE SHRINKS TEXT, per the accessibility note this page inherits:
 * "In every case composition changes and height is allowed. Nothing is capped,
 * truncated, ellipsised or scaled below its documented size."
 *
 * ── The measurements these thresholds come from ────────────────────────────
 *
 * Taken against real Helvetica Neue metrics on the 393pt design width, so the
 * numbers below are measured rather than estimated. Page measure is 353
 * (393 − two 20pt gutters); a field box spends 30 of it on padding and border.
 *
 *   fontScale   `12:30pm` in the old fixed 118pt time button (88pt of text)
 *   ─────────   ─────────────────────────────────────────────────────────────
 *   1.00         67.1pt   fits
 *   1.15         77.2pt   fits
 *   1.35         90.6pt   OVERFLOWS — and 1.35 is the top of the STANDARD
 *                         range, reached without touching an accessibility size
 *   1.80        120.8pt   overflows by a third of the control
 *
 * That is the truncation this module exists to remove: a fixed width is a
 * promise about how wide a formatted time is, and neither Dynamic Type nor
 * `toLocaleTimeString` lets the app keep it.
 */

import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';

/**
 * The time control's FLOOR, never its width.
 *
 * 118 is the atlas's own number and it survives as a `minWidth`, which is the
 * same correction `occasion-field.tsx` already applied to the box's height:
 * "a minimum height, and no assumption about the font at all." At the default
 * size the floor governs and the When row is drawn exactly as accepted — date
 * taking the rest of the measure, time at 118 beside it. Above it the control
 * grows under its own text instead of cutting it.
 */
export const TIME_CONTROL_MIN_WIDTH = 118;

/**
 * Whether the date and time controls stack instead of sharing a row.
 *
 * `AX_STACK_SCALE` (1.5), not a threshold of this page's own: the closet
 * settled that number for exactly this shape — labelled controls that stop
 * fitting side by side across one measure — and the argument written there is
 * that "one threshold means one moment where the app visibly becomes its
 * large-type self" rather than three screens relayouting at three different
 * points on the slider.
 *
 * Measured, with the time control on its floor rather than its old fixed
 * width, the date control keeps 158.9pt of text at 1.5 against the 127.5pt its
 * widest honest value needs — so 1.5 is the last step that fits, and a longer
 * locale format has no room at all. At 1.8 it is 133.7 against 153.0 and the
 * row is over.
 *
 * Stacked, each control takes the full measure and its own value wraps inside
 * it. Order is preserved — date, then time — because which one is asked first
 * does not change with the type size.
 */
export function whenControlsStacked(fontScale: number): boolean {
  return fontScale >= AX_STACK_SCALE;
}

/**
 * How many lines a value inside a field control may take, or `undefined` for as
 * many as it needs.
 *
 * The rule `detail-layout.ts` reached for the look's caption, applied to the
 * three places on this form that were clamping content the reader typed or
 * chose: the date and time buttons, and the rows of the place panel.
 *
 * Below the threshold the clamp keeps a suggestion list scannable and is never
 * actually reached — two lines of `body` hold about eighty characters across
 * this measure, and no venue MapKit returns is that long. At and above it a
 * clamp does the one thing the accessibility contract forbids, so there is
 * none, and the row grows instead. EventCard settled the same question in the
 * same direction: "a one-line clamp on a venue name is exactly the forced
 * truncation the stress board forbids… the venue is how somebody finds the
 * room."
 */
export function fieldValueMaxLines(fontScale: number): number | undefined {
  return fontScale >= AX_FONT_SCALE ? undefined : 2;
}
