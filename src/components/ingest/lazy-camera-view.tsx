import { createElement, type ComponentType } from 'react';

// TYPE-ONLY, and load-bearing that it stays that way. `import type` is erased
// entirely by the TypeScript compiler and by Babel's TS transform, so this line
// produces no `require` in the bundle and cannot evaluate `expo-camera`. A
// plain `import { CameraView }` here would defeat the whole file.
import type { CameraView } from 'expo-camera';

/**
 * CP-04, part two — reaching `CameraView` without importing it.
 *
 * `expo-camera` resolves its native module at import (`requireNativeModule`,
 * `ExpoCameraManager.js:2`) and THROWS when a binary does not carry it. A
 * module-scope `import { CameraView } from 'expo-camera'` therefore takes down
 * whatever imports it, before render, before any capability check can run — so
 * a deep link straight to `/capture` on a stale native client failed at import
 * rather than showing the state written for exactly that case.
 *
 * WHY A GUARDED `require` AND NOT `React.lazy` + `import()`.
 *
 * Both defer evaluation. `require` inside a function body is plain CommonJS
 * that Metro preserves verbatim: the call happens when the function runs and
 * not before, with no Suspense boundary, no async tick and no split point.
 * `React.lazy` would need a fallback tree around a viewfinder that has none,
 * and would turn a synchronous "is this module here" question into a promise —
 * a rejected one, on the very binaries this exists for. Expo's own tree-shaking
 * guidance recommends `inlineRequires` for the same deferral, which is the
 * bundler doing exactly this transform to every import; doing it by hand here
 * makes the deferral a guarantee of this file rather than a build setting that
 * someone could turn off.
 *
 * The same pattern, for the same reason, as `src/features/invite/native.ts`.
 */

/** The ref type `capture.tsx` and `ten-camera.tsx` hold. Erased at build. */
export type CameraViewHandle = CameraView;

// `undefined` means "not looked yet"; `null` means "looked, and it is absent".
// The two must stay distinguishable or a first lookup returning null would be
// re-attempted on every render.
let cached: ComponentType<Record<string, unknown>> | null | undefined;

/**
 * The component, or `null` on a binary without the module.
 *
 * Callers must render nothing camera-shaped when this is null. It is the second
 * line of defence rather than the first: `CAMERA_AVAILABLE` is what decides
 * which SCREEN a user gets, and this is what makes the decision survivable if
 * anything ever reaches a viewfinder without asking.
 */
export function getCameraView(): ComponentType<Record<string, unknown>> | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-camera') as { CameraView?: unknown };
    cached =
      typeof mod?.CameraView === 'function' || typeof mod?.CameraView === 'object'
        ? (mod.CameraView as ComponentType<Record<string, unknown>>)
        : null;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * A stable component the screens can render without binding one themselves.
 *
 * `const Camera = getCameraView()` inside a render, used as `<Camera />`, is
 * flagged as creating a component during render — the linter cannot see that
 * the value is a module-level cache and is the same reference every time. This
 * wrapper is declared once at module scope, so the screens hold a constant
 * reference, and the deferral is unchanged: `getCameraView` still does not run
 * until this renders, which is after the capability guard.
 *
 * `createElement` rather than JSX for the same reason — a capitalised local in
 * JSX is what the rule keys on, and the two forms are identical otherwise.
 *
 * Renders `null` when the module is absent. That is unreachable behind
 * `CAMERA_AVAILABLE`, and it is the right answer if anything ever gets here
 * anyway: a missing viewfinder, not a thrown screen.
 */
export function DeferredCameraView(props: Record<string, unknown>) {
  const Component = getCameraView();
  return Component ? createElement(Component, props) : null;
}
