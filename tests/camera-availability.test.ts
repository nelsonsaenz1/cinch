/**
 * CP-04 — the capability, and the two ways of getting it wrong.
 *
 * A probe that answers `false` on a healthy binary quietly removes the camera
 * from the app. A probe that answers `true` on a stale one sends somebody into
 * a screen that throws at import. Neither shows up in a screenshot, and the
 * second is the crash CP-04 exists because of.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CAMERA_NATIVE_MODULE,
  CAMERA_UNAVAILABLE_BODY,
  CAMERA_UNAVAILABLE_DESCRIBE,
  CAMERA_UNAVAILABLE_HELP,
  CAMERA_UNAVAILABLE_LIBRARY,
  CAMERA_UNAVAILABLE_TITLE,
} from '../src/features/ingest/camera-copy';


/** Comments explain the refusals; only the code may be searched for them. */
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

test('the probed module name is the one expo-camera actually requires', () => {
  // Read out of the installed package, not out of a comment. If `expo-camera`
  // ever renames its native module, this fails here rather than silently
  // removing the camera door from every healthy build.
  const src = readFileSync('node_modules/expo-camera/build/ExpoCameraManager.js', 'utf8');
  assert.match(
    src,
    new RegExp(`requireNativeModule\\(['"]${CAMERA_NATIVE_MODULE}['"]\\)`),
    `expo-camera no longer requires '${CAMERA_NATIVE_MODULE}'`,
  );
});

test('the probe does not import the package it is deciding about', () => {
  // `expo-camera` resolves its native module AT IMPORT and throws when it is
  // absent, so anything that imports it cannot be the thing that decides
  // whether importing it is safe.
  const src = readFileSync('src/features/ingest/camera-availability.ts', 'utf8');
  assert.doesNotMatch(src, /from 'expo-camera'|require\('expo-camera'\)/);
  assert.match(src, /requireOptionalNativeModule/);
});

test('the copy names the alternatives rather than counting them', () => {
  // 2026-09-02 copy-reduction pass, P2 #55: "the other three still work"
  // assumed the reader was holding a count of four entry methods in their
  // head. The body now names the two doors this same screen draws as
  // buttons, so the sentence and the buttons agree.
  assert.equal(CAMERA_UNAVAILABLE_TITLE, 'This build of Cinch cannot open the camera.');
  assert.equal(
    CAMERA_UNAVAILABLE_BODY,
    'The app was installed before the camera was part of it. Updating restores the door — until then you can still add clothes from your photo library or by describing them, and nothing you have filed is affected.',
  );
  assert.doesNotMatch(CAMERA_UNAVAILABLE_BODY, /the other three/);
  assert.equal(CAMERA_UNAVAILABLE_LIBRARY, 'Use the photo library');
  assert.equal(CAMERA_UNAVAILABLE_DESCRIBE, 'Describe it instead');
  assert.equal(CAMERA_UNAVAILABLE_HELP, 'How to update Cinch');
});

test('nothing reads as a crash, and nothing suggests data was lost', () => {
  const both = `${CAMERA_UNAVAILABLE_TITLE} ${CAMERA_UNAVAILABLE_BODY}`;
  assert.doesNotMatch(both, /crash|error|fail|broken|sorry|unfortunately/i);
  // No jargon: a module name or a version number is a crash report handed to
  // somebody who did nothing wrong by installing the app when they did.
  assert.doesNotMatch(both, /module|native|SDK|version \d|expo/i);
  // And it says what survived.
  assert.match(CAMERA_UNAVAILABLE_BODY, /nothing you have filed is affected/);
});

test('this is not a permission, so no Settings recovery is offered', () => {
  // AC-02 is the denied-permission state and sends people to Settings. CP-04 is
  // kept separate from it "because the recovery is different" — there is no
  // switch for a module a binary does not carry, and offering one would send
  // somebody looking for a control that is not there.
  const both = `${CAMERA_UNAVAILABLE_TITLE} ${CAMERA_UNAVAILABLE_BODY}`;
  assert.doesNotMatch(both, /permission|allow|Settings/i);
  const ui = code('src/components/ingest/camera-unavailable.tsx');
  assert.doesNotMatch(ui, /openSettings|Linking\.openSettings|Open Settings/);
  // No retry either: tapping again cannot change which modules a binary has.
  assert.doesNotMatch(ui, /Try again|retry/i);
});

test('the two working doors are actions and the help route is not', () => {
  const ui = readFileSync('src/components/ingest/camera-unavailable.tsx', 'utf8');
  const buttons = [...ui.matchAll(/<Button\s+title=\{([A-Z_]+)\}/g)].map((m) => m[1]);
  assert.deepEqual(buttons, ['CAMERA_UNAVAILABLE_LIBRARY', 'CAMERA_UNAVAILABLE_DESCRIBE']);
  // The help route "sits last as text" — so it must not be a Button.
  assert.doesNotMatch(ui, /<Button[^>]*CAMERA_UNAVAILABLE_HELP/);
});

test('the chooser cannot push a door that would throw on the way there', () => {
  // `/capture` statically imports `CameraView`, which is exactly what a stale
  // binary cannot resolve — so the guard has to sit on the push, not inside the
  // destination.
  const src = readFileSync('src/app/add-clothes.tsx', 'utf8');
  // Matched loosely across whitespace: the cast moved from the second arm to
  // the whole expression when Catalogue Photo V2's fixture routes grew
  // expo-router's `Href` union past TS2590. What is being guarded is the
  // BRANCH, not where the parenthesis sits.
  assert.match(
    src,
    /CAMERA_AVAILABLE\s*\?\s*'\/capture'\s*:\s*'\/camera-unavailable'/,
  );
  const route = code('src/app/camera-unavailable.tsx');
  assert.doesNotMatch(route, /expo-camera|CameraView/);
});

test('the capability and the permission stay separate everywhere', () => {
  const src = readFileSync('src/app/add-clothes.tsx', 'utf8');
  // Capability is checked BEFORE permission, because a build with no camera
  // module has refused nobody anything and must not be told it needs Settings.
  const capability = src.indexOf('!CAMERA_AVAILABLE');
  const permission = src.indexOf("access === 'blocked'", capability);
  assert.ok(capability > -1 && permission > capability, 'permission is tested first');
});
