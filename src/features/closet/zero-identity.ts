import { leading } from '@/theme/font-metrics';
import { MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/theme/type-scale';

/**
 * CI-01's copy and its line-box arithmetic — everything about the zero-piece
 * identity block that is not a render tree.
 *
 * A LEAF MODULE, and load-bearing that it stays one. Nothing here may import
 * React Native, `expo-*`, or any component: the unit suite bundles each test
 * for Node with esbuild, which cannot parse React Native's Flow source, so a
 * single transitive import of `react-native` would make the arithmetic below
 * untestable — and `zeroLeading` is the one part of this block that has a right
 * and a wrong answer rather than a look. The same split, and the same reason,
 * as `intake-routes.ts` and `camera-copy.ts`.
 */

/**
 * No display name yet — the page still has to be about something.
 *
 * Deliberately the same words as the eyebrow above it. A first-run reader with
 * no profile sees one heading rather than a heading and an apology, and the
 * moment they set a name the eyebrow stops being the page's only title.
 */
export const ZERO_NAME_FALLBACK = 'Your closet';

/**
 * No bio yet.
 *
 * A cue, not a placeholder bio: it names the two fields that are missing and
 * the reason to fill them. Written out here rather than composed, because CI-01
 * specifies this sentence exactly and a composed version would drift.
 */
export const ZERO_BIO_CUE = 'Add your name and photo so friends recognise you.';

/** The one control in the block, named for what it opens. */
export const EDIT_PROFILE_LABEL = 'Edit profile';

/** CI-01's diameter. Larger than C-01's 66 — at zero this is the page's subject. */
export const AVATAR_SIZE = 72;

/**
 * The scale at which a row of controls stops fitting across a 353pt measure,
 * and the point CI-03 grows the edit control to 56.
 *
 * The top of iOS's STANDARD Dynamic Type range: above it, every reader is in
 * the accessibility sizes. Deliberately NOT `AX3_FONT_SCALE` (2.35), which
 * marks where the Today greeting yields to the outfit — a different decision
 * about a different thing, and four points further up the scale than the place
 * a 44pt control starts to feel small under 25pt type.
 */
export const LARGE_TEXT_SCALE = 1.35;

/** CI-03's floor for the edit control once type is at accessibility sizes. */
export const EDIT_TAP_TARGET_LARGE = 56;

/** The three hand-set sizes CI-01 draws. */
export const NAME_SIZE = 30;
export const HANDLE_SIZE = 14;
export const BIO_SIZE = 15;

/**
 * The line box each of those sizes needs, at the standard setting.
 *
 * ── WHY THESE ARE COMPUTED, AND WHY THEY ARE SCALED BELOW ─────────────────
 *
 * `Text`'s variants carry NUMERIC line heights derived from the real font
 * metrics. React Native scales `fontSize` with Dynamic Type but leaves an
 * explicit `lineHeight` exactly where it found it — so a hand-written size
 * override inherits a line box built for the ORIGINAL size, and at
 * accessibility settings the glyphs overflow it and wrapped lines overlap.
 * That is the defect CI-03 refuses ("at AX3+, no clipping"), and it is the same
 * one the first-ten chooser was corrected for.
 *
 * So each box is `leading()` — the very helper `tailwind.config.js` computes
 * the variants with — evaluated at the size drawn here, at that variant's own
 * ratio. A change to the font metrics moves the variants and these together.
 */
const BASE_LINE_HEIGHT = {
  /** Instrument Serif at the `title` ratio. */
  name: leading('instrument', NAME_SIZE, 1.08),
  /** Helvetica at the `label` ratio. */
  handle: leading('helvetica', HANDLE_SIZE, 1.4),
  /** Helvetica at the `body` ratio — this one is prose and wants the room. */
  bio: leading('helvetica', BIO_SIZE, 1.5),
} as const;

export type ZeroLeading = Record<keyof typeof BASE_LINE_HEIGHT, number>;

/**
 * The line boxes at a given Dynamic Type scale, capped per role.
 *
 * `name` takes `MAX_DISPLAY_SCALE` because `Text` caps the serif display
 * variants there; handle and bio take `MAX_TEXT_SCALE` for the same reason in
 * the other direction. Capping a box with a different number than the glyph
 * inside it would reintroduce the overflow from the other side.
 *
 * Rounded, so at scale 1 every value returns the untouched design.
 */
export function zeroLeading(fontScale: number): ZeroLeading {
  const display = Math.min(fontScale, MAX_DISPLAY_SCALE);
  const text = Math.min(fontScale, MAX_TEXT_SCALE);
  return {
    name: Math.round(BASE_LINE_HEIGHT.name * display),
    handle: Math.round(BASE_LINE_HEIGHT.handle * text),
    bio: Math.round(BASE_LINE_HEIGHT.bio * text),
  };
}
