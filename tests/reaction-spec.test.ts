/**
 * The reaction pill's contract. Audit item 49.
 *
 * This is the one control the reader has already committed to, and two of its
 * rules exist because the card used to move under a confirming finger. Neither
 * is visible in a rendered tree: a faded pill and a hidden one look identical
 * in a snapshot and behave completely differently for a screen reader.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reactionPillSpec, slotAccessibility } from '../src/components/today/reaction-spec';

test('the chosen pill never dims, even while the row is refusing input', () => {
  // It is a record of what happened, not a control awaiting permission.
  const chosen = reactionPillSpec({ tone: 'accent', selected: true, disabled: true });
  assert.equal(chosen.dimmed, false);
  assert.ok(!chosen.ground.includes('opacity-40'));
});

test('the unchosen pill dims while disabled', () => {
  const other = reactionPillSpec({ tone: 'ink', selected: false, disabled: true });
  assert.equal(other.dimmed, true);
  assert.ok(other.ground.includes('opacity-40'));
});

test('a selected pill fills and an unselected one rings', () => {
  assert.ok(reactionPillSpec({ tone: 'accent', selected: true }).ground.includes('bg-accent'));
  assert.ok(reactionPillSpec({ tone: 'ink', selected: true }).ground.includes('bg-ink'));
  for (const tone of ['accent', 'ink'] as const) {
    const resting = reactionPillSpec({ tone, selected: false });
    assert.ok(resting.ground.includes('border border-rule'));
    assert.ok(!resting.ground.includes('bg-'), 'an unselected pill must not fill');
  }
});

test('the label reads on whatever it sits on', () => {
  // Canvas once chosen; otherwise the tone decides how loud the resting label
  // is — accent's resting pill is a real choice, ink's is the quieter one.
  assert.equal(reactionPillSpec({ tone: 'accent', selected: true }).label, 'canvas');
  assert.equal(reactionPillSpec({ tone: 'ink', selected: true }).label, 'canvas');
  assert.equal(reactionPillSpec({ tone: 'accent', selected: false }).label, 'ink');
  assert.equal(reactionPillSpec({ tone: 'ink', selected: false }).label, 'muted');
});

test('selection is announced, not merely drawn', () => {
  const spec = reactionPillSpec({ tone: 'accent', selected: true, disabled: false });
  assert.deepEqual(spec.accessibilityState, { selected: true, disabled: false });
});

test('a hidden slot leaves the VoiceOver order entirely', () => {
  // The slot keeps its width so the chosen pill does not move — but a pill
  // faded to zero is not a control, and a reader swiping the row must not land
  // on an invisible button.
  const hidden = slotAccessibility(false);
  assert.equal(hidden.opacity, 0);
  assert.equal(hidden.accessibilityElementsHidden, true);
  assert.equal(hidden.importantForAccessibility, 'no-hide-descendants');
  assert.equal(hidden.pointerEvents, 'none', 'an invisible pill must not swallow taps');
});

test('a visible slot is fully interactive', () => {
  assert.deepEqual(slotAccessibility(true), {
    opacity: 1,
    accessibilityElementsHidden: false,
    importantForAccessibility: 'auto',
    pointerEvents: 'auto',
  });
});

test('every pill clears a reachable height', () => {
  // 40 drawn, inside a row that pads it out — below this the two pills start
  // competing with the wear action beside them.
  assert.equal(reactionPillSpec({ tone: 'ink', selected: false }).minHeight, 40);
});
