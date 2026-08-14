import { DynamicColorIOS, Platform, useColorScheme, type ColorValue } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';

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

export type ThemeColors = {
  canvas: string;
  surface: string;
  tray: string;
  ink: string;
  muted: string;
  /** The lighter secondary tone — tracked eyebrows, inactive tab labels. */
  faint: string;
  /** Lighter still — the Lately attribution voice: bylines, elapsed marks, pointing chevrons. */
  byline: string;
  /**
   * The deepest sand — a tile that sits BACK from the tray without becoming a
   * border. Needed in JS because a Button's ground is painted on an
   * `Animated.View`, and NativeWind's interop is registered for the React
   * Native primitives, not for Reanimated's wrappers: `bg-sand` on that layer
   * would silently do nothing. See `disabledTone` in components/ui/button.tsx.
   */
  sand: string;
  /**
   * Lighter than `byline` — furniture that is explicitly not the user's data:
   * the Plan atlas's example cards, and the unpickable past days in the date
   * sheet. Needed in JS for the same reason `faint` is: a `text-ghost` class
   * on a `<Text variant="body">` is two `text-*` colours on one element, which
   * NativeWind resolves by key order in tailwind.config.js rather than by
   * intent. Set it with an inline `style` instead.
   */
  ghost: string;
  hairline: string;
  /** Structural rules of the plate grammar — ink at 12%, works over canvas and tray. */
  rule: string;
  /**
   * The answered-field border — ink at 28%. The New Occasion atlas darkens a
   * field's border rather than growing a checkmark, so `rule` → `ruleStrong` →
   * 1.5px `ink` is the whole of a field's state. In JS as well as Tailwind
   * because the field draws its border from a computed style, not a class:
   * three of the four states differ in width or padding too, and a class per
   * state would be four `border-*` utilities racing each other.
   */
  ruleStrong: string;
  accent: string;
  /** The second accent. Warm tan — used where blue would read as a link. */
  accentWarm: string;
  /**
   * The warm rose surface. Derived from `accentWarm` over `tray`, it marks the
   * one card on a page that is *yours* — the "Your look" board on an event.
   * Promoted out of `event/[id]/outfits.tsx`, where it lived as a local
   * literal, so the shared-look grammar can spread without the hex spreading
   * with it. Spend it as sparingly as the accent: one blush card per screen.
   */
  blush: string;
  /** The hairline that belongs to `blush` — accentWarm at 45%, never `rule`. */
  blushRule: string;
  /**
   * Warm ink at 40%. The one dimming value: sheet backdrops, and gradients
   * over photography where a caption has to stay legible on any garment.
   * Typed by hand in three places before this token existed.
   */
  scrim: string;
  positive: string;
  warning: string;
  critical: string;
};

export type ColorSchemeName = 'light' | 'dark';

// The app is light-only (userInterfaceStyle 'light' in app.config.ts). `dark` is
// kept as a key so `dynamic()` and any `dark:` path still resolve, but it holds
// the same oxblood values as `light` — the app never renders a second appearance.
const light: ThemeColors = {
  canvas: '#FBFAF6',
  surface: '#FFFFFF',
  tray: '#F0ECE3',
  ink: '#1C1A16',
  muted: '#6B665C',
  faint: '#8A8578',
  byline: '#A29C90',
  sand: '#EAE5DB',
  ghost: '#C7C1B4',
  hairline: 'rgba(28,26,22,0.09)',
  rule: 'rgba(28,26,22,0.12)',
  ruleStrong: 'rgba(28,26,22,0.28)',
  accent: '#6E2B2B',
  accentWarm: '#B08A76',
  blush: '#F7EDE8',
  blushRule: 'rgba(176,138,118,0.45)',
  scrim: 'rgba(28,26,22,0.40)',
  positive: '#1A8754',
  warning: '#C58A2E',
  critical: '#8A2E28',
};

const palette: Record<ColorSchemeName, ThemeColors> = {
  light,
  dark: light,
};

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
