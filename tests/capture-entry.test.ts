/**
 * Funnel run 2026-08-31, issue 2 — the photo-library door must open the
 * picker directly, never the camera-disabled recovery sheet.
 *
 * Two halves, matching the house split:
 *
 *   1. THE DECISION. `captureEntryFrom` / `bypassesCameraGate`
 *      (`capture-entry.ts`) are pure and exercised directly here.
 *   2. THE WIRING. `capture.tsx`'s three camera-gate call sites — the
 *      capability guard, the pre-prompt ask, and the blocked recovery page —
 *      must each read `bypassesCameraGate` before intercepting a library
 *      entry. Asserted against the source, the same way
 *      `tests/camera-deferred.test.ts` and `tests/capture-layout.test.ts` pin
 *      structure no runtime here can mount (there is no camera module to
 *      simulate as present, absent, granted or blocked).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { bypassesCameraGate, captureEntryFrom } from '../src/features/ingest/capture-entry';

/** Comments discuss every branch at length; only code may be searched. */
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const ROUTE = code('src/app/capture.tsx');

// ── The decision ─────────────────────────────────────────────────────────

test('captureEntryFrom reads the library door', () => {
  assert.equal(captureEntryFrom('library'), 'library');
});

test('captureEntryFrom reads the describe door', () => {
  assert.equal(captureEntryFrom('describe'), 'describe');
});

test('captureEntryFrom treats an absent or unrecognised value as the camera door', () => {
  assert.equal(captureEntryFrom(undefined), 'camera');
  assert.equal(captureEntryFrom('anything-else'), 'camera');
});

test('captureEntryFrom takes the first value of a repeated query key', () => {
  assert.equal(captureEntryFrom(['library', 'describe']), 'library');
});

test('only the library entry bypasses the camera gate', () => {
  assert.equal(bypassesCameraGate('library'), true);
  assert.equal(bypassesCameraGate('describe'), false);
  assert.equal(bypassesCameraGate('camera'), false);
});

// ── The wiring ───────────────────────────────────────────────────────────

test('CaptureRoute reads ?start= before drawing the capability guard', () => {
  // The guard used to fire on `!CAMERA_AVAILABLE` alone, with no look at the
  // query string — the exact bug: a library entry on a binary with no camera
  // module hit `CameraUnavailable` regardless of the door tapped.
  const guardAt = ROUTE.indexOf('!CAMERA_AVAILABLE');
  assert.ok(guardAt > -1, 'capture has no capability guard');
  const paramsAt = ROUTE.indexOf('useLocalSearchParams');
  assert.ok(paramsAt > -1 && paramsAt < guardAt, 'CaptureRoute never reads ?start=');
  const guardLine = ROUTE.slice(ROUTE.lastIndexOf('\n', guardAt), ROUTE.indexOf('\n', guardAt));
  assert.match(
    guardLine,
    /bypassesCameraGate/,
    'the capability guard does not consult bypassesCameraGate',
  );
});

test('CameraUnavailable’s own "Use the photo library" cannot re-enter the loop it just left', () => {
  // Bouncing back to `/add-clothes?door=library` is what created the loop:
  // that route immediately re-opens `/capture?start=library`, hitting the
  // same guard again. With the guard consulting `bypassesCameraGate` a library
  // entry never reaches this branch at all, so the bounce can never fire for
  // it — asserted here as "the branch that still bounces is reachable only
  // when the guard has already excluded the library entry".
  const guardAt = ROUTE.indexOf('!CAMERA_AVAILABLE');
  const guardLine = ROUTE.slice(ROUTE.lastIndexOf('\n', guardAt), ROUTE.indexOf('\n', guardAt));
  assert.match(guardLine, /bypassesCameraGate/);
});

test('the pre-prompt ask (CP-02) does not intercept a library entry', () => {
  const at = ROUTE.indexOf("access === 'unasked'");
  assert.ok(at > -1, 'the unasked branch is gone');
  const conditionLine = ROUTE.slice(ROUTE.lastIndexOf('\n', at), ROUTE.indexOf('\n', at));
  assert.match(
    conditionLine,
    /bypassesCameraGate/,
    'the unasked branch does not exempt the library entry',
  );
});

test('the blocked recovery page does not intercept a library entry', () => {
  const at = ROUTE.indexOf("access === 'blocked'");
  assert.ok(at > -1, 'the blocked branch is gone');
  const conditionLine = ROUTE.slice(ROUTE.lastIndexOf('\n', at), ROUTE.indexOf('\n', at));
  assert.match(
    conditionLine,
    /bypassesCameraGate/,
    'the blocked branch does not exempt the library entry',
  );
});

test('camera entries are unchanged: the gate states still fire with no ?start=', () => {
  // The exemption is keyed off the entry, not deleted outright — a camera
  // door (no `start` param) must still see the capability guard, the ask and
  // the blocked page exactly as before.
  assert.equal(bypassesCameraGate(captureEntryFrom(undefined)), false);
  assert.equal(bypassesCameraGate(captureEntryFrom('camera')), false);
});
