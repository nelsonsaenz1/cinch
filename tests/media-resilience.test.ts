/**
 * UX-06 — no blank unexplained wells, on the surfaces worktree A owns.
 *
 * Every garment picture in this app is a private storage object behind a signed
 * URL that is re-issued every fifty minutes. The shipped call sites all read
 * `uri ? <Image/> : <mark/>`, which covers a missing PATH and nothing else: a
 * fetch that fails, a signature that expired between the render and the
 * request, and a body that will not decode all took the `uri` branch and drew
 * an empty rectangle.
 *
 * The arithmetic is in `components/media/media-state.ts` — a leaf module with no
 * React and no React Native in its graph precisely so this file can import it
 * and check it for real. The adoption is checked as source, like the rest of
 * this suite: the components import React Native and the test bundler cannot
 * follow its Flow source.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  mediaSource,
  mediaWell,
  pictureKey,
  samePicture,
} from '../src/components/media/media-state.ts';

const code = (p: string) => readFileSync(p, 'utf8');
/** Source with comments stripped — a rule quoted in prose is not a rule kept. */
const stripped = (p: string) =>
  code(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

const PRIMITIVE = 'src/components/media/garment-image.tsx';

/**
 * Every well on Closet, Today, Item and Plan that draws a signed garment URL.
 *
 * `today/sample-plate.tsx` is deliberately absent: its pictures are bundled
 * `require`d assets, so there is no signature to expire and no fetch to fail.
 */
const ADOPTED = [
  'src/components/closet/item-card.tsx',
  'src/components/closet/rail-card.tsx',
  'src/components/closet/plate-thumb.tsx',
  'src/components/today/garment-cell.tsx',
  'src/components/item/item-hero.tsx',
  'src/components/plan/day-row.tsx',
  'src/components/plan/day-expanded.tsx',
];

// ---------------------------------------------------------------------------
// The four ways a well ends up empty, and the one thing a reader sees
// ---------------------------------------------------------------------------

test('a well with no URL, and a well whose load failed, draw the same fallback', () => {
  // Two causes, one fact: the photograph is not available. Splitting them would
  // give a reader two apologies for one outcome.
  assert.equal(mediaWell(null, 'loading'), 'fallback');
  assert.equal(mediaWell(undefined, 'loaded'), 'fallback');
  assert.equal(mediaWell('', 'loaded'), 'fallback');
  assert.equal(mediaWell('https://x/garments/a/b/cutout.jpg?token=1', 'failed'), 'fallback');
});

test('a well that is still loading shows its ground, not the fallback mark', () => {
  // Flashing "no photograph yet" for the frame before a photograph arrives
  // makes every scroll flicker between two truths.
  assert.equal(mediaWell('https://x/garments/a/b/cutout.jpg?token=1', 'loading'), 'waiting');
  assert.equal(mediaWell('https://x/garments/a/b/cutout.jpg?token=1', 'loaded'), 'photograph');
});

// ---------------------------------------------------------------------------
// The reset key — which is also the disk-cache key
// ---------------------------------------------------------------------------

test('a re-signed URL is the same picture', () => {
  // `useSignedUrls` renews every fifty minutes. If the load phase reset on the
  // raw URI, a loaded well would flash back to its ground every fifty minutes
  // and a FAILED well would re-request a dead object forever — which is the
  // retry loop the implementation plan forbids.
  const a = 'https://s.co/garments/u1/i1/cutout.jpg?token=aaa';
  const b = 'https://s.co/garments/u1/i1/cutout.jpg?token=bbb';
  assert.ok(samePicture(a, b));
  assert.equal(pictureKey(a), 'https://s.co/garments/u1/i1/cutout.jpg');
  assert.equal(mediaSource(a)?.cacheKey, mediaSource(b)?.cacheKey);
  assert.equal(mediaSource(a)?.uri, a, 'the fetch must still use the live signature');
});

test('two different garments are never the same picture', () => {
  assert.ok(
    !samePicture(
      'https://s.co/garments/u1/i1/cutout.jpg?token=a',
      'https://s.co/garments/u1/i2/cutout.jpg?token=a',
    ),
  );
});

test('a URL whose identity lives in its query keeps the whole query', () => {
  // Metro's dev asset server is exactly this shape. Stripping there yields
  // `http://localhost:8081/assets/` for EVERY garment, so expo-image files them
  // all under one key and the first photograph to decode is served for all of
  // them — a mohair sweater under the title of a shearling coat, which is what
  // `dev-item` showed before `item-hero.tsx` worked this out.
  const coat = 'http://localhost:8081/assets/?unstable_path=.%2Fassets%2Fgarments%2Fcoat.jpg';
  const knit = 'http://localhost:8081/assets/?unstable_path=.%2Fassets%2Fgarments%2Fknit.jpg';
  assert.equal(pictureKey(coat), coat);
  assert.ok(!samePicture(coat, knit), 'two dev-server garments collapsed into one cache key');
});

test('nothing in, nothing out', () => {
  assert.equal(pictureKey(null), null);
  assert.equal(mediaSource(null), undefined);
  assert.equal(mediaSource(''), undefined);
});

// ---------------------------------------------------------------------------
// The primitive's own refusals
// ---------------------------------------------------------------------------

test('the primitive never logs, and never reads the error it is handed', () => {
  // expo-image's error message can carry the request URL, and a signed URL is a
  // bearer credential for a photograph of someone's clothes and their home.
  const src = stripped(PRIMITIVE);
  assert.doesNotMatch(src, /console\./, 'the media primitive logs');
  assert.doesNotMatch(src, /captureException|analytics|track\(/, 'the media primitive reports');
  assert.match(src, /onError=\{\(\) =>/, 'the error event is destructured rather than discarded');
});

test('a failed load is sticky until the picture itself changes', () => {
  // No timer, no attempt counter, no refetch: the only thing that clears a
  // failure is a new `pictureKey`, and pull-to-refresh is the retry on every
  // screen this appears on.
  const src = stripped(PRIMITIVE);
  assert.doesNotMatch(src, /setTimeout|setInterval|retr(y|ies)/i, 'the fallback retries');
  assert.match(src, /if \(nextKey !== key\) \{\s*setKey\(nextKey\);\s*setPhase\('loading'\);/);
});

test('the well holds its geometry through every state', () => {
  // A well that resized when a load failed would reflow the name and the
  // metadata under it, which is the second half of a blank well.
  const src = stripped(PRIMITIVE);
  assert.match(src, /box: \{ flex: 1 \}/);
  assert.match(src, /position: 'absolute'/, 'the fallback is not drawn over the box');
});

// ---------------------------------------------------------------------------
// Adoption
// ---------------------------------------------------------------------------

test('every owned garment well goes through the shared primitive', () => {
  for (const file of ADOPTED) {
    const src = stripped(file);
    assert.match(src, /<GarmentImage/, `${file} still draws a garment well by hand`);
    assert.doesNotMatch(
      src,
      /from 'expo-image'/,
      `${file} still reaches past the primitive to expo-image`,
    );
  }
});

test('the item hero reads the WELL, not the URL, for its floating discs', () => {
  // A hero whose signature expired has a string in `imageUri` and a pale tray
  // on screen, and a canvas-coloured chevron on a tray is an invisible way out
  // of the screen.
  const src = stripped('src/components/item/item-hero.tsx');
  assert.match(src, /onWell=\{\(well\) => setOnPhoto\(well === 'photograph'\)\}/);
  assert.doesNotMatch(src, /const onPhoto = imageUri !== null/);
});

test('the share card still captures its garments unfaded', () => {
  // `paper` is print mode: view-shot would otherwise capture garments
  // mid-transition, at partial opacity.
  assert.match(stripped('src/components/today/garment-cell.tsx'), /transition=\{paper \? 0 : 200\}/);
});
