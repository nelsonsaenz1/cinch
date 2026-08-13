/**
 * The two Dynamic Type ceilings, in one place.
 *
 * Audit items 38–43. Content scales with the reader's system setting — that is
 * not negotiable and a cap of 1 would be — but past a point a plate grid stops
 * being a plate grid, so the scaling is bounded rather than unbounded:
 *
 *   1.8  running text. Generous, because this is where legibility actually
 *        lives and body copy has room to reflow.
 *   1.4  display type — the wordmark, titles, plate headings, the big serif
 *        figures. These sit in fixed cells the layout draws around them, so the
 *        same multiplier that helps a paragraph pushes a heading out of its box.
 *
 * These lived in `components/auth/chrome.tsx`, which is why four call sites in
 * closet and social components wrote `1.4` as a literal instead: importing an
 * auth-chrome constant into a closet card is the wrong direction, so people
 * copied the number. A copied number is one that will be wrong after the next
 * change to the original. Here, nothing has to import anything it does not
 * already depend on.
 *
 * `Text` applies these automatically — a call site only needs one of these when
 * it is setting the multiplier on a raw `RNText`, a `TextInput`, or something
 * whose box is tighter than its variant assumes.
 */

/** Running text. */
export const MAX_TEXT_SCALE = 1.8;

/** Display type in a fixed cell — wordmark, title, plate, stat figure. */
export const MAX_DISPLAY_SCALE = 1.4;

/**
 * AX3 — where the Today greeting yields to the outfit (TM-03).
 *
 * iOS's Dynamic Type runs 0.88 … 1.35 across the standard sizes and then on
 * through five accessibility steps; AX3 (`accessibilityExtraLarge`) reports a
 * scale of about 2.35. TM-03 puts the greeting's removal there and not at the
 * top of the standard range: "at AX3 and above the greeting line is removed
 * rather than wrapped, the calendar control collapses into the profile sheet,
 * and the outfit name becomes the first thing on the screen."
 *
 * DELIBERATELY NOT `AX_FONT_SCALE` (1.35), which is a different decision about
 * a different thing — where a row of three labelled controls stops fitting
 * across a 353 pt measure. The greeting used to share that threshold and so
 * disappeared at the top of the STANDARD sizes, where it still fits perfectly
 * well now that the masthead controls have left its line.
 */
export const AX3_FONT_SCALE = 2.35;
