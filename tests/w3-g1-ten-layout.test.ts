/**
 * Wave 3 Group 1 — the procession's drop band, and its fixture data.
 *
 * ── WHAT LEFT THIS FILE, AND WHERE IT WENT ─────────────────────────────────
 *
 * This used to open with five tests over `features/onboarding/ten-layout.ts`:
 * the three-up grid, the two-column accessibility recomposition, the 86/111
 * landscape cell, the 8pt gap, and the column arithmetic. Redesign 21 replaced
 * that module with `ten-spec.ts` and every one of those numbers with a
 * different one — the wells are PORTRAIT now, the gap is 12 across and 8 down,
 * and the tenth well spans the tray instead of taking a cell — so the tests
 * were not adjusted, they were superseded. Their successors are in
 * `tests/the-ten-layout.test.ts`, which pins the same five rules against the
 * frames that are actually shipping, plus the band and the foot the old atlas
 * had no equivalent of.
 *
 * The AX THRESHOLD is the one value that crossed over unchanged (1.35, still
 * argued the same way), and it is asserted in the new file so the recomposition
 * boundary never became unpinned in the move.
 *
 * What stays here is the half of this file that was never about The Ten: the
 * procession's drop band, and the twenty-three-card fixture deck.
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
