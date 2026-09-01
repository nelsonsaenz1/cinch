import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  editDraft,
  initialDraftState,
  syncDraftState,
  type ItemEditDraft,
} from '../src/components/item/item-edit-draft';
import {
  ITEM_WRITE_LOST,
  assertItemWriteLanded,
  buildItemUpdate,
  commitItemUpdate,
  isEmptyUpdate,
} from '../src/features/closet/item-write';

/**
 * The 2026-08-31 controlled funnel run, Issue 3.
 *
 * A fixture piece was edited in item detail from Tops to Bottoms and renamed
 * "trousers". The name landed; `items.category` still said `top` afterwards and
 * had to be corrected by hand in the database. Nothing in the app reported a
 * failure — which is the half of the defect these tests exist to make
 * impossible: a write that changes no row now raises, and a draft the reader
 * has touched can no longer be overwritten by the row it came from.
 */

const ROW: ItemEditDraft = { name: 'trousers', price: '', category: 'top' };

// ---------------------------------------------------------------------------
// The patch builder — a category change reaches the column
// ---------------------------------------------------------------------------

test('an edited category travels as `category`, beside the renamed subcategory', () => {
  const update = buildItemUpdate({
    verify: false,
    patch: { category: 'bottom', subcategory: 'trousers', purchasePrice: null },
  });

  assert.equal(update.category, 'bottom');
  assert.equal(update.subcategory, 'trousers');
  // Null is the reader's own answer — "I don't know what this cost" — and must
  // survive as a written null rather than being dropped as falsy.
  assert.equal(update.purchase_price, null);
  // An edit is not a confirmation: it must not promote the piece out of a
  // review queue the reader has not been through.
  assert.equal(update.user_verified, undefined);
  assert.equal(update.status, undefined);
});

test('a field the caller said nothing about is not written', () => {
  const update = buildItemUpdate({ verify: false, patch: { category: 'bottom' } });
  assert.deepEqual(Object.keys(update), ['category']);
});

test('the review deck’s confirm still carries the flag and the status', () => {
  const update = buildItemUpdate({ verify: true, patch: { category: 'footwear' } });
  assert.equal(update.user_verified, true);
  assert.equal(update.status, 'verified');
  assert.equal(update.category, 'footwear');
});

test('an empty patch with no confirmation is nothing to send', () => {
  assert.equal(isEmptyUpdate(buildItemUpdate({ verify: false })), true);
  assert.equal(isEmptyUpdate(buildItemUpdate({ verify: false, patch: {} })), true);
  assert.equal(isEmptyUpdate(buildItemUpdate({ verify: true })), false);
});

// ---------------------------------------------------------------------------
// The write's receipt — zero rows is a failure, never a quiet success
// ---------------------------------------------------------------------------

/**
 * `assert.throws`'s matcher argument is typed as a string in this repo (see
 * tests/node-test-runtime.d.ts), so the message is checked by hand.
 */
function refusalOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

test('a write that changed no row raises rather than reporting success', () => {
  assert.equal(refusalOf(() => assertItemWriteLanded([])), ITEM_WRITE_LOST);
  assert.equal(refusalOf(() => assertItemWriteLanded(null)), ITEM_WRITE_LOST);
  assert.equal(refusalOf(() => assertItemWriteLanded(undefined)), ITEM_WRITE_LOST);
});

test('a write that changed the row is a success', () => {
  assert.equal(refusalOf(() => assertItemWriteLanded([{ id: 'a3f1' }])), null);
});

test('the funnel run’s silent no-op: RLS hides the row, PostgREST answers 200 and zero rows', () => {
  // What `.update(...).eq('id', id).select('id')` returns for a row the owner
  // policy does not match — no error, no rows. The old code read only `error`,
  // so this was indistinguishable from a landed write.
  const response: { data: { id: string }[]; error: null } = { data: [], error: null };

  assert.equal(response.error, null);
  assert.equal(refusalOf(() => assertItemWriteLanded(response.data)), ITEM_WRITE_LOST);
});

test('the whole write step refuses a 200-with-no-rows, and accepts a receipt', async () => {
  // Exactly what the mutation runs, with PostgREST's answer supplied by hand.
  const hidden = await commitItemUpdate(async () => ({ data: [], error: null })).then(
    () => null,
    (err: unknown) => (err instanceof Error ? err.message : String(err)),
  );
  assert.equal(hidden, ITEM_WRITE_LOST);

  const landed = await commitItemUpdate(async () => ({ data: [{ id: 'a3f1' }], error: null }));
  assert.deepEqual(landed, [{ id: 'a3f1' }]);

  const failed = await commitItemUpdate(async () => ({ data: null, error: { message: 'nope' } })).then(
    () => null,
    (err: unknown) => (err instanceof Error ? err.message : String(err)),
  );
  assert.equal(failed, 'nope');
});

// ---------------------------------------------------------------------------
// The sheet's draft — a tapped chip is the reader's, and the row may not take
// it back
// ---------------------------------------------------------------------------

test('opening seeds the draft from the row', () => {
  let state = initialDraftState(ROW, false);
  state = syncDraftState(state, { visible: true, initial: ROW });
  assert.deepEqual(state.draft, ROW);
});

test('a tapped category survives every re-render the open sheet sees', () => {
  let state = initialDraftState(ROW, false);
  state = syncDraftState(state, { visible: true, initial: ROW });

  // The tap the reader can see on the chip.
  state = editDraft(state, { category: 'bottom' });
  assert.equal(state.draft.category, 'bottom');

  // Every re-render of the item page hands the sheet a FRESH `initial` object
  // built from the row — the save's pending flag flipping, a background
  // refetch of the closet, a keystroke on the page. None of them may speak for
  // a field the reader has already answered.
  for (let i = 0; i < 5; i += 1) {
    state = syncDraftState(state, { visible: true, initial: { ...ROW } });
  }

  assert.equal(state.draft.category, 'bottom');
});

test('the run’s exact sequence saves Bottoms, not the row’s Tops', () => {
  let state = initialDraftState({ name: '', price: '', category: 'top' }, false);
  state = syncDraftState(state, { visible: true, initial: { name: '', price: '', category: 'top' } });

  state = editDraft(state, { category: 'bottom' });
  // Typing re-renders the sheet between keystrokes; each one is another chance
  // for the row to be re-read.
  for (const name of ['t', 'tr', 'tro', 'trou', 'trous', 'trouse', 'trouser', 'trousers']) {
    state = editDraft(state, { name });
    state = syncDraftState(state, {
      visible: true,
      initial: { name: '', price: '', category: 'top' },
    });
  }

  const saved = state.draft;
  const update = buildItemUpdate({
    verify: false,
    patch: {
      subcategory: saved.name.trim() ? saved.name.trim() : null,
      purchasePrice: null,
      category: saved.category,
    },
  });

  assert.equal(update.category, 'bottom');
  assert.equal(update.subcategory, 'trousers');
});

test('a stale row arriving mid-edit cannot put the old shelf back', () => {
  let state = initialDraftState(ROW, false);
  state = syncDraftState(state, { visible: true, initial: ROW });
  state = editDraft(state, { category: 'bottom' });

  // A refetch that has not caught up — or, worse, one that has, and would
  // re-seed with a DIFFERENT row object carrying the pre-edit category.
  state = syncDraftState(state, {
    visible: true,
    initial: { name: 'trousers', price: '40', category: 'top' },
  });

  assert.equal(state.draft.category, 'bottom');
});

test('closing and opening again re-seeds from the row, discarding the abandoned draft', () => {
  let state = initialDraftState(ROW, false);
  state = syncDraftState(state, { visible: true, initial: ROW });
  state = editDraft(state, { category: 'dress' });

  // Cancel.
  state = syncDraftState(state, { visible: false, initial: ROW });
  // Reopen on the same, unchanged row.
  state = syncDraftState(state, { visible: true, initial: { ...ROW } });

  assert.equal(state.draft.category, 'top');
});

test('the sync is identity-stable, because it runs during render', () => {
  let state = initialDraftState(ROW, false);
  state = syncDraftState(state, { visible: true, initial: ROW });

  const settled = state;
  assert.equal(syncDraftState(settled, { visible: true, initial: { ...ROW } }), settled);

  const edited = editDraft(settled, { category: 'bag' });
  assert.equal(syncDraftState(edited, { visible: true, initial: { ...ROW } }), edited);

  const closed = syncDraftState(edited, { visible: false, initial: ROW });
  assert.equal(syncDraftState(closed, { visible: false, initial: ROW }), closed);
});
