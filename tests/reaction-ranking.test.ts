import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  REACTION_DELTA,
  applyReactionMemory,
  reactionSignals,
} from '../src/features/styling/reaction-ranking';
import type { OutfitCandidate } from '../src/lib/styling';
import { garment } from './helpers';

/**
 * Ledger A9 — a thumbs-down changes what comes back tomorrow.
 *
 * Forty-three reactions from eight people had no reader in the ranking path.
 * These pin the ranking-time memory: bounded, core-keyed, decaying, and gone
 * the moment the row is retracted.
 */

const NOW = Date.UTC(2026, 8, 3, 12, 0, 0);
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const top = garment('base_top', 'white');
const bottom = garment('bottom', 'charcoal');
const shoe = garment('footwear', 'brown');
const bag = garment('bag', 'tan');
const top2 = garment('base_top', 'navy');
const wardrobe = [top, bottom, shoe, bag, top2];

const candidate = (items: typeof wardrobe, score: number): OutfitCandidate =>
  ({ items, score, notes: [], reasoning: '' }) as unknown as OutfitCandidate;

const A = candidate([top, bottom, shoe], 0.8);
const B = candidate([top2, bottom, shoe], 0.79);

test('with no reactions the engine order stands', () => {
  assert.deepEqual(applyReactionMemory([A, B], [], wardrobe, NOW), [A, B]);
});

test('a fresh thumbs-down demotes exactly that core, by no more than the delta', () => {
  const out = applyReactionMemory(
    [A, B],
    [{ item_ids: [top.id, bottom.id, shoe.id], reaction: -1, created_at: daysAgo(0) }],
    wardrobe,
    NOW,
  );
  assert.deepEqual(out, [B, A]);
  const signal = reactionSignals(
    [{ item_ids: [top.id, bottom.id, shoe.id], reaction: -1, created_at: daysAgo(0) }],
    wardrobe,
    NOW,
  );
  assert.equal([...signal.values()][0], -1);
  assert.ok(REACTION_DELTA <= 0.1, 'a nudge, never a removal');
});

test('the match is on the CORE — a swapped bag does not defeat it', () => {
  const withBag = candidate([top, bottom, shoe, bag], 0.8);
  const out = applyReactionMemory(
    [withBag, B],
    [{ item_ids: [top.id, bottom.id, shoe.id], reaction: -1, created_at: daysAgo(0) }],
    wardrobe,
    NOW,
  );
  assert.deepEqual(out, [B, withBag]);
});

test('an old refusal fades — forty-five days is the half-life', () => {
  const signal = reactionSignals(
    [{ item_ids: [top.id, bottom.id, shoe.id], reaction: -1, created_at: daysAgo(45) }],
    wardrobe,
    NOW,
  );
  const value = [...signal.values()][0]!;
  assert.ok(Math.abs(value - -0.5) < 1e-9, `expected -0.5, got ${value}`);
});

test('the newest opinion wins over an older opposite one', () => {
  const signal = reactionSignals(
    [
      { item_ids: [top.id, bottom.id, shoe.id], reaction: 1, created_at: daysAgo(0) },
      { item_ids: [top.id, bottom.id, shoe.id], reaction: -1, created_at: daysAgo(1) },
    ],
    wardrobe,
    NOW,
  );
  assert.ok([...signal.values()][0]! > 0);
});

test('a retracted reaction (row gone) leaves nothing behind', () => {
  assert.deepEqual(applyReactionMemory([A, B], [], wardrobe, NOW), [A, B]);
});

test('a reaction about clothes no longer in the closet is ignored, not crashed on', () => {
  const out = applyReactionMemory(
    [A, B],
    [{ item_ids: ['gone-1', 'gone-2'], reaction: -1, created_at: daysAgo(0) }],
    wardrobe,
    NOW,
  );
  assert.deepEqual(out, [A, B]);
});

test('ties keep the engine order — the sort is stable', () => {
  const C = candidate([top, bottom], 0.5);
  const D = candidate([top2, bottom], 0.5);
  assert.deepEqual(
    applyReactionMemory([C, D], [{ item_ids: ['x'], reaction: 1, created_at: daysAgo(0) }], wardrobe, NOW),
    [C, D],
  );
});

test('favourites and reactions rank in one sort — neither erases the other', () => {
  // A favourite one hundredth behind A is promoted by its bonus (+0.03) and
  // stays promoted when an unrelated reaction exists; a thumbs-down on the
  // favourite itself (−0.06) outranks the favourite (+0.03) — an explicit no
  // beats an implicit yes.
  const favourite = candidate([top2, bottom, shoe], 0.79);
  const unrelated = { item_ids: [top.id, bottom.id, bag.id], reaction: 1, created_at: daysAgo(0) };
  const promoted = applyReactionMemory([A, favourite], [unrelated], wardrobe, NOW, [
    [top2.id, bottom.id, shoe.id],
  ]);
  assert.equal(promoted[0], favourite);
  const disliked = { item_ids: [top2.id, bottom.id, shoe.id], reaction: -1, created_at: daysAgo(0) };
  const demoted = applyReactionMemory([A, favourite], [disliked], wardrobe, NOW, [
    [top2.id, bottom.id, shoe.id],
  ]);
  assert.equal(demoted[0], A);
});

test('a reaction about a garment that has left the closet is not re-keyed to a smaller core', () => {
  // (top, bottom, deleted shoe) must not become an opinion about (top, bottom).
  const shoeless = candidate([top, bottom], 0.8);
  const other = candidate([top2, bottom], 0.79);
  const out = applyReactionMemory(
    [shoeless, other],
    [{ item_ids: [top.id, bottom.id, 'deleted-shoe'], reaction: -1, created_at: daysAgo(0) }],
    wardrobe,
    NOW,
  );
  assert.deepEqual(out, [shoeless, other]);
});
