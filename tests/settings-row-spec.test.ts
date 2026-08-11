/**
 * SettingsRow's contract. Audit item 49.
 *
 * Two of its five outputs are promises to the reader rather than decoration,
 * and both are invisible in a rendered tree unless you already know which row
 * you are looking at.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { settingsRowSpec } from '../src/components/ui/settings-row-spec';

test('a row that leaves the app says so, with a glyph and out loud', () => {
  // `chevron.right` means "further in". A row handing you to Safari is not
  // further in, and iOS marks that with the up-right arrow. Two glyphs for two
  // different promises.
  const external = settingsRowSpec({ external: true });
  assert.equal(external.glyph, 'arrow.up.right');
  assert.equal(external.accessibilityHint, 'Opens in your browser');

  const internal = settingsRowSpec({ external: false });
  assert.equal(internal.glyph, 'chevron.right');
  assert.equal(internal.accessibilityHint, undefined, 'an in-app row must not claim to leave');
});

test('an external row draws its glyph a step louder than an internal one', () => {
  // `byline` over `faint` — the arrow is a warning, not furniture.
  assert.equal(settingsRowSpec({ external: true }).icon, 'byline');
  assert.equal(settingsRowSpec({ external: false }).icon, 'faint');
});

test('the accent tone overrides external, because it is the louder promise', () => {
  // Delete account is the only accent row in the app; if it ever also opened a
  // browser, oxblood is still the thing to notice.
  assert.equal(settingsRowSpec({ tone: 'accent', external: true }).icon, 'accent');
  assert.equal(settingsRowSpec({ tone: 'accent' }).labelClass, 'text-accent');
  assert.equal(settingsRowSpec({ tone: 'ink' }).labelClass, 'text-ink');
});

test('a loading row is inert but NOT dimmed', () => {
  // Dimming mid-request flashes the row grey on every tap and reads as a
  // rejection. It refuses input; it does not look refused.
  const loading = settingsRowSpec({ loading: true });
  assert.equal(loading.inert, true);
  assert.equal(loading.opacity, 1);
  assert.deepEqual(loading.accessibilityState, { busy: true, disabled: true });
});

test('a disabled row is dimmed and not busy', () => {
  // AC-06's back-fill row exists before tagging is on, and says so underneath:
  // inert rather than absent, because a row appearing out of nowhere after a
  // toggle is the worse surprise.
  const disabled = settingsRowSpec({ disabled: true });
  assert.equal(disabled.opacity, 0.4);
  assert.deepEqual(disabled.accessibilityState, { busy: false, disabled: true });
});

test('a resting row is neither busy nor disabled', () => {
  const resting = settingsRowSpec();
  assert.equal(resting.inert, false);
  assert.equal(resting.opacity, 1);
  assert.deepEqual(resting.accessibilityState, { busy: false, disabled: false });
});

test('every row clears the tap floor', () => {
  for (const tone of ['ink', 'accent'] as const) {
    assert.ok(settingsRowSpec({ tone }).minHeight >= 44);
  }
});
