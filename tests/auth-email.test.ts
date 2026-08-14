/**
 * The email shape check behind the sign-in flow's Continue button.
 *
 * The contract under test: `isValidEmail` decides when the pill arms and when
 * the label line swaps to "That address is missing something" (W-05/W-06), and
 * `normalizeEmail` is what `sendEmailCode` actually sends. The check is
 * deliberately cheap — the real validation is the code arriving — so these
 * assertions pin the obvious typo class, not RFC 5321.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { isValidEmail, normalizeEmail } from '../src/features/auth/email';
// A leaf module — no React Native in its graph, so the line-box arithmetic the
// wordmark guard below rests on is computed rather than asserted about.
import { leading, minLineHeight } from '../src/theme/font-metrics.js';

test('a plain address parses', () => {
  assert.equal(isValidEmail('maya@hey.com'), true);
});

test('the atlas’s own malformed example does not parse', () => {
  // W-06 draws exactly this string over the oxblood underline.
  assert.equal(isValidEmail('maya@hey'), false);
});

test('surrounding whitespace and case do not count against an address', () => {
  assert.equal(isValidEmail('  Maya@Hey.com  '), true);
  assert.equal(normalizeEmail('  Maya@Hey.com  '), 'maya@hey.com');
});

test('the empty and hopeless shapes do not parse', () => {
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail('maya'), false);
  assert.equal(isValidEmail('@hey.com'), false);
  assert.equal(isValidEmail('maya@'), false);
  assert.equal(isValidEmail('maya@hey.c'), false); // TLD needs two characters
  assert.equal(isValidEmail('maya ellison@hey.com'), false);
  assert.equal(isValidEmail('maya@hey com'), false);
});

test('subdomains, plus-tags and long TLDs parse', () => {
  assert.equal(isValidEmail('maya+cinch@mail.hey.com'), true);
  assert.equal(isValidEmail('maya@hey.fashion'), true);
});

// ---------------------------------------------------------------------------
// W-01 — the cover's wordmark
// ---------------------------------------------------------------------------

/**
 * A source guard, in the style the screen tests use: `(auth)/sign-in.tsx`
 * imports Skia, `expo-apple-authentication` and React Native, none of which the
 * node bundler can resolve. `leading` is a leaf module, so the arithmetic the
 * guard compares against is computed for real rather than typed here.
 */
test('W-01 — the wordmark’s line box is at least the font’s own', () => {
  const src = readFileSync('src/app/(auth)/sign-in.tsx', 'utf8');

  // Instrument Serif's ascent and descent total 1.30 em, so "Cinch" at 40
  // needs 52 points of line box. It shipped with `lineHeight: px(40)` and iOS
  // sliced the tops off the C and the h — on every device, at every inset,
  // because the clip is inside the text's own box rather than against the safe
  // area. A literal here is how that comes back.
  assert.match(src, /const WORDMARK_SIZE = 40;/);
  assert.match(src, /const WORDMARK_LEADING = leading\('instrument', WORDMARK_SIZE, [\d.]+\);/);
  assert.match(src, /fontSize: px\(WORDMARK_SIZE\)/);
  assert.match(src, /lineHeight: px\(WORDMARK_LEADING\)/);

  // Whatever ratio the file asks for, the helper floors at the natural box —
  // this asserts the floor is genuinely above the glyph size, so the guard
  // above is protecting something.
  assert.ok(leading('instrument', 40, 1.05) >= minLineHeight('instrument', 40));
  assert.equal(minLineHeight('instrument', 40), 52);

  // The top offset is NOT the fix and must not be mistaken for one later: the
  // row still sits at the inset plus the atlas's own 8, unchanged.
  assert.match(src, /top: insets\.top \+ px\(8\)/);
});
