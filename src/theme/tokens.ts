import { useColorScheme } from 'react-native';

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
  accent: string;
  positive: string;
  warning: string;
  critical: string;
};

export type ColorSchemeName = 'light' | 'dark';

const palette: Record<ColorSchemeName, ThemeColors> = {
  light: {
    canvas: '#FAF9F6',
    surface: '#FFFFFF',
    tray: '#F2F0EA',
    ink: '#141310',
    muted: '#6B665C',
    hairline: '#E3E0D8',
    accent: '#1B3BFF',
    positive: '#2E7D4F',
    warning: '#B4741F',
    critical: '#B3261E',
  },
  dark: {
    canvas: '#141310',
    surface: '#1E1C18',
    tray: '#26241F',
    ink: '#FAF9F6',
    muted: '#9C968A',
    hairline: '#33302A',
    accent: '#5C74FF',
    positive: '#4CAF7D',
    warning: '#D9932F',
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
 * Motion. Outfit cards assemble with a stagger, and a swapped garment flies in
 * on its own rather than re-rendering the whole card, so these need to be
 * shared constants rather than magic numbers scattered across components.
 */
export const motion = {
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
  springSoft: { damping: 22, stiffness: 120, mass: 1 },
  stagger: 60,
  duration: { fast: 140, base: 220, slow: 380 },
} as const;

/** Accessibility floor. 44pt is the Apple minimum, not a target. */
export const MIN_TAP_TARGET = 44;
