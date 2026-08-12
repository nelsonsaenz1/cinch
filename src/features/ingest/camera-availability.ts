/**
 * CP-04 — whether this binary has a camera module at all.
 *
 * NOT A PERMISSION AND NOT A SETTING. A permission is a decision the user made
 * and can revisit in Settings; this is a fact about the installed app, and the
 * only thing that changes it is an update from the App Store. The atlas keeps
 * them apart for exactly that reason — "a stale native client, distinguished
 * from a denied permission because the recovery is different" — and offering
 * Settings here would send somebody to a switch that would not be there.
 *
 * HOW IT ARISES. Cinch ships JavaScript over the air, so a bundle can land on a
 * binary older than the native modules it expects. `expo-camera` resolves its
 * native module at import — `requireNativeModule('ExpoCamera')` at the top of
 * `ExpoCameraManager.js` — and that THROWS when the module is absent. Not
 * returns undefined: throws, at import, before any component renders.
 *
 * So this file probes with `requireOptionalNativeModule`, which is the same
 * lookup with a null return instead of a throw, and it does not import
 * `expo-camera` at all. Anything that imports `expo-camera` cannot be the thing
 * that decides whether importing it is safe.
 *
 * The name is the one `expo-camera` itself asks for. If that ever changes, this
 * probe answers `false` on a perfectly good binary and the app quietly loses
 * its camera door — which is why `tests/camera-availability.test.ts` reads the
 * name back out of the installed package rather than trusting this comment.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';

import { CAMERA_NATIVE_MODULE } from './camera-copy';

function probe(): boolean {
  try {
    return requireOptionalNativeModule(CAMERA_NATIVE_MODULE) !== null;
  } catch {
    // `requireOptionalNativeModule` is documented not to throw, and a build
    // where even that fails has bigger problems than a camera. Answering
    // `false` degrades to the state this file exists to draw rather than
    // taking the screen down.
    return false;
  }
}

/**
 * Resolved once, at module scope: a binary either carries the module or it does
 * not, and that cannot change during a session. Re-probing per render would be
 * work with no possible new answer.
 */
export const CAMERA_AVAILABLE: boolean = probe();
