/**
 * Wave 3 Group 1 — The Ten's grid geometry and its one AX recomposition, plus
 * the procession's drop band.
 *
 * These are the rules a component would otherwise state as magic numbers. The
 * atlas is explicit that larger type is solved "with height, wrapping and
 * recomposition — never by capping the scale further or adding ellipses", and a
 * rule stated only inside a `<View style>` is a rule nothing can hold.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEV_DRAFTS } from '../src/features/intake/dev-fixtures';
import {
  initProcession,
  lastDropped,
  processionReducer,
  UNDO_DEPTH,
} from '../src/features/intake/procession';
import {
  isAccessibilityScale,
  TEN_AX_FONT_SCALE,
  TEN_COLUMNS,
  TEN_COLUMNS_AX,
  TEN_GAP,
  tenColumns,
  tenTileHeight,
  tenTileWidth,
} from '../src/features/onboarding/ten-layout';

test('the grid is three columns at every ordinary type size', () => {
  for (const scale of [1, 1.1, 1.2, 1.34]) {
    assert.equal(tenColumns(scale), TEN_COLUMNS, `at ${scale}`);
    assert.equal(isAccessibilityScale(scale), false, `at ${scale}`);
  }
});

test('T-02 / AX — at accessibility sizes the grid drops to two columns', () => {
  for (const scale of [TEN_AX_FONT_SCALE, 1.5, 1.8]) {
    assert.equal(tenColumns(scale), TEN_COLUMNS_AX, `at ${scale}`);
    assert.equal(isAccessibilityScale(scale), true, `at ${scale}`);
  }
});

test('the cell is landscape normally and square at accessibility sizes', () => {
  // 393pt frame, 20pt gutters: the atlas's own measured column, to a point.
  const content = 393 - 40;
  const wide = tenTileWidth(content, 1);
  assert.equal(Math.round(wide), 112);
  // Landscape, at the ratio the atlas draws — 86 tall in a 111 column — rather
  // than at its own stale "111×135 pt" annotation, which the drawing does not
  // agree with. A square cell here costs ~44% more height than the grid has and
  // pushes the tenth slot below the fold, which breaks the single rule T-01
  // states outright.
  assert.ok(tenTileHeight(wide, 1) < wide);
  assert.equal(tenTileHeight(wide, 1), Math.round(wide * (86 / 111)));

  const ax = tenTileWidth(content, 1.8);
  // Two columns, so the cell is wider — and square, which buys the label the
  // height it needs at the largest setting instead of shrinking it.
  assert.ok(ax > wide);
  assert.equal(tenTileHeight(ax, 1.8), Math.round(ax));
});

test('the gap is on the spacing scale', () => {
  assert.ok([1, 8, 12, 20, 24, 28, 44].includes(TEN_GAP));
});

test('column arithmetic accounts for the gaps, at both column counts', () => {
  const content = 353;
  assert.equal(tenTileWidth(content, 1) * 3 + TEN_GAP * 2, content);
  assert.equal(tenTileWidth(content, 1.8) * 2 + TEN_GAP, content);
});

// ---------------------------------------------------------------------------
// PR-05 — the drop band
// ---------------------------------------------------------------------------

test('PR-05 — the band names the card that was dropped', () => {
  const state = processionReducer(initProcession([...DEV_DRAFTS], 0), { type: 'reject' });
  const dropped = lastDropped(state);
  assert.ok(dropped);
  assert.equal(dropped.name, DEV_DRAFTS[0]!.name);
  // Marked, never deleted — which is what makes Undo able to bring it back.
  assert.equal(dropped.state, 'rejected');
  assert.equal(state.drafts.length, DEV_DRAFTS.length);
});

test('PR-05 — the band clears on the next decision, without a timer', () => {
  // "A tray band that stays until the next decision, not a toast that vanishes
  // on a timer." Derived from the top of the undo stack, so the next decision
  // is what removes it — there is no dismissal to delay or hide.
  let state = processionReducer(initProcession([...DEV_DRAFTS], 0), { type: 'reject' });
  assert.ok(lastDropped(state));
  state = processionReducer(state, { type: 'confirm' });
  assert.equal(lastDropped(state), null);
});

test('PR-01 — a confirm never raises the drop band', () => {
  const state = processionReducer(initProcession([...DEV_DRAFTS], 0), { type: 'confirm' });
  assert.equal(lastDropped(state), null);
});

test('PR-05 — undo restores the dropped card exactly, and stops at three', () => {
  let state = initProcession([...DEV_DRAFTS], 0);
  state = processionReducer(state, { type: 'reject' });
  const restored = processionReducer(state, { type: 'undo' });
  assert.equal(restored.drafts[0]!.state, DEV_DRAFTS[0]!.state);
  assert.equal(lastDropped(restored), null);

  // Depth is three, and at three the control simply stops offering more.
  let deep = initProcession([...DEV_DRAFTS], 0);
  for (let i = 0; i < 5; i += 1) deep = processionReducer(deep, { type: 'reject' });
  assert.equal(deep.undo.length, UNDO_DEPTH);
});

// ---------------------------------------------------------------------------
// The fixture data itself
// ---------------------------------------------------------------------------

test('the fixture walkthrough is the atlas’s own twenty-three cards', () => {
  // The fixture routes print "of 23" from this list rather than from a
  // literal, so the list has to actually be twenty-three.
  assert.equal(DEV_DRAFTS.length, 23);
  // Exactly one ambiguous card, which is what PR-03 opens on.
  assert.equal(DEV_DRAFTS.filter((d) => d.state === 'ambiguous').length, 1);
});

test('nothing in the fixture data is time-dependent', () => {
  // A fixture that dated itself could not be photographed twice with the same
  // bytes, which is the hard requirement on every route in this group.
  const stamps = new Set(DEV_DRAFTS.map((d) => d.created_at));
  assert.equal(stamps.size, 1);
});
