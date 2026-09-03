/**
 * THE PICTURELESS GARMENT WELL — UX #62's colour half.
 *
 * "Friend closets, event boards, activity details, saved looks, diary days,
 * and trips become grids of indistinguishable beige blocks. Every image
 * surface needs a meaningful fallback (garment name/type/color), not a blank
 * tile."
 *
 * The fix turns on one mapping: whatever colour a surface happens to carry —
 * a measured OKLCH from the styling engine, a hex from `items.colors`, or a
 * bare name from the diary's projection — has to become one ground and one
 * legible ink. Three shapes, one answer, or the same coat reads differently on
 * Today than it does in a friend's closet.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hexToOklch } from '@/lib/color/oklch';
import { garmentSwatch, swatchInkOn, swatchOklch } from '@/lib/color/swatch';

test('all three colour shapes resolve, in order of how much they are trusted', () => {
  const measured = { L: 0.4, C: 0.1, h: 30 };

  // A measured value wins outright — it is what the palette rules scored.
  assert.deepEqual(swatchOklch({ oklch: measured, hex: '#FFFFFF', name: 'white' }), measured);
  // Then the stored hex.
  assert.deepEqual(swatchOklch({ hex: '#1F2A44', name: 'white' }), hexToOklch('#1F2A44'));
  // Then the name, through the wardrobe table.
  assert.ok(swatchOklch({ name: 'navy' }), 'a wardrobe colour name did not resolve');
});

test('a piece with no colour resolves to nothing rather than to a guess', () => {
  assert.equal(swatchOklch(null), null);
  assert.equal(swatchOklch({}), null);
  assert.equal(swatchOklch({ hex: null, name: null }), null);
  // A name nobody's wardrobe uses is not forced into the nearest family: the
  // caller draws its own ground, which is honest, where a wrong colour is not.
  assert.equal(swatchOklch({ name: 'zzzzz' }), null);
  assert.equal(garmentSwatch({ name: '   ' }), null);
});

test('a malformed hex falls through to the name instead of throwing', () => {
  // `items.colors` is jsonb and the schema lets `hex` be null; a row written by
  // an older tagger can carry something that will not parse. A list projection
  // must not throw on one bad cell.
  const swatch = garmentSwatch({ hex: 'not-a-hex', name: 'navy' });
  assert.ok(swatch, 'a bad hex took the name down with it');
});

test('the ink flips on perceptual lightness, so type passes on any hue', () => {
  const onDark = garmentSwatch({ oklch: { L: 0.2, C: 0.05, h: 250 } });
  const onLight = garmentSwatch({ oklch: { L: 0.9, C: 0.02, h: 90 } });
  assert.ok(onDark && onLight);
  assert.notEqual(onDark.ink, onLight.ink, 'both grounds took the same ink');
  assert.match(onDark.ink, /^#FFFFFF/, 'a near-black ground took dark type');
  assert.match(onLight.ink, /^#1C1A16/, 'a near-white ground took light type');

  // The flip is on `L` alone, so a saturated mid-tone at any hue answers the
  // same way — the reason this is OKLCH and not an sRGB luminance test.
  const hues = [0, 60, 120, 180, 240, 300].map((h) => garmentSwatch({ oklch: { L: 0.3, C: 0.15, h } }));
  assert.equal(new Set(hues.map((s) => s?.ink)).size, 1, 'the ink varied by hue');
});

test('the ground is always a drawable hex', () => {
  for (const input of [
    { oklch: { L: 0.5, C: 0.12, h: 20 } },
    { hex: '#1F2A44' },
    { name: 'cognac' },
  ]) {
    const swatch = garmentSwatch(input);
    assert.ok(swatch, `${JSON.stringify(input)} produced no swatch`);
    assert.match(swatch.background, /^#[0-9A-Fa-f]{6}$/);
  }
});

test('a caller’s own ground gets an ink chosen the same way', () => {
  // The untagged-piece path: no colour resolved, so the surface supplies its
  // theme's tray and still needs type that will pass on it.
  assert.match(swatchInkOn('#F0ECE3'), /^#1C1A16/);
  assert.match(swatchInkOn('#1C1A16'), /^#FFFFFF/);
  // And an unparseable ground does not throw — it takes the dark ink, which is
  // the one that passes on every ground this app actually paints.
  assert.match(swatchInkOn('rgba(0,0,0,0.2)'), /^#1C1A16/);
});
