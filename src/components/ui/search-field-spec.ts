/**
 * SearchField's geometry, as data. Audit item 49.
 *
 * Closet, Lately and Friends each hand-typed the same eight lines for this
 * field — down to the literal `paddingVertical: 11` — before it became a
 * component. These constants are what stopped that drift, so they are the
 * thing to pin: a silent change to one of them re-opens the divergence the
 * component was extracted to close.
 *
 * The clear disc is the interesting one. It is 17pt DRAWN and 44pt TOUCHED
 * (`hitSlop: 14` on each edge, 17 + 28 = 45). A future edit that shrinks the
 * disc without growing the slop leaves a control under the accessibility floor
 * with nothing on screen to show it — which is exactly what `clearTouchSize`
 * below computes and the test asserts.
 */

/** Warm ink at 18% — UIKit's own clear button is cool-toned on a warm page. */
export const CLEAR_FILL = 'rgba(28,26,22,0.18)';

/** The drawn diameter of the clear disc. */
export const CLEAR_SIZE = 17;

/** Slop on every edge of the clear disc. */
export const CLEAR_HIT_SLOP = 14;

/** 16px — a half-step under body, so the field reads as a door, not a page. */
export const INPUT_FONT_SIZE = 16;

/** The literal that was copied into three screens before this was a component. */
export const INPUT_PADDING_Y = 11;

/** What a finger actually gets: the disc plus its slop on both sides. */
export const clearTouchSize = () => CLEAR_SIZE + CLEAR_HIT_SLOP * 2;

/**
 * Whether the clear disc is drawn at all.
 *
 * Emptiness is the only condition — never focus. A clear button that appears
 * on focus and vanishes on blur moves the text's right edge under the cursor.
 */
export const showsClear = (value: string) => value.length > 0;
