/**
 * SearchField's geometry, as data. Audit item 49.
 *
 * Closet, Lately and Friends each hand-typed the same eight lines for this
 * field — down to the literal `paddingVertical: 11` — before it became a
 * component. These constants are what stopped that drift, so they are the
 * thing to pin: a silent change to one of them re-opens the divergence the
 * component was extracted to close.
 *
 * The line heights come from `theme/font-metrics`, not from a typed number:
 * a `TextInput` that names a size and no line box gets whatever CoreText
 * gives it, and on the door field that was a point under the face's own
 * floor. See `INPUT_LINE_HEIGHT` below.
 *
 * The clear disc is the interesting one. It is 17pt DRAWN and 44pt TOUCHED
 * (`hitSlop: 14` on each edge, 17 + 28 = 45). A future edit that shrinks the
 * disc without growing the slop leaves a control under the accessibility floor
 * with nothing on screen to show it — which is exactly what `clearTouchSize`
 * below computes and the test asserts.
 */

import { leading } from '@/theme/font-metrics';

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

/**
 * ─── THE LINE BOX, AND THE BUG IT CLOSES ───────────────────────────────────
 *
 * The door field's placeholder was clipped along its bottom edge on Closet,
 * and the arithmetic says why. The field declared a font size and a padding
 * and no line height at all, so the text rect was whatever CoreText handed
 * back for Helvetica Neue at 16 — 19pt, rounded down from the face's own
 * 1.2 line box of 19.2. `theme/font-metrics.js` calls that floor by name:
 * below it "the space is taken off the TOP", and what a reader reports is not
 * "clipping" but "the text looks slightly wrong".
 *
 * Two conditions have to hold and neither did:
 *
 *   1. the text rect must be at least `minLineHeight('helvetica', 16)` = 20.
 *      19 is under it by a point, every time, on every screen using the door.
 *   2. the padded box must be a real 44pt target. 11 + 19 + 11 is 41, which
 *      is why Closet was passing `min-h-[44px]` by hand at its call site —
 *      a caller patching a number the spec should have owned. That patch grew
 *      the CONTAINER to 44 and left the input's own text rect at 19, so the
 *      glyphs stayed clipped inside a box that now looked tall enough.
 *
 * Stating the line height fixes both at once, and the two numbers agree
 * without being made to: `leading('helvetica', 16, 1.4)` is 22, and
 * 11 + 22 + 11 is exactly the 44 Closet was asking for. The door's height is
 * now DERIVED from its own type rather than asserted by whoever mounts it.
 *
 * `INPUT_FONT_SIZE` and `INPUT_PADDING_Y` are untouched — they are the two
 * values `tests/search-field-spec.test.ts` pins, and the fix does not need
 * either to move.
 */
export const INPUT_LINE_HEIGHT = leading('helvetica', INPUT_FONT_SIZE, 1.4);

/** 11 + 22 + 11. The door's 44pt target, computed rather than hand-typed. */
export const DOOR_HEIGHT = INPUT_PADDING_Y * 2 + INPUT_LINE_HEIGHT;

/** What a finger actually gets: the disc plus its slop on both sides. */
export const clearTouchSize = () => CLEAR_SIZE + CLEAR_HIT_SLOP * 2;

/**
 * Whether the clear disc is drawn at all.
 *
 * Emptiness is the only condition — never focus. A clear button that appears
 * on focus and vanishes on blur moves the text's right edge under the cursor.
 */
export const showsClear = (value: string) => value.length > 0;

/**
 * ─── THE PAGE FIELD ────────────────────────────────────────────────────────
 *
 * People Search's accepted redesign (09, 2026-08-17) draws a field this
 * component deliberately did not have: taller, set at reading size, and
 * ringed in oxblood while it holds the caret. The frames are unambiguous
 * about it — the field IS the page's subject there, where on Closet and
 * Lately it is a door in a corner of somebody else's screen.
 *
 * WHY OPT-IN PROPS RATHER THAN A SECOND COMPONENT
 *
 * The reason this component exists at all is that three screens hand-typed
 * the same eight lines and drifted. A `people-search-field.tsx` would be the
 * fourth copy with a different name, and it would drift the same way. So the
 * variation lives here, off by default: Closet, Lately and Friends render
 * byte-identically to before, and the one screen the redesign speaks about
 * asks for the difference by name.
 *
 * WHY THE FOCUS RING IS STILL NOT THE DEFAULT
 *
 * The note above stands where it was written: "the Closet atlas shows the
 * active field bare, and one field keeps one grammar." That grammar is about
 * a field sitting in a page's masthead. A page whose entire job is the query
 * is a different argument, and it is the one the accepted frames make.
 */

/** Reading size — the page field is the subject, not a door. */
export const PAGE_INPUT_FONT_SIZE = 17;

/**
 * The page field's line box — 24, by the same rule as the door's.
 *
 * This one was never clipping (11 + 24 + 11 is 46, under `PAGE_HEIGHT`'s 50,
 * so the minimum height was doing the centring), but it is stated for the
 * same reason: a field that names a size and no line box is one system font
 * change away from the door's bug.
 */
export const PAGE_INPUT_LINE_HEIGHT = leading('helvetica', PAGE_INPUT_FONT_SIZE, 1.4);

/** Drawn height of the page field. */
export const PAGE_HEIGHT = 50;

/** The page field's corner. Larger than `md` because the box is larger. */
export const PAGE_RADIUS = 15;

/** The oxblood ring, drawn only while the field holds the caret. */
export const PAGE_FOCUS_BORDER = 1.5;

/**
 * Whether the oxblood ring is drawn.
 *
 * Focus alone, never content: a ring that also tracked emptiness would flicker
 * on at the first keystroke of a field that was already the user's subject.
 */
export const showsFocusRing = (focused: boolean) => focused;
