import { DynamicColorIOS, Platform, useColorScheme, type ColorValue } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';

/**
 * The single source of truth for colour values needed in *JavaScript* —
 * tab bar tints, icon colours, Skia canvas fills, status bar style.
 *
 * Styling itself goes through NativeWind `className` with `dark:` variants;
 * this façade exists only for the places React Native needs a literal colour.
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
  hairline: string;
  /** Structural rules of the plate grammar — ink at 12%, works over canvas and tray. */
  rule: string;
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
  hairline: 'rgba(28,26,22,0.09)',
  rule: 'rgba(28,26,22,0.12)',
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


export const motion = {
  stagger: 60,
  duration: { fast: 140, base: 220, slow: 380 },
} as const;

/**
 * Apple's concentric corner rule: an inner radius is the outer radius minus
 * the inset between them. Use this instead of typing a smaller number that
 * "looks about right" — mismatched curvature is one of the quiet tells of a
 * non-native app.
 */
export const concentric = (outer: number, inset: number) => Math.max(outer - inset, 0);

/** Accessibility floor. 44pt is the Apple minimum, not a target. */
export const MIN_TAP_TARGET = 44;

/**
 * The one pressed opacity.
 *
 * The app had four (60/70/80/90) across 86 call sites — two rails on the same
 * screen disagreed. `usePressFeedback` interpolates to this value, so a control
 * that adopts the hook is by definition consistent with every other one.
 */
export const PRESSED_OPACITY = 0.8;

/**
 * The contact shadow — the one elevation in the app, for a surface that has
 * lifted off the paper rather than been drawn on it.
 *
 * Exported now, spent later: several files carry their own copy of these four
 * numbers, and consolidating them means editing across territories. Until that
 * pass lands this is the value they should converge on, not a new one.
 */
export const shadow = {
  contact: { dx: 0, dy: 5, blur: 11, color: 'rgba(28,26,22,0.16)' },
} as const;

/**
 * The page margin, as a number — the same 20 `spacing.gutter` gives `px-gutter`.
 *
 * For the handful of places that cannot use the class: an absolutely positioned
 * layer, a measured offset, an animated inset. Those were typing `20` by hand,
 * which is how a measure drifts one screen at a time.
 */
export const GUTTER = 20;
