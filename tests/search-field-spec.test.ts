/**
 * SearchField's geometry. Audit item 49.
 *
 * These constants are what stopped three screens hand-typing the same eight
 * lines — down to the literal `paddingVertical: 11`. Pinning them is what keeps
 * that divergence closed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLEAR_FILL,
  CLEAR_HIT_SLOP,
  CLEAR_SIZE,
  clearTouchSize,
  INPUT_FONT_SIZE,
  INPUT_PADDING_Y,
  showsClear,
} from '../src/components/ui/search-field-spec';

test('the clear disc is 17pt drawn and clears 44pt touched', () => {
  // The whole point of the slop. A future edit that shrinks the disc without
  // growing the slop leaves a control under the floor with nothing on screen
  // to show it.
  assert.equal(CLEAR_SIZE, 17);
  assert.equal(clearTouchSize(), CLEAR_SIZE + CLEAR_HIT_SLOP * 2);
  assert.ok(clearTouchSize() >= 44, `clear disc touches only ${clearTouchSize()}pt`);
});

test('the clear disc appears on content, never on focus', () => {
  // A clear button that appears on focus moves the text's right edge under the
  // cursor mid-type.
  assert.equal(showsClear(''), false);
  assert.equal(showsClear('a'), true);
  assert.equal(showsClear('  '), true, 'whitespace is content the user can clear');
});

test('the field is set a half-step under body', () => {
  // 16, so the field reads as a door rather than a page.
  assert.equal(INPUT_FONT_SIZE, 16);
  assert.ok(INPUT_FONT_SIZE < 17);
});

test('the vertical padding is the literal three screens used to copy', () => {
  assert.equal(INPUT_PADDING_Y, 11);
});

test('the clear fill is warm ink, not a system grey', () => {
  // UIKit's own clear button is cool-toned and reads cold on a warm page.
  assert.match(CLEAR_FILL, /^rgba\(28,26,22,/);
});
