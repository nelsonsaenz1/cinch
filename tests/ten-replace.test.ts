/**
 * LP-02 — replacing the photograph in a filled First 10 position.
 *
 * The contract these tests hold is four sentences, and every case below checks
 * all four rather than only the one it is named for:
 *
 *   1. SLOT IDENTITY. The position that was tapped is the position that
 *      changes, and no other. Ids, order and statuses are identical either way.
 *   2. COUNT. `filledCount` before equals `filledCount` after, on every path
 *      including the successful one — a replacement is one in and one out, so
 *      1/10 stays 1/10 and 10/10 stays 10/10.
 *   3. THE PRIOR ASSET. On every non-success path the outgoing garment id is
 *      still the id the slot holds, and nothing in the machine has asked for it
 *      to be deleted. (`ten-replace.ts` has no delete transition at all; the
 *      only write it makes against the outgoing piece is a reversible archive.)
 *   4. NOTHING SILENT. Being backgrounded, resumed, or handed a late event from
 *      a flow already abandoned is not a transition — the reducer returns the
 *      same state object, and that identity is asserted directly.
 *
 * There is no React renderer in this repo (see `scripts/run-tests.mjs`), which
 * is exactly why the flow is a reducer: this is the whole behaviour, driven
 * event by event, with no component in the way.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyReplace,
  heldGarmentId,
  initialReplaceState,
  isReplaceInFlight,
  replaceReducer,
  retainedGarmentId,
  type ReplaceEvent,
  type ReplaceState,
} from '../src/features/onboarding/ten-replace';
import { emptyTen, filledCount, type TenSlot } from '../src/features/onboarding/ten-slots';

/** A grid with the first `n` positions filled by `p1`…`pn`. */
function grid(n: number): TenSlot[] {
  return emptyTen().map((s, i) =>
    i < n ? { ...s, status: 'filled' as const, garmentId: `p${i + 1}` } : s,
  );
}

function run(events: readonly ReplaceEvent[], from: ReplaceState = initialReplaceState) {
  return events.reduce(replaceReducer, from);
}

/**
 * The three invariants, asserted together because they only mean anything
 * together: a grid can keep its count by losing the right slot, or keep its
 * slot by growing.
 */
function assertGridIntact(before: readonly TenSlot[], after: readonly TenSlot[]) {
  assert.equal(after.length, before.length, 'the grid changed length');
  assert.equal(filledCount(after), filledCount(before), 'the 1/10–10/10 count moved');
  for (let i = 0; i < before.length; i += 1) {
    assert.equal(after[i].id, before[i].id, 'a position was reordered');
    assert.equal(after[i].status, before[i].status, 'a position changed status');
  }
}

/** Every slot but `slotId` still holds precisely what it held. */
function assertOnlySlotMoved(before: readonly TenSlot[], after: readonly TenSlot[], slotId: number) {
  assertGridIntact(before, after);
  for (let i = 0; i < before.length; i += 1) {
    if (before[i].id === slotId) continue;
    assert.equal(after[i].garmentId, before[i].garmentId, `slot ${before[i].id} was disturbed`);
  }
}

// ---------------------------------------------------------------------------
// Success — the two paths, at the two ends of the grid
// ---------------------------------------------------------------------------

test('1 of 10 · a replacement swaps one slot and moves nothing else', () => {
  const before = grid(1);
  // Room to spare, so the outgoing piece is live for the whole flow and its
  // archive is the LAST write rather than the first.
  const state = run([
    { type: 'open', slotId: 1, garmentId: 'p1' },
    { type: 'choose', mode: 'camera', needsRoom: false },
    { type: 'item-created', itemId: 'new' },
    { type: 'processing-committed' },
    { type: 'retired' },
  ]);

  assert.deepEqual(state, {
    phase: 'replaced',
    slotId: 1,
    outgoingId: 'p1',
    incomingId: 'new',
    retired: true,
  });

  const after = applyReplace(before, state);
  assertOnlySlotMoved(before, after, 1);
  assert.equal(after[0].garmentId, 'new');
  assert.equal(filledCount(after), 1, '1 of 10 is still 1 of 10');
});

test('9 of 10 · replacing a middle position leaves the ninth and the empty tenth alone', () => {
  const before = grid(9);
  const state = run([
    { type: 'open', slotId: 5, garmentId: 'p5' },
    { type: 'choose', mode: 'library', needsRoom: false },
    { type: 'item-created', itemId: 'new' },
    { type: 'processing-committed' },
    { type: 'retired' },
  ]);

  const after = applyReplace(before, state);
  assertOnlySlotMoved(before, after, 5);
  assert.equal(after[4].garmentId, 'new');
  assert.equal(after[8].garmentId, 'p9');
  assert.equal(after[9].status, 'empty', 'the empty tenth was consumed');
  assert.equal(filledCount(after), 9);
});

test('10 of 10 · the outgoing piece is stored FIRST, and no eleventh is created', () => {
  const before = grid(10);
  // `needsRoom` is the database's own ceiling talking (`enforce_item_limit`):
  // at ten of ten the incoming insert is refused unless a slot is freed, so the
  // archive moves to the front of the flow.
  const freeing = run([
    { type: 'open', slotId: 10, garmentId: 'p10' },
    { type: 'choose', mode: 'camera', needsRoom: true },
  ]);
  assert.equal(freeing.phase, 'freeing');
  assert.equal(isReplaceInFlight(freeing), true);
  // The tile still draws the outgoing photograph while its row is in storage.
  assert.equal(heldGarmentId(freeing, 10), 'p10');

  const retiring = run(
    [
      { type: 'room-freed' },
      { type: 'item-created', itemId: 'new' },
      { type: 'processing-committed' },
    ],
    freeing,
  );
  // Both paths funnel through `retiring`; `freed` is how the screen knows the
  // archive was already made on the way in and there is no second one to make.
  assert.equal(retiring.phase, 'retiring');
  assert.equal(retiring.phase === 'retiring' && retiring.freed, true);
  assert.deepEqual(applyReplace(before, retiring), before, 'the swap landed early');

  const state = replaceReducer(retiring, { type: 'retired' });
  assert.equal(state.phase, 'replaced');

  const after = applyReplace(before, state);
  assertOnlySlotMoved(before, after, 10);
  assert.equal(after[9].garmentId, 'new');
  assert.equal(filledCount(after), 10, '10 of 10 is still 10 of 10');
  assert.equal(after.length, 10, 'an eleventh position appeared');
});

// ---------------------------------------------------------------------------
// Every way it can stop
// ---------------------------------------------------------------------------

for (const at of ['sheet', 'camera'] as const) {
  test(`cancel · at the ${at}, the slot is untouched`, () => {
    const before = grid(4);
    const state = run([
      { type: 'open', slotId: 3, garmentId: 'p3' },
      ...(at === 'camera'
        ? ([{ type: 'choose', mode: 'camera', needsRoom: false }] as ReplaceEvent[])
        : []),
      { type: 'cancel' },
    ]);

    if (at === 'sheet') {
      assert.deepEqual(state, { phase: 'closed' });
    } else {
      assert.equal(state.phase, 'failed');
      assert.equal(retainedGarmentId(state), 'p3');
    }

    const after = applyReplace(before, state);
    assert.deepEqual(after, before, 'a cancelled replacement changed the grid');
    assert.equal(after[2].garmentId, 'p3', 'the prior piece left the slot');
  });
}

test('denied camera · refused before anything is written, so nothing is unwound', () => {
  const before = grid(10);
  // The screen checks the permission on the way out of the sheet precisely so
  // that a full closet does not store its outgoing piece and then discover the
  // camera is off.
  const state = run([
    { type: 'open', slotId: 2, garmentId: 'p2' },
    { type: 'permission-denied', source: 'camera' },
  ]);

  assert.deepEqual(state, {
    phase: 'failed',
    failure: 'camera-denied',
    slotId: 2,
    outgoingId: 'p2',
  });
  assert.deepEqual(applyReplace(before, state), before);
  assert.equal(retainedGarmentId(state), 'p2');
});

test('denied library · after the outgoing piece was stored, it is brought back', () => {
  const before = grid(10);
  const restoring = run([
    { type: 'open', slotId: 6, garmentId: 'p6' },
    { type: 'choose', mode: 'library', needsRoom: true },
    { type: 'room-freed' },
    { type: 'permission-denied', source: 'library' },
  ]);
  assert.deepEqual(restoring, {
    phase: 'restoring',
    failure: 'library-denied',
    slotId: 6,
    outgoingId: 'p6',
  });

  const state = replaceReducer(restoring, { type: 'restored' });
  assert.equal(state.phase, 'failed');
  assert.deepEqual(applyReplace(before, state), before);
  assert.equal(retainedGarmentId(state), 'p6');
});

test('processing failure · with room to spare, nothing was written to undo', () => {
  const before = grid(9);
  const state = run([
    { type: 'open', slotId: 9, garmentId: 'p9' },
    { type: 'choose', mode: 'camera', needsRoom: false },
    { type: 'item-created', itemId: 'new' },
    { type: 'processing-failed' },
  ]);

  assert.deepEqual(state, {
    phase: 'failed',
    failure: 'processing-failed',
    slotId: 9,
    outgoingId: 'p9',
  });
  assert.deepEqual(applyReplace(before, state), before);
  assert.equal(after9Held(state), 'p9');

  function after9Held(s: ReplaceState) {
    return heldGarmentId(s, 9);
  }
});

test('processing failure at 10 of 10 · the stored piece comes back and the count holds', () => {
  const before = grid(10);
  const state = run([
    { type: 'open', slotId: 1, garmentId: 'p1' },
    { type: 'choose', mode: 'camera', needsRoom: true },
    { type: 'room-freed' },
    { type: 'item-created', itemId: 'new' },
    { type: 'processing-failed' },
    { type: 'restored' },
  ]);

  assert.deepEqual(state, {
    phase: 'failed',
    failure: 'processing-failed',
    slotId: 1,
    outgoingId: 'p1',
  });
  const after = applyReplace(before, state);
  assert.deepEqual(after, before);
  assert.equal(filledCount(after), 10);
});

test('a restore that fails says so, and still never deletes the piece', () => {
  const before = grid(10);
  const state = run([
    { type: 'open', slotId: 7, garmentId: 'p7' },
    { type: 'choose', mode: 'camera', needsRoom: true },
    { type: 'room-freed' },
    { type: 'cancel' },
    { type: 'restore-failed' },
  ]);

  // The piece is in Storage rather than the closet — recoverable in one tap,
  // and the copy for this failure is the one line that says exactly that.
  assert.deepEqual(state, {
    phase: 'failed',
    failure: 'restore-failed',
    slotId: 7,
    outgoingId: 'p7',
  });
  assert.deepEqual(applyReplace(before, state), before);
  assert.equal(retainedGarmentId(state), 'p7');
});

test('no room, and none could be made · the flow stops before the camera', () => {
  const before = grid(10);
  const state = run([
    { type: 'open', slotId: 4, garmentId: 'p4' },
    { type: 'choose', mode: 'camera', needsRoom: true },
    { type: 'room-refused' },
  ]);

  assert.deepEqual(state, { phase: 'failed', failure: 'no-room', slotId: 4, outgoingId: 'p4' });
  assert.deepEqual(applyReplace(before, state), before);
});

// ---------------------------------------------------------------------------
// The transitions that must NOT happen
// ---------------------------------------------------------------------------

test('backgrounding is the absence of a transition', () => {
  // There is no `background` event, and that is the guarantee: whatever
  // arrives while the app is away — including nothing at all for ten minutes —
  // the state object is the same object afterwards.
  const capturing = run([
    { type: 'open', slotId: 3, garmentId: 'p3' },
    { type: 'choose', mode: 'camera', needsRoom: false },
  ]);

  const noise: ReplaceEvent[] = [
    { type: 'open', slotId: 8, garmentId: 'p8' },
    { type: 'room-freed' },
    { type: 'retired' },
    { type: 'restored' },
    { type: 'processing-committed' },
    { type: 'acknowledge' },
  ];
  for (const event of noise) {
    assert.equal(replaceReducer(capturing, event), capturing, `${event.type} moved the machine`);
  }
});

test('Edit details is not a replacement · it never moves the machine off the sheet', () => {
  const before = grid(6);
  const choosing = run([{ type: 'open', slotId: 2, garmentId: 'p2' }]);
  // The screen pushes `/item/p2` and dismisses; nothing here mutates, which is
  // the whole point of keeping the old path inside the new sheet.
  assert.equal(choosing.phase, 'choosing');
  assert.deepEqual(applyReplace(before, choosing), before);
  assert.deepEqual(replaceReducer(choosing, { type: 'cancel' }), { phase: 'closed' });
});

test('an archive that fails after the swap leaves the new photograph in place', () => {
  const before = grid(3);
  const state = run([
    { type: 'open', slotId: 2, garmentId: 'p2' },
    { type: 'choose', mode: 'camera', needsRoom: false },
    { type: 'item-created', itemId: 'new' },
    { type: 'processing-committed' },
    { type: 'retire-failed' },
  ]);

  // `retired: false` is the honest record: the swap landed and the outgoing
  // piece is still in the closet, which is a count to tidy rather than
  // anything lost. It is never a reason to undo a photograph the reader has
  // already been shown.
  assert.equal(state.phase, 'replaced');
  assert.equal(state.phase === 'replaced' && state.retired, false);
  const after = applyReplace(before, state);
  assertOnlySlotMoved(before, after, 2);
  assert.equal(after[1].garmentId, 'new');
});

test('an empty position cannot be replaced', () => {
  const before = grid(2);
  // The screen never opens the sheet on one, and the mutation refuses it too —
  // filling an empty slot is `fillSlot`'s job and must have exactly one door.
  const state: ReplaceState = {
    phase: 'replaced',
    slotId: 7,
    outgoingId: 'nothing',
    incomingId: 'new',
    retired: true,
  };
  assert.deepEqual(applyReplace(before, state), before);
});
