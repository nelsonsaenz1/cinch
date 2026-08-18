import { DynamicColorIOS, Platform, useColorScheme, type ColorValue } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';

import { palette, type ColorSchemeName, type ThemeColors } from './palette';

/**
 * The single source of truth for colour values needed in *JavaScript* —
 * tab bar tints, icon colours, Skia canvas fills, status bar style.
 *
 * Styling itself goes through NativeWind `className`; this façade exists only
 * for the places React Native needs a literal colour. There are no `dark:`
 * variants — the app is light-only and audit item 51 removed the last of them.
 *
 * Keeping every consumer behind `useTheme()` is deliberate: NativeWind v5 is
 * still a preview and will eventually change how themes are expressed. When it
 * stabilises, this file is the only one that has to change.
 *
 * Values here must stay in sync with tailwind.config.js.
 */

/**
 * The palette itself lives in `./palette.ts` — pure data, no React Native
 * import — so that the contrast proof in `./contrast.ts` and the tests that run
 * it can read the REAL hexes instead of keeping a copy. Same split, and the
 * same reason, as `./metrics.ts`. Re-exported here so every existing importer
 * of `@/theme/tokens` is untouched.
 */
export type { ColorSchemeName, ThemeColors } from './palette';

/**
 * Canvas at an opacity, for type and rules sitting ON a dark ground.
 *
 * The app is light-only, but three surfaces are not: the camera's live preview,
 * The Ten's capture chrome, and The Reveal's first two beats. `muted`, `faint`,
 * `byline` and `ghost` are all tuned against `canvas` and go muddy on ink, so
 * there was no answer to "the secondary line under a headline, when the
 * headline is white on black" — and the app had answered it three separate
 * times with three hand-typed literals (dev-screens, auth/chrome,
 * garment-search-sheet) before anyone noticed it was the same question.
 *
 * This introduces no colour. It is the `canvas` token composited at an alpha,
 * the same move `scrim` already makes in the other direction — ink at 40% over
 * paper. The palette stays locked.
 *
 * Keep to a small set of steps in practice: ~0.7 for secondary copy, ~0.45 for
 * a control's ground, ~0.16 for a rule. A ramp with twelve values is a second
 * palette wearing a function's clothes.
 */
export const canvasAlpha = (alpha: number) => `rgba(251,250,246,${alpha})`;

/**
 * The accent, composited — for the one well CX-01 draws behind a recommended
 * route's glyph.
 *
 * Same discipline as `canvasAlpha`: this introduces no colour, it is `accent`
 * at an alpha, and it exists so a tint is derived rather than eyedropped into
 * a component as a fourth oxblood nobody can trace. The light and dark accents
 * are the same hex (`#6E2B2B`), which is why one function serves both — if
 * that ever stops being true this has to take the theme instead.
 */
export const accentAlpha = (alpha: number) => `rgba(110,43,43,${alpha})`;

/**
 * The warning amber, composited — for the one status pill People Search draws
 * when a search could not leave the phone.
 *
 * Same discipline as `canvasAlpha` and `accentAlpha`, and the same reason:
 * the accepted frame washes its OFFLINE pill in a pale amber, and the choice
 * is between deriving that from the palette's own `warning` or eyedropping a
 * fourth amber nobody can trace back to a token. `warning` (#C58A2E) is a
 * FILL colour, not a ground — the contrast record already says canvas-on-
 * warning is 2.85:1 and that ink is what goes on it — so a pill built from it
 * takes the colour at a low alpha for the ground and `ink` for the label.
 *
 * Keep to the same small set of steps: ~0.22 for a pill's ground, 1.0 for the
 * mark itself. A ramp with twelve values is a second palette wearing a
 * function's clothes.
 */
export const warningAlpha = (alpha: number) => `rgba(197,138,46,${alpha})`;

export function useTheme(): ThemeColors & { scheme: ColorSchemeName } {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { ...palette[scheme], scheme };
}


/**
 * A colour that iOS resolves natively per appearance — for surfaces JS never
 * re-renders, above all the Liquid Glass tab bar. Expo's own docs warn that a
 * plain hex there causes a visible flicker when dark mode flips, because the
 * native bar repaints before React does. `DynamicColorIOS` hands both values
 * to UIKit up front.
 */
export function dynamic(key: keyof ThemeColors): ColorValue {
  if (Platform.OS === 'ios') {
    return DynamicColorIOS({ light: palette.light[key], dark: palette.dark[key] });
  }
  return palette.light[key];
}

/**
 * Motion — transcribed from Apple, not invented.
 *
 * Reanimated 4's `duration` + `dampingRatio` spring is numerically isomorphic
 * to SwiftUI's `spring(duration:bounce:)` with dampingRatio = 1 - bounce, so
 * these are SwiftUI's own presets. The previous config was one `.bouncy`-class
 * spring (ζ ≈ 0.707) applied to everything — WWDC23's guidance is the
 * opposite: "When you're not sure, use a spring with bounce 0."
 *
 * `bouncy` is used EXACTLY ONCE in the app: the final garment landing in a
 * plate assembly. That scarcity is what makes the one bounce feel like an
 * event instead of a texture.
 *
 * Every preset carries `reduceMotion: ReduceMotion.System`, so a
 * `withSpring(x, spring.*)` anywhere in the app — written today or in a year —
 * settles instantly to its end value when the accessibility setting is on.
 * Stated rather than inherited from Reanimated's default: the compliance is a
 * property of the vocabulary, not of whichever version of the library is
 * installed. Durations and damping ratios are untouched; with the setting off
 * these are the same springs they always were.
 */
export const spring = {
  /** SwiftUI .smooth — the default. Plates, sheets, screen content. */
  smooth: { duration: 500, dampingRatio: 1.0, reduceMotion: ReduceMotion.System },
  /** SwiftUI .snappy — buttons, chips, selection. */
  snappy: { duration: 450, dampingRatio: 0.85, reduceMotion: ReduceMotion.System },
  /** SwiftUI .bouncy — the single plate-landing moment. Nothing else. */
  bouncy: { duration: 500, dampingRatio: 0.7, reduceMotion: ReduceMotion.System },
  /** Gesture release, drag snap-back. */
  interactive: { duration: 150, dampingRatio: 0.86, reduceMotion: ReduceMotion.System },
} as const;







/**
 * The page margin, as a number — the same 20 `spacing.gutter` gives `px-gutter`.
 *
 * For the handful of places that cannot use the class: an absolutely positioned
 * layer, a measured offset, an animated inset. Those were typing `20` by hand,
 * which is how a measure drifts one screen at a time.
 */
export const GUTTER = 20;

/**
 * Re-exported from `./metrics`, which holds them so that pure modules can use
 * them without importing this file — this one pulls in React Native, and RN's
 * Flow source cannot be bundled by the node test runner. Audit item 49.
 */
export { concentric, MIN_TAP_TARGET, motion, PRESSED_OPACITY, shadow } from './metrics';
