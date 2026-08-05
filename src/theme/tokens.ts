import { DynamicColorIOS, Platform, useColorScheme, type ColorValue } from 'react-native';

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
  hairline: string;
  /** Structural rules of the plate grammar — ink at 18%, works over canvas and tray. */
  rule: string;
  accent: string;
  /** The second accent. Warm tan — used where blue would read as a link. */
  accentWarm: string;
  positive: string;
  warning: string;
  critical: string;
};

export type ColorSchemeName = 'light' | 'dark';

const palette: Record<ColorSchemeName, ThemeColors> = {
  light: {
    canvas: '#FBF8F5',
    surface: '#FFFFFF',
    tray: '#F5F0E8',
    ink: '#0A2633',
    muted: '#6B665C',
    hairline: '#EDE7DB',
    rule: 'rgba(10,38,51,0.18)',
    accent: '#2A6F97',
    accentWarm: '#C4976C',
    positive: '#1A8754',
    warning: '#D4850A',
    critical: '#C0392B',
  },
  dark: {
    canvas: '#061B24',
    surface: '#0A2633',
    tray: '#123243',
    ink: '#FBF8F5',
    muted: '#93A5AF',
    hairline: '#1B4254',
    rule: 'rgba(251,248,245,0.20)',
    accent: '#7FB3D3',
    accentWarm: '#D6AE88',
    positive: '#4CAF7D',
    warning: '#E8A33D',
    critical: '#E5675E',
  },
};

export function useTheme(): ThemeColors & { scheme: ColorSchemeName } {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { ...palette[scheme], scheme };
}

/** Non-hook access, for module-scope config that cannot call hooks. */
export function getColors(scheme: ColorSchemeName): ThemeColors {
  return palette[scheme];
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
 */
export const spring = {
  /** SwiftUI .smooth — the default. Plates, sheets, screen content. */
  smooth: { duration: 500, dampingRatio: 1.0 },
  /** SwiftUI .snappy — buttons, chips, selection. */
  snappy: { duration: 450, dampingRatio: 0.85 },
  /** SwiftUI .bouncy — the single plate-landing moment. Nothing else. */
  bouncy: { duration: 500, dampingRatio: 0.7 },
  /** Gesture release, drag snap-back. */
  interactive: { duration: 150, dampingRatio: 0.86 },
} as const;

/**
 * Non-spatial properties only — opacity, colour. A spring on opacity reads as
 * a rendering glitch; ease-out-quint reads as print settling onto paper.
 */
export const fadeEasing = [0.22, 1, 0.36, 1] as const;

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
