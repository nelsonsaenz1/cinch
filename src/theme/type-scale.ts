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
