/**
 * The twelve states of the saved-looks flow, and the four that look identical
 * from the data.
 *
 * Three machines, because §10 names three and they do not compose. What is
 * actually being defended here is a set of confusions, each of which has shipped
 * somewhere before:
 *
 *   · **`empty` versus `offline`.** Both arrive as a page with no cards. One
 *     says "Nothing saved yet", and drawn over a failed read it tells somebody
 *     with fourteen kept looks that they have none.
 *   · **`offline` versus `error`.** Both are failures to read. One of them has
 *     the reader's own rows in hand and must show them.
 *   · **`saved` versus `already_saved`.** One celebrates; the other must not,
 *     or a second tap teaches the reader they now have two.
 *   · **`missing` versus `error` on the detail.** One means the row is gone;
 *     the other means we could not tell. Only the first may leave the screen.
 *
 * The resolvers are pure — no React, no react-native, no supabase — so these
 * exercise the real functions rather than describing them.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SAVED_LIST_STATES,
  SAVE_ACTION_STATES,
  canPlan,
  collectionCounts,
  filterSaves,
  isSavedListEmpty,
  offersUndo,
  resolveSavedDetailState,
  resolveSavedListState,
  saveToastTone,
  savedListStateAfterRecovery,
  showsFilterBar,
  type SavedListStateKind,
} from '../src/features/saved-looks/states.ts';
import type { SavedCollection, SavedLook } from '../src/features/saved-looks/types.ts';

function look(over: Partial<SavedLook> = {}): SavedLook {
  return {
    id: 'save-1',
    sourceType: 'daily_look',
    sourceOwnerId: 'owner-1',
    collectionId: null,
    title: 'Rust cord + cream knit',
    imageUrl: 'https://example.test/a.jpg',
    sourceLabel: "Maya's Daily look",
    sourceVisibility: 'Visible to your Circle',
    sourceAt: '2026-08-03T09:00:00.000Z',
    note: null,
    savedAt: '2026-08-03T09:12:00.000Z',
    availability: 'available',
    ...over,
  };
}

const shelf = (id: string, savedCount = 0): SavedCollection => ({ id, name: id, savedCount });

// ---------------------------------------------------------------------------
// 1 · The list
// ---------------------------------------------------------------------------

test('the map names exactly five list states', () => {
  assert.deepEqual([...SAVED_LIST_STATES], ['loading', 'error', 'offline', 'empty', 'populated']);
});

test('each of the five is reachable from some input', () => {
  const reached = new Set<SavedListStateKind>([
    resolveSavedListState({ loading: true, failed: false, saves: [] }).kind,
    resolveSavedListState({ failed: true, saves: [] }).kind,
    resolveSavedListState({ failed: false, offline: true, saves: [look()] }).kind,
    resolveSavedListState({ failed: false, saves: [] }).kind,
    resolveSavedListState({ failed: false, saves: [look()] }).kind,
  ]);
  assert.deepEqual([...reached].sort(), [...SAVED_LIST_STATES].sort());
});

test('loading outranks everything — a pending read never claims there is nothing saved', () => {
  const state = resolveSavedListState({ loading: true, failed: true, offline: true, saves: [] });
  assert.equal(state.kind, 'loading');
});

test('offline WITH content is offline, not error — those rows are real and usable', () => {
  const state = resolveSavedListState({ failed: true, offline: true, saves: [look()] });
  assert.equal(state.kind, 'offline');
  assert.equal(state.kind === 'offline' && state.savedCount, 1);
});

test('offline with NOTHING is error — an empty cache proves nothing about what is there', () => {
  assert.equal(resolveSavedListState({ failed: false, offline: true, saves: [] }).kind, 'error');
});

test('a failed read is never dressed as an empty one', () => {
  assert.equal(resolveSavedListState({ failed: true, saves: [] }).kind, 'error');
  assert.equal(isSavedListEmpty(resolveSavedListState({ failed: true, saves: [] })), false);
});

test('emptiness is claimed only after a read that succeeded', () => {
  const state = resolveSavedListState({ failed: false, saves: [] });
  assert.equal(state.kind, 'empty');
  assert.equal(isSavedListEmpty(state), true);
});

test('the unavailable count is carried by the state, not re-derived by the screen', () => {
  const state = resolveSavedListState({
    failed: false,
    saves: [look(), look({ id: 'b', availability: 'unavailable' })],
  });
  assert.equal(state.kind, 'populated');
  assert.equal(state.kind === 'populated' && state.unavailableCount, 1);
});

test('recovery from offline returns the identical state for identical content', () => {
  const input = { failed: true, offline: true, saves: [look()] };
  assert.deepEqual(savedListStateAfterRecovery(input), resolveSavedListState({ ...input, failed: false, offline: false }));
});

test('the filter bar is drawn over cards, and never over a skeleton or an empty shelf', () => {
  const populated = resolveSavedListState({ failed: false, saves: [look()] });
  const empty = resolveSavedListState({ failed: false, saves: [] });
  const loading = resolveSavedListState({ loading: true, failed: false, saves: [] });

  assert.equal(showsFilterBar(populated, [shelf('a')]), true);
  // No collections is no row: a filter with one chip in it filters nothing.
  assert.equal(showsFilterBar(populated, []), false);
  assert.equal(showsFilterBar(empty, [shelf('a')]), false);
  assert.equal(showsFilterBar(loading, [shelf('a')]), false);
});

// ---------------------------------------------------------------------------
// 2 · The filter is a facet
// ---------------------------------------------------------------------------

test('All returns everything, and never a different array order', () => {
  const saves = [look({ id: 'a' }), look({ id: 'b', collectionId: 'c1' }), look({ id: 'c' })];
  assert.deepEqual(
    filterSaves(saves, null).map((s) => s.id),
    ['a', 'b', 'c'],
  );
});

test('a collection filter narrows and preserves order', () => {
  const saves = [
    look({ id: 'a', collectionId: 'c1' }),
    look({ id: 'b' }),
    look({ id: 'c', collectionId: 'c1' }),
  ];
  assert.deepEqual(
    filterSaves(saves, 'c1').map((s) => s.id),
    ['a', 'c'],
  );
});

test('unavailable saves stay in their collection — the chip opens what it counted', () => {
  const saves = [
    look({ id: 'a', collectionId: 'c1' }),
    look({ id: 'b', collectionId: 'c1', availability: 'unavailable' }),
  ];
  assert.equal(collectionCounts(saves).get('c1'), 2);
  assert.equal(filterSaves(saves, 'c1').length, 2);
});

test('saves on no shelf are counted against no shelf', () => {
  const counts = collectionCounts([look({ id: 'a' }), look({ id: 'b', collectionId: 'c1' })]);
  assert.deepEqual([...counts.entries()], [['c1', 1]]);
});

// ---------------------------------------------------------------------------
// 3 · The save action
// ---------------------------------------------------------------------------

test('the map names exactly five save-action states', () => {
  assert.deepEqual([...SAVE_ACTION_STATES], [
    'idle',
    'validating',
    'saved',
    'already_saved',
    'blocked',
  ]);
});

test('a duplicate is an INFO toast, never a success one', () => {
  assert.equal(saveToastTone({ kind: 'saved', savedId: 'x' }), 'success');
  assert.equal(saveToastTone({ kind: 'already_saved', savedId: 'x' }), 'info');
});

test('nothing else raises a toast — a refusal is inline, and validating is silent', () => {
  assert.equal(saveToastTone({ kind: 'idle' }), null);
  assert.equal(saveToastTone({ kind: 'validating' }), null);
  assert.equal(saveToastTone({ kind: 'blocked' }), null);
});

test('Undo is offered for a save just made, and never for a duplicate', () => {
  assert.equal(offersUndo({ kind: 'saved', savedId: 'x' }), true);
  // The row predates the tap. Undoing it would delete something kept days ago.
  assert.equal(offersUndo({ kind: 'already_saved', savedId: 'x' }), false);
  assert.equal(offersUndo({ kind: 'idle' }), false);
});

// ---------------------------------------------------------------------------
// 4 · The detail
// ---------------------------------------------------------------------------

test('a null row is `missing`, not an error — the screen leaves rather than apologises', () => {
  assert.equal(resolveSavedDetailState({ failed: false, save: null }).kind, 'missing');
});

test('a failed read is `error`, and never claims the row is gone', () => {
  assert.equal(resolveSavedDetailState({ failed: true, save: null }).kind, 'error');
});

test('availability decides which of OS-04 and OS-06 is drawn, on one route', () => {
  assert.equal(resolveSavedDetailState({ failed: false, save: look() }).kind, 'available');
  assert.equal(
    resolveSavedDetailState({ failed: false, save: look({ availability: 'unavailable' }) }).kind,
    'unavailable',
  );
});

test('planning is refused for an unavailable save — the source is what a plan reads', () => {
  assert.equal(canPlan('available'), true);
  assert.equal(canPlan('unavailable'), false);
});
