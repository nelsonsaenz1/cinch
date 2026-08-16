/**
 * The palette, as pure data — no React Native import.
 *
 * Split out of `tokens.ts` for the same reason `metrics.ts` was (audit item
 * 49): `tokens.ts` imports `DynamicColorIOS`, `Platform` and `useColorScheme`
 * from `react-native`, and RN ships Flow-typed source that esbuild cannot
 * parse. Anything that wants a HEX rather than a hook — above all the contrast
 * proof in `./contrast.ts` and the tests that run it — dragged the whole RN
 * module graph in with it and became untestable by the node runner.
 *
 * UX-01 is what forced the split. A contrast rule that asserts against its own
 * copy of the palette passes happily while the app renders something else; the
 * constitution file already says this in prose about `tailwind.config.js`, and
 * this file is what lets the same discipline reach the JS façade. `tokens.ts`
 * re-exports every name here, so no existing importer changes.
 *
 * Values must stay in sync with tailwind.config.js. `tests/contrast.test.ts`
 * pins that both ways round, so drift fails rather than ships.
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
export const light: ThemeColors = {
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

export const palette: Record<ColorSchemeName, ThemeColors> = {
  light,
  dark: light,
};
