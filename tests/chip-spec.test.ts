/**
 * Chip's contract, swept across its whole state space. Audit item 49.
 *
 * Chip has the widest space of the six — tone × selected × selectedGround ×
 * size is 24 combinations resolved in a ternary chain. Two bugs shipped from
 * exactly that shape and both are pinned by name below.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chipSpec,
  COMPACT_HEIGHT,
  DASHED_RING,
  everyChipCombination,
} from '../src/components/ui/chip-spec';

test('every combination resolves to exactly one ground', () => {
  // A chain that falls through would return an empty ground, which renders as
  // an invisible chip rather than as an error.
  for (const input of everyChipCombination()) {
    const { ground } = chipSpec(input);
    assert.ok(ground.length > 0, JSON.stringify(input));
    const fills = ['bg-sand', 'bg-ink', 'bg-accent', 'bg-transparent'].filter((f) =>
      ground.split(' ').includes(f),
    );
    assert.equal(fills.length, 1, `${JSON.stringify(input)} → ${ground}`);
  }
});

test('the selected chip never draws its label in muted', () => {
  // The bug that shipped: `variant="label"` carries `text-muted`, a
  // `text-canvas` class had no defined precedence over it, and the selected
  // chip read muted-on-accent.
  for (const input of everyChipCombination().filter((c) => c.selected && c.tone === 'outline')) {
    assert.equal(chipSpec(input).label, 'canvas', JSON.stringify(input));
  }
});

test('a tap chip rings at rule and a compact one at hairline', () => {
  // The other shipped bug, and an inversion: the atlas draws the dress-code
  // row a step STRONGER than the fields above it (.18 against .12), and at
  // hairline (.09) the app rendered it weaker.
  assert.ok(chipSpec({ size: 'tap' }).ground.includes('border-rule'));
  assert.ok(chipSpec({ size: 'compact' }).ground.includes('border-hairline'));
});

test('a tap chip is 44pt of real geometry and takes no vertical slop', () => {
  // Overlapping slop between wrapped rows makes the boundary a coin toss.
  const tap = chipSpec({ size: 'tap' });
  assert.equal(tap.minHeight, 44);
  assert.equal(tap.hitSlop.top, 0);
  assert.equal(tap.hitSlop.bottom, 0);
});

test('a compact chip is 32pt drawn and borrows the rest of the floor', () => {
  const compact = chipSpec({ size: 'compact' });
  assert.equal(compact.minHeight, COMPACT_HEIGHT);
  assert.equal(compact.minHeight, 32);
  assert.equal(compact.minHeight + compact.hitSlop.top + compact.hitSlop.bottom, 48);
  assert.ok(compact.minHeight + compact.hitSlop.top + compact.hitSlop.bottom >= 44);
});

test('the selected ground follows selectedGround, and only when selected', () => {
  assert.ok(chipSpec({ selected: true, selectedGround: 'ink' }).ground.includes('bg-ink'));
  assert.ok(chipSpec({ selected: true, selectedGround: 'accent' }).ground.includes('bg-accent'));
  // Unselected must ignore it entirely, or a closet chip would fill on render.
  for (const g of ['accent', 'ink'] as const) {
    assert.ok(chipSpec({ selected: false, selectedGround: g }).ground.includes('bg-transparent'));
  }
});

test('fill is read-only: it takes no ring and never fills on selection', () => {
  // `fill` is the descriptive tag the approved closet frame draws. It has no
  // selected state to change into, which is why it is scoped rather than made
  // the global style.
  for (const selected of [false, true]) {
    const spec = chipSpec({ tone: 'fill', selected });
    assert.ok(spec.ground.includes('bg-sand'));
    assert.ok(!spec.ground.includes('border'), 'fill must not draw a ring');
  }
});

test('dashed carries the raised ring alpha and a muted label', () => {
  // The absence of a tag, drawn as one. At `rule` (12%) a dashed ring breaks
  // into dots that read as dirt.
  const spec = chipSpec({ tone: 'dashed' });
  assert.equal(spec.borderColor, DASHED_RING);
  assert.ok(spec.ground.includes('border-dashed'));
  assert.equal(spec.label, 'muted');
});

test('only the dashed tone sets an inline border colour', () => {
  for (const input of everyChipCombination().filter((c) => c.tone !== 'dashed')) {
    assert.equal(chipSpec(input).borderColor, undefined, JSON.stringify(input));
  }
});

test('the count suffix dims against a filled ground', () => {
  // B3 is ~70% — a count on the accent must not compete with the label.
  assert.deepEqual(chipSpec({ selected: true }).count, { token: 'canvas', alpha: 'B3' });
  assert.deepEqual(chipSpec({ selected: false }).count, { token: 'muted' });
});

test('a chip with no press handler gets no pressed feedback', () => {
  // A read-only tag that dims under a finger claims to be a control.
  assert.ok(!chipSpec({ pressable: false }).ground.includes('active:opacity-60'));
  assert.ok(chipSpec({ pressable: true }).ground.includes('active:opacity-60'));
});

test('padding is 16 at tap and 14 when compact', () => {
  // A taller chip with the tighter padding reads as a stretched compact one.
  assert.equal(chipSpec({ size: 'tap' }).padding, 'px-4');
  assert.equal(chipSpec({ size: 'compact' }).padding, 'px-3.5');
});
