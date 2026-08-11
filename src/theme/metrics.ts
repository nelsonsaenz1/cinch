/**
 * Layout constants with no React Native dependency.
 *
 * Split out of `tokens.ts` for audit item 49. `tokens.ts` imports
 * `DynamicColorIOS`, `Platform` and `useColorScheme` from `react-native` — it
 * has to, that is its job — and React Native ships Flow-typed source that
 * esbuild cannot parse. So anything importing `tokens.ts` for a plain NUMBER
 * drags the whole RN module graph in with it and becomes untestable by the
 * node runner.
 *
 * These four are pure data. Keeping them here means a pure module can use them
 * without reaching into a file full of hooks. `tokens.ts` re-exports every one,
 * so no existing importer changes.
 */

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
 * Apple's concentric corner rule: an inner radius is the outer radius minus
 * the inset between them. Use this instead of typing a smaller number that
 * "looks about right" — mismatched curvature is one of the quiet tells of a
 * non-native app.
 */
export const concentric = (outer: number, inset: number) => Math.max(outer - inset, 0);
