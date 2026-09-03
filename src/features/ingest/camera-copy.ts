/**
 * CP-04's copy, and the name of the module the state is about.
 *
 * Separated from the probe next door for a reason that is not tidiness: the
 * probe imports `expo-modules-core`, which pulls React Native's Flow source in
 * behind it, and `scripts/run-tests.mjs` bundles with esbuild, which cannot
 * parse Flow. A test that wanted to check one sentence of copy would take the
 * whole suite down. Same argument, and the same split, as
 * `src/features/ingest/consent-mode.ts`.
 *
 * So: nothing in this file imports anything. It is the half a test can read.
 */

/** What `expo-camera` requires, verbatim. */
export const CAMERA_NATIVE_MODULE = 'ExpoCamera';

// ---------------------------------------------------------------------------
// The copy, from the atlas. "Named cause, two forward paths."
// ---------------------------------------------------------------------------

export const CAMERA_UNAVAILABLE_TITLE = 'This build of Cinch cannot open the camera.';

/**
 * The cause, then what still works, then what is unaffected — in that order.
 *
 * "The cause is stated without blame or jargon… Nothing here reads as a crash
 * and nothing suggests data was lost." No version numbers, no module names, no
 * apology: a user did nothing wrong by installing the app before a feature
 * existed.
 */
/**
 * P2 #55 — "the other three still work" assumed the reader was holding a
 * mental count of four entry methods. Named instead: the two doors this same
 * screen offers as buttons, so the sentence and the buttons agree rather than
 * asking the reader to remember a number.
 */
export const CAMERA_UNAVAILABLE_BODY =
  'The app was installed before the camera was part of it. Updating restores the door — until then you can still add clothes from your photo library or by describing them, and nothing you have filed is affected.';

/** Both are real doors into the same queue, so both are actions, not advice. */
export const CAMERA_UNAVAILABLE_LIBRARY = 'Use the photo library';
export const CAMERA_UNAVAILABLE_DESCRIBE = 'Describe it instead';

/** Last, and as text: it leaves the app, and it is not what to do first. */
export const CAMERA_UNAVAILABLE_HELP = 'How to update Cinch';
