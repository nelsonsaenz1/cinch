/**
 * CP-04, part two — no route may evaluate `expo-camera` before the guard.
 *
 * This is the assertion the previous packet could not make. `expo-camera`
 * resolves its native module AT IMPORT and throws when a binary lacks it, so a
 * single module-scope `import { CameraView } from 'expo-camera'` anywhere on a
 * route's import path puts the crash before every capability check — and the
 * failure is invisible on every healthy device, which is every device a
 * developer owns.
 *
 * So the check is structural and it is on the source, because there is no
 * runtime here that can simulate a missing native module.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Comments discuss `expo-camera` constantly; only code may be searched. */
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** Every file that may name `expo-camera` at all, and how. */
const CAMERA_TOUCHING = [
  'src/app/capture.tsx',
  'src/components/onboarding/ten-camera.tsx',
  'src/components/ingest/lazy-camera-view.tsx',
  'src/features/ingest/use-camera-access.ts',
];

test('no module imports expo-camera as a value', () => {
  // `import type` is erased by the compiler and produces no require; a value
  // import is the thing that evaluates the package.
  for (const path of CAMERA_TOUCHING) {
    const src = code(path);
    // Line by line: a multi-line regex would span from an unrelated import at
    // the top of the file down to the type-only one and report a false hit.
    const valueImports = src
      .split('\n')
      .filter((l) => /from 'expo-camera';\s*$/.test(l))
      .filter((l) => !/^import type /.test(l.trimStart()));
    assert.deepEqual(valueImports, [], `${path} imports expo-camera as a value`);
  }
});

test('the two camera routes name expo-camera nowhere in their own code', () => {
  // They reach it only through `lazy-camera-view`, so neither carries a
  // specifier that a bundler could hoist.
  for (const path of ['src/app/capture.tsx', 'src/components/onboarding/ten-camera.tsx']) {
    assert.doesNotMatch(code(path), /'expo-camera'/, `${path} still names expo-camera`);
  }
});

test('every require of expo-camera sits inside a function body', () => {
  // A top-level `require` would evaluate on import exactly like an import
  // statement does. Checked by indentation: a module-scope require starts at
  // column zero.
  for (const path of CAMERA_TOUCHING) {
    for (const line of code(path).split('\n')) {
      if (!line.includes("require('expo-camera')")) continue;
      assert.notEqual(
        line.trimStart(),
        line,
        `${path}: require('expo-camera') at module scope — it would run on import`,
      );
    }
  }
});

test('every require of expo-camera is guarded', () => {
  // The require throws on the binaries this exists for, so an unguarded one
  // moves the crash rather than preventing it.
  for (const path of CAMERA_TOUCHING) {
    const src = code(path);
    if (!src.includes("require('expo-camera')")) continue;
    const at = src.indexOf("require('expo-camera')");
    const before = src.slice(Math.max(0, at - 400), at);
    assert.match(before, /try\s*\{/, `${path}: require('expo-camera') is not inside a try`);
  }
});

test('CameraView is reached through the deferred wrapper, never bound at module scope', () => {
  for (const path of ['src/app/capture.tsx', 'src/components/onboarding/ten-camera.tsx']) {
    const src = code(path);
    assert.match(src, /<DeferredCameraView/, `${path} does not use the deferred wrapper`);
    // Neither screen may resolve the component itself: a module constant would
    // run the require on import again, and a local binding used as `<Camera/>`
    // is a component created during render.
    assert.doesNotMatch(src, /getCameraView\(\)/, `${path} resolves the camera itself`);
  }
  // The wrapper is declared once, at module scope, so the screens hold a
  // constant reference — and it resolves lazily inside its own render.
  const lazy = code('src/components/ingest/lazy-camera-view.tsx');
  assert.match(lazy, /^export function DeferredCameraView\(/m);
  assert.match(lazy, /const Component = getCameraView\(\);/);
});

test('the capability guard runs before the screen that renders a viewfinder', () => {
  const src = code('src/app/capture.tsx');
  const guard = src.indexOf('!CAMERA_AVAILABLE');
  const screen = src.indexOf('function CaptureScreen()');
  assert.ok(guard > -1, 'capture has no capability guard');
  assert.ok(guard < screen, 'the guard must sit above the screen it protects');
  // And the guard is a wrapper, so the screen's hooks stay unconditional.
  assert.match(src, /export default function CaptureRoute\(\)/);
});

test("The Ten guards its camera slot, and its library door is not a dead control", () => {
  const src = code('src/app/the-ten.tsx');
  assert.match(src, /cameraSlot && !CAMERA_AVAILABLE && cameraStart !== 'library'/);
  // "Use the photo library" must fall through to the picker rather than
  // re-rendering the same notice.
  assert.match(src, /onLibrary=\{\(\) => setCameraStart\('library'\)\}/);
});

test('the lazy accessor keeps its type import erasable', () => {
  const src = code('src/components/ingest/lazy-camera-view.tsx');
  // `import type` — with the keyword, so the compiler drops the whole line.
  assert.match(src, /^import type \{ CameraView \} from 'expo-camera';$/m);
  // Cached with a three-state sentinel, so an absent module is not re-probed
  // on every render.
  assert.match(src, /let cached:[\s\S]*?\| null \| undefined;/);
});

test('healthy-binary behaviour is unchanged: permission still decides the preview', () => {
  // The capability guard is ABOVE the permission logic and does not replace it.
  // `live` still gates the viewfinder on a granted permission in both screens,
  // so nothing about the ordering the previous packets settled has moved.
  for (const path of ['src/app/capture.tsx', 'src/components/onboarding/ten-camera.tsx']) {
    assert.match(code(path), /live \? \(\s*<DeferredCameraView/, `${path} lost its permission gate`);
  }
});
