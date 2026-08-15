/**
 * What the event detail page changes about itself at large Dynamic Type (LP-09).
 *
 * Three decisions, pulled out of the components that make them so they can be
 * CALLED. Each one was a constant in the markup — `trim`, `numberOfLines={2}`,
 * a `flex-row` — and each was correct for the type size it was written at and
 * wrong two steps up. A constant in JSX cannot be tested from a Node runner;
 * a function of `fontScale` can, which is the whole reason this file exists.
 *
 * READ FROM `useWindowDimensions().fontScale`, never guessed and never inferred
 * from a measured text height. It is the user's real setting and re-renders on
 * change like any other window dimension.
 *
 * THE DEFAULT COMPOSITION IS UNTOUCHED. Every function below returns exactly
 * what the markup used to hard-code while `fontScale` sits in the standard
 * range, so the page a reader at the default size sees is the page LP-04
 * accepted — same order, same hierarchy, same clamps. These are large-type
 * behaviours, not a redesign.
 *
 * NOTHING HERE SHRINKS TEXT. The accessibility note this packet inherits says
 * it in one line: "In every case composition changes and height is allowed.
 * Nothing is capped, truncated, ellipsised or scaled below its documented
 * size." Growing the page and letting it scroll is the answer; a smaller font
 * is not.
 */

import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';

/**
 * Whether the page title keeps its cap-trim.
 *
 * `trim` collapses a line box to the cap height with negative margins, and the
 * table it reads from is SINGLE-LINE GEOMETRY — `Text`'s own prop says so:
 * "display text only". A one-line title is what a 28pt serif is at the default
 * size, so the trim is right there. Two steps up the same title wraps, and a
 * margin sized for one line is subtracted from a box holding three: the
 * continuation is pulled under whatever follows it and the sentence loses its
 * end.
 *
 * The same switch the Today greeting already rides (`trim={!ax}` in
 * `(tabs)/index.tsx`) — "the greeting sheds its cap-trim to reflow" — at the
 * same threshold, because it is the same failure on a different page.
 */
export function detailTitleTrimmed(fontScale: number): boolean {
  return fontScale < AX_FONT_SCALE;
}

/**
 * How many lines the look's name and descriptor may take, or `undefined` for
 * as many as they need.
 *
 * Two was already a correction — it used to be one, and the card's own comment
 * records why that was wrong: "a caption the wearer typed is the look's name,
 * and at AX3 a one-line clamp turns it into an ellipsis on a card whose whole
 * job is to show what they chose." The same sentence is the argument against
 * two. At the accessibility sizes a typed caption runs past two lines and the
 * clamp does exactly what the packet forbids — truncates content — so above
 * the threshold there is no clamp at all and the card grows.
 *
 * Below it, two lines stay: at standard sizes the clamp keeps the card compact
 * without ever being reached by a real caption.
 */
export function lookTextMaxLines(fontScale: number): number | undefined {
  return fontScale >= AX_FONT_SCALE ? undefined : 2;
}

/**
 * Whether `Your look`'s two actions stack instead of sharing a row.
 *
 * `Swap a piece` and `Share another` split one measure between them. At 1.5
 * each pill is holding three words in about 150pt, which is where a label
 * stops fitting and starts overflowing its own ground — the same argument, at
 * the same number, that `AX_STACK_SCALE` was written for in the closet: one
 * threshold, so the app becomes its large-type self once rather than screen by
 * screen.
 *
 * Stacked, each action gets the full width and its label wraps inside the pill
 * rather than past it. Order is preserved — swap, then share — because the
 * primary action does not change with the type size.
 */
export function lookActionsStacked(fontScale: number): boolean {
  return fontScale >= AX_STACK_SCALE;
}
