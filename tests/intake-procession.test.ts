import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * The procession's rules, tested without a renderer.
 *
 * §6's note says the undo stack must not live in a component, because component
 * state dies on a re-render from the query cache and the undo then silently
 * stops working. Keeping the whole reducer as pure data goes further: these are
 * the rules a user feels — reject then undo, swipe back, edit-implies-confirm —
 * and every one of them is checkable here.
 *
 * The invariant under all of it is §4.6, nothing is ever lost.
 */
import {
  confirmedCount,
  currentDraft,
  initProcession,
  isFinished,
  positionLabel,
  processionReducer,
  UNDO_DEPTH,
  type ProcessionState,
} from '../src/features/intake/procession';
import type { IntakeDraftRow } from '../src/features/intake/queries';
// From `buckets`, not `analytics`: the latter imports `track` and reaches React
// Native, which esbuild cannot parse. See the header of buckets.ts.
import {
  cursorBucket,
  durationBucket,
  garmentBucket,
} from '../src/features/intake/buckets';

function draft(ordinal: number, over: Partial<IntakeDraftRow> = {}): IntakeDraftRow {
  return {
    id: `d${ordinal}`,
    session_id: 's1',
    user_id: 'u1',
    ordinal,
    utterance: `utterance ${ordinal}`,
    name: `garment ${ordinal}`,
    slot: 'base_top',
    colour_term: 'navy',
    colour_oklch: null,
    fabric: null,
    pattern: null,
    formality: null,
    warmth: null,
    quantity: 1,
    confidence: 0.9,
    state: 'pending',
    image_path: null,
    ...over,
  };
}

const three = () => initProcession([draft(0), draft(1), draft(2)], 0);

test('confirm marks the card and moves on', () => {
  const s = processionReducer(three(), { type: 'confirm' });
  assert.equal(s.drafts[0]!.state, 'confirmed');
  assert.equal(s.cursor, 1);
  assert.equal(currentDraft(s)?.id, 'd1');
});

/** The one that carries §4.6. A rejected garment is still a garment that was
 *  heard; deleting the row would make the count a lie and the undo impossible. */
test('reject marks rather than deletes', () => {
  const s = processionReducer(three(), { type: 'reject' });
  assert.equal(s.drafts.length, 3, 'the row survives');
  assert.equal(s.drafts[0]!.state, 'rejected');
  assert.equal(confirmedCount(s), 0);
});

test('an edit confirms as well — the correction IS the confirmation', () => {
  const s = processionReducer(three(), { type: 'edit', patch: { name: 'cardigan' } });
  assert.equal(s.drafts[0]!.name, 'cardigan');
  assert.equal(s.drafts[0]!.state, 'confirmed');
  assert.equal(s.cursor, 1, 'and does not leave the reader on the card they just fixed');
});

test('undo restores the previous card exactly and steps back to it', () => {
  const rejected = processionReducer(three(), { type: 'reject' });
  const restored = processionReducer(rejected, { type: 'undo' });

  assert.equal(restored.cursor, 0);
  assert.equal(restored.drafts[0]!.state, 'pending', 'the rejection is gone, not merely re-flagged');
  assert.equal(restored.undo.length, 0);
});

test('undo restores by id, not by position', () => {
  // Confirm all three, then undo once: only the last card may change back.
  let s: ProcessionState = three();
  s = processionReducer(s, { type: 'confirm' });
  s = processionReducer(s, { type: 'confirm' });
  s = processionReducer(s, { type: 'confirm' });
  s = processionReducer(s, { type: 'undo' });

  assert.equal(s.drafts[0]!.state, 'confirmed');
  assert.equal(s.drafts[1]!.state, 'confirmed');
  assert.equal(s.drafts[2]!.state, 'pending');
});

test('the undo stack is bounded to three', () => {
  let s: ProcessionState = initProcession([0, 1, 2, 3, 4].map((n) => draft(n)), 0);
  for (let i = 0; i < 5; i += 1) s = processionReducer(s, { type: 'confirm' });
  assert.equal(s.undo.length, UNDO_DEPTH);
});

test('undo on an empty stack is a no-op, not a crash', () => {
  const s = three();
  assert.deepEqual(processionReducer(s, { type: 'undo' }), s);
});

/** `back` is navigation; `undo` is a reversal. Conflating them would make a
 *  swipe-right silently un-confirm the card behind it. */
test('back steps without changing any card state', () => {
  const confirmed = processionReducer(three(), { type: 'confirm' });
  const stepped = processionReducer(confirmed, { type: 'back' });

  assert.equal(stepped.cursor, 0);
  assert.equal(stepped.drafts[0]!.state, 'confirmed', 'back does not undo');
});

test('back at the first card is a no-op', () => {
  const s = three();
  assert.deepEqual(processionReducer(s, { type: 'back' }), s);
});

test('the procession finishes past the last card and then stops moving', () => {
  let s: ProcessionState = three();
  for (let i = 0; i < 3; i += 1) s = processionReducer(s, { type: 'confirm' });

  assert.ok(isFinished(s));
  assert.equal(currentDraft(s), null);

  // A double-tap on the last card must not walk the cursor past the drafts or
  // push a phantom undo entry.
  const again = processionReducer(s, { type: 'confirm' });
  assert.equal(again.cursor, 3);
  assert.equal(again.undo.length, s.undo.length);
});

test('the count reads "n of total" and never overruns it', () => {
  let s: ProcessionState = three();
  assert.deepEqual(positionLabel(s), { index: 1, total: 3 });
  for (let i = 0; i < 3; i += 1) s = processionReducer(s, { type: 'confirm' });
  assert.deepEqual(positionLabel(s), { index: 3, total: 3 });
});

test('quantity is clamped to the drafts CHECK', () => {
  const high = processionReducer(three(), { type: 'ambiguous', quantity: 99 });
  assert.equal(high.drafts[0]!.quantity, 12);
  const low = processionReducer(three(), { type: 'ambiguous', quantity: 0 });
  assert.equal(low.drafts[0]!.quantity, 1);
});

test('a resumed cursor past the end is clamped, not trusted', () => {
  const s = initProcession([draft(0), draft(1)], 99);
  assert.equal(s.cursor, 2, 'the finished position, not past it');
  const negative = initProcession([draft(0), draft(1)], -4);
  assert.equal(negative.cursor, 0);
});

// ---------------------------------------------------------------------------
// The analytics buckets. §9: no transcript, no names, no utterances — and no
// raw counts precise enough to reconstruct what somebody owns.
// ---------------------------------------------------------------------------

test('duration buckets band the recording rather than reporting it', () => {
  assert.equal(durationBucket(30_000), 'under_1m');
  assert.equal(durationBucket(2 * 60_000), '1_3m');
  assert.equal(durationBucket(4 * 60_000), '3_6m');
  assert.equal(durationBucket(11 * 60_000), '6_12m');
});

test('garment buckets separate the sizes the thesis is argued in', () => {
  assert.equal(garmentBucket(0), '0');
  assert.equal(garmentBucket(9), '1_9');
  assert.equal(garmentBucket(29), '10_29');
  assert.equal(garmentBucket(30), '30_plus');
});

test('cursor buckets never reveal how many garments someone owns', () => {
  assert.equal(cursorBucket(0, 40), 'none');
  assert.equal(cursorBucket(10, 40), 'early');
  assert.equal(cursorBucket(20, 40), 'half');
  assert.equal(cursorBucket(39, 40), 'most');
  assert.equal(cursorBucket(3, 0), 'none', 'a zero total cannot divide');
});
