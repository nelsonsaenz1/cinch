/**
 * The plate's drawing decisions. Audit item 49.
 *
 * `paletteDots` is the one that matters: the footer prints the real garment
 * colours the engine scored, so a bug here does not misdraw a decoration — it
 * misreports the outfit. Both of its rules are easy to lose in a refactor and
 * impossible to see in a screenshot.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTACT,
  landingDelay,
  MAX_PALETTE_DOTS,
  PALETTE_WEIGHT_FLOOR,
  paletteDots,
  TILE_RADIUS,
} from '../src/components/today/plate-spec';

import type { Garment } from '../src/lib/styling/types';

/**
 * Only the three fields `paletteDots` reads.
 *
 * `Oklch` is `{ L, C, h }` — capitals. Worth stating: the first draft of this
 * helper used lowercase, every colour collapsed to the same undefined-derived
 * hex, and three tests failed. The tests caught the fixture, which is the
 * behaviour you want from them.
 */
const piece = (L: number, C: number, h: number, visualWeight = 1): Garment =>
  ({ visualWeight, colors: [{ oklch: { L, C, h } }] }) as unknown as Garment;

const NAVY = () => piece(0.3, 0.08, 260);
const CAMEL = () => piece(0.75, 0.07, 70);

test('a piece under the weight floor claims no colour slot', () => {
  // A belt does not take the coat's dot.
  const dots = paletteDots([NAVY(), piece(0.9, 0.2, 20, PALETTE_WEIGHT_FLOOR - 0.01)]);
  assert.equal(dots.length, 1);
});

test('a piece exactly at the floor does count', () => {
  // The comparison is `<`, so the floor itself is admitted. Pinned because a
  // stray `<=` would silently drop a whole class of pieces.
  assert.equal(paletteDots([piece(0.5, 0.1, 200, PALETTE_WEIGHT_FLOOR)]).length, 1);
});

test('duplicate colours collapse to one dot', () => {
  // A navy-on-navy look prints one dot, not two.
  assert.deepEqual(paletteDots([NAVY(), NAVY(), NAVY()]).length, 1);
});

test('distinct colours each keep a dot, in the order the pieces arrive', () => {
  const dots = paletteDots([NAVY(), CAMEL()]);
  assert.equal(dots.length, 2);
  assert.deepEqual(dots, paletteDots([NAVY(), CAMEL()]), 'must be deterministic');
  assert.notDeepEqual(dots, paletteDots([CAMEL(), NAVY()]), 'order follows the pieces');
});

test('the palette is capped', () => {
  const many = Array.from({ length: 12 }, (_, i) => piece(0.4, 0.12, i * 29));
  assert.equal(paletteDots(many).length, MAX_PALETTE_DOTS);
  assert.equal(MAX_PALETTE_DOTS, 5);
});

test('a piece with no colour is skipped rather than printed as black', () => {
  // The tagger writes name-only colours; an invented hex would be a lie about
  // the garment.
  const colourless = { visualWeight: 1, colors: [] } as unknown as Garment;
  assert.deepEqual(paletteDots([colourless, NAVY()]).length, 1);
});

test('an empty look prints no dots', () => {
  assert.deepEqual(paletteDots([]), []);
});

test('every dot is a hex the footer can actually paint', () => {
  for (const dot of paletteDots([NAVY(), CAMEL()])) {
    assert.match(dot, /^#[0-9a-fA-F]{6}$/, dot);
  }
});

test('pieces land in sequence, never together', () => {
  // The stagger is what makes the stack read as assembled rather than pasted.
  assert.equal(landingDelay(0), 120);
  assert.ok(landingDelay(1) > landingDelay(0));
  assert.equal(landingDelay(2) - landingDelay(1), landingDelay(1) - landingDelay(0));
});

test('the contact shadow is one definition for both regimes', () => {
  // Skia derives it from the cutout alpha, iOS from the rounded rect — same
  // offset and softness, so switching regimes does not change the light.
  assert.deepEqual(CONTACT, { dx: 0, dy: 5, blur: 11, color: 'rgba(28,26,22,0.16)' });
  assert.equal(TILE_RADIUS, 12);
});
