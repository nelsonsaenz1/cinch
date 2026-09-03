/**
 * The swap math behind The Wall's W-04 and The Gap Feed's G-04.
 */

import assert from 'node:assert/strict';
import { swapCostLine, swapDeltaLine } from '../src/features/closet/swap.ts';
import { test } from 'node:test';

import { outcomeOfSwap, rankSwapCandidates, type SwapCandidate } from '../src/features/closet/swap';
import type { Tally } from '../src/features/closet/outfit-count';

const closet = (tops: number, bottoms: number, dresses: number, shoes: number): Tally => ({
  tops,
  bottoms,
  dresses,
  shoes,
});

const THE_TEN = closet(3, 2, 1, 2);

test('outcomeOfSwap recounts honestly rather than quoting a fixed 14 → 17', () => {
  // Store a bottom, add a shoe.
  const outcome = outcomeOfSwap(THE_TEN, 'bottoms', 'shoes');
  assert.equal(outcome.from, 14);
  // 3 tops × 1 bottom × 3 shoes + 1 dress × 3 shoes = 9 + 3 = 12.
  assert.equal(outcome.swapped, 12);
  // Keeping both: 3×2×3 + 1×3 = 18+3 = 21.
  assert.equal(outcome.keptBoth, 21);
  assert.equal(outcome.costOfSwap, 9);
});

test('outcomeOfSwap never reports a negative cost', () => {
  const outcome = outcomeOfSwap(closet(1, 1, 0, 1), 'tops', 'tops');
  assert.ok(outcome.costOfSwap >= 0);
});

test('storing a piece of the same kind being added leaves the count exactly where it was', () => {
  // Piece count of that kind is unchanged (3 tops before, 3 after), so the
  // OUTFIT count doesn't move either — even though "keeping both" (a genuine
  // fourth top, no storing) still would have gained something.
  const outcome = outcomeOfSwap(THE_TEN, 'tops', 'tops');
  assert.equal(outcome.swapped, outcome.from);
  assert.ok(outcome.costOfSwap > 0);
});

test('storing an uncounted piece (a coat, a bag) costs the outfit count nothing', () => {
  const outcome = outcomeOfSwap(THE_TEN, null, 'shoes');
  // Storing the coat changes no counted kind, so this is identical to simply
  // adding the shoe with nothing removed — the best a swap can ever do.
  assert.equal(outcome.swapped, outcome.keptBoth);
  assert.equal(outcome.costOfSwap, 0);
  assert.equal(outcome.swapped, 21);
});

test('rankSwapCandidates sorts least-worn first, ties broken by fewer outfits held together', () => {
  type Fixture = { name: string };
  const candidates: SwapCandidate<Fixture>[] = [
    { id: 'a', kind: 'bottoms', wearCount: 3, outfitCount: 2, piece: { name: 'coat' } },
    { id: 'b', kind: 'bottoms', wearCount: 0, outfitCount: 4, piece: { name: 'skirt' } },
    { id: 'c', kind: 'bottoms', wearCount: 1, outfitCount: 4, piece: { name: 'jumper' } },
    { id: 'd', kind: 'bottoms', wearCount: 0, outfitCount: 1, piece: { name: 'jeans' } },
  ];

  const ranked = rankSwapCandidates(THE_TEN, 'shoes', candidates);
  assert.deepEqual(
    ranked.map((c) => c.id),
    ['d', 'b', 'c', 'a'],
  );
  // Every candidate carries the real recount for storing IT specifically.
  for (const c of ranked) {
    assert.equal(c.outcome.from, 14);
    assert.equal(typeof c.outcome.swapped, 'number');
  }
});

// ---------------------------------------------------------------------------
// The sticky bar's two clauses — audit 2026-09-02 · 48
// ---------------------------------------------------------------------------

const outcome = (from: number, swapped: number, keptBoth: number) => ({
  from,
  swapped,
  keptBoth,
  costOfSwap: Math.max(0, keptBoth - swapped),
});

test('the capacity change is one short clause, not a sentence with two baselines', () => {
  // WAS, assembled inline in `app/wall-swap.tsx` as a nested ternary plus a
  // concatenated tail and rendered as one run of 11pt muted type: "9 fewer than
  // you have now, 9 fewer than keeping both. Storing is reversible at any
  // time." Three clauses and two different baselines, at the moment somebody is
  // choosing which garment to put away.
  assert.equal(swapDeltaLine(outcome(14, 12, 21)), '2 fewer than now');
  assert.equal(swapDeltaLine(outcome(14, 17, 21)), '3 more than now');
  assert.equal(swapDeltaLine(outcome(14, 14, 14)), 'The same as now');
});

test('the trade-off is stated only when there is one', () => {
  assert.equal(swapCostLine(outcome(14, 12, 21)), '9 fewer than keeping both');
  // A coat, a bag or an accessory costs the count nothing — `outcomeOfSwap`
  // says so — and "0 fewer than keeping both" would invent a trade-off the
  // reader is not making.
  assert.equal(swapCostLine(outcome(14, 14, 14)), null);
});

test('neither clause carries the standing fact about storing', () => {
  // "Storing is reversible at any time" is true of storing, not of this swap.
  // It belongs under the action, not inside the sentence about the arithmetic.
  for (const line of [swapDeltaLine(outcome(14, 12, 21)), swapCostLine(outcome(14, 12, 21))]) {
    assert.doesNotMatch(line ?? '', /reversible|storing/i);
  }
});
