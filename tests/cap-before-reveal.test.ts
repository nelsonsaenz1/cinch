/**
 * A28, resurrected 2026-09-11 — the closet cap is caught before the shot, the
 * grid agrees with the closet, and a full free closet that can be dressed
 * meets its Reveal before it meets the plans.
 *
 * What production said (the 2026-09-11 nightly): 34 `clothes_import_failed
 * {closet_limit_reached}` events from 3 persons in 36 hours, every one of them
 * `held: 1` on screen `the-ten` — single photographs from The Ten's own camera,
 * which had no capacity pre-flight, into wells the grid still showed open
 * because a double shutter tap had filed two rows into one well. Each person
 * then met `add_garment_over_limit` with `reveal_seen_at` null. 0 of 3 came
 * back.
 *
 * The rule is pure (`overLimitDoor`); the wiring is pinned by source, as the
 * other screen tests do, because the node suite cannot import React Native.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { OVER_LIMIT_REVEAL_COPY, overLimitDoor } from '../src/features/billing/over-limit-door';

const read = (path: string) => readFileSync(path, 'utf8');
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

test('overLimitDoor — Reveal first only for a dressable closet that has never had one', () => {
  assert.equal(overLimitDoor({ wall: 'active', dressable: true, revealNeverSeen: true }), 'reveal');
  assert.equal(overLimitDoor({ wall: 'active', dressable: true, revealNeverSeen: false }), 'wall');
  assert.equal(overLimitDoor({ wall: 'active', dressable: false, revealNeverSeen: true }), 'wall');
  assert.equal(overLimitDoor({ wall: 'active', dressable: false, revealNeverSeen: false }), 'wall');
  // The total ceiling has a different remedy; the Reveal is never it.
  assert.equal(overLimitDoor({ wall: 'total', dressable: true, revealNeverSeen: true }), 'wall');
});

test('the Reveal door\'s copy types no price and no number', () => {
  for (const line of Object.values(OVER_LIMIT_REVEAL_COPY)) {
    assert.doesNotMatch(line, /\$|\d/, line);
  }
  assert.equal(OVER_LIMIT_REVEAL_COPY.primary, 'See my outfits');
});

test('the capture sheet routes through overLimitDoor and replaces to the Reveal', () => {
  const capture = code(read('src/app/capture.tsx'));
  assert.match(capture, /const revealNeverSeen = useRevealNeverSeen\(\)/);
  assert.match(capture, /overLimitDoor\(\{\s*wall: heldWall,\s*dressable: Boolean\(wardrobe\.data\) && canGenerate\(wardrobe\.data \?\? \[\]\),\s*revealNeverSeen,\s*\}\)/);
  assert.match(capture, /router\.replace\('\/reveal' as Href\)/);
  // The filled action is the outfits on that door, and the plans move to the outlined one.
  assert.match(capture, /primaryLabel=\{overLimit === 'reveal' \? OVER_LIMIT_REVEAL_COPY\.primary : undefined\}/);
  assert.match(capture, /onSeePlans=\{overLimit === 'reveal' \? seeOutfitsForHeldCapture : seePlansForHeldCapture\}/);
  assert.match(capture, /onSecondary=\{overLimit === 'reveal' \? seePlansForHeldCapture : makeRoomForHeldCapture\}/);
});

test('the sheet\'s filled action keeps "See plans" as its default label', () => {
  const sheet = code(read('src/components/wall/closet-full-sheet.tsx'));
  assert.match(sheet, /primaryLabel = 'See plans'/);
  assert.match(sheet, /<Button title=\{primaryLabel\} variant="primary"/);
});

test('The Ten pre-flights an open well against the closet, one photograph, jobs counted', () => {
  const ten = code(read('src/app/the-ten.tsx'));
  const start = ten.indexOf('const openCamera = useCallback(');
  assert.ok(start > 0);
  const body = ten.slice(start, ten.indexOf('[camera.access, capacity, router],', start));
  assert.match(body, /admitBatch\(1, \{\s*\.\.\.capacity,\s*pendingRows: selectPendingRowCount\(useQueueStore\.getState\(\)\.jobs\),\s*\}\)/);
  assert.match(body, /if \(room\.kind === 'none'\) \{\s*router\.push\('\/add-clothes\?from=ten' as Href\);\s*return;/);
  // The pre-flight runs before the camera-permission branch: a locked door
  // on a full closet is still a full closet.
  assert.ok(body.indexOf('admitBatch(1') < body.indexOf("camera.access === 'blocked'"));
  // `capacity` is read above the callback that uses it — the TDZ shape.
  assert.ok(ten.indexOf('const capacity = useCapacity()') < start);
});

test('The Ten reconciles the grid with the wardrobe, add-only, and never mid-replacement', () => {
  const ten = code(read('src/app/the-ten.tsx'));
  assert.match(ten, /reconcileWithWardrobe\(prev, ids\)/);
  assert.match(ten, /replace\.phase !== 'closed'\) return;/);
  // Declared after the reducer it reads.
  assert.ok(ten.indexOf('useReducer(replaceReducer') < ten.indexOf('reconcileWithWardrobe(prev, ids)'));
});

test('The Ten\'s camera takes one shot per mount', () => {
  const camera = code(read('src/components/onboarding/ten-camera.tsx'));
  assert.match(camera, /shutterEnabled=\{live && !trackedJobId\}/);
  const shoot = camera.slice(camera.indexOf('const shoot = useCallback('), camera.indexOf('const library = useCallback('));
  assert.match(shoot, /if \(trackedJobId\) return;/);
  const library = camera.slice(camera.indexOf('const library = useCallback('), camera.indexOf('const autoPicked'));
  assert.match(library, /if \(trackedJobId\) return;/);
});

test('A68 still holds — The Ten presents no promo on the way to the Reveal', () => {
  const ten = code(read('src/app/the-ten.tsx'));
  assert.doesNotMatch(ten, /presentPromo\(/);
});
