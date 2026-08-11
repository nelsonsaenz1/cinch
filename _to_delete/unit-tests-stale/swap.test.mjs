// tests/swap.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/closet/outfit-count.ts
function countOutfits(t) {
  return t.tops * t.bottoms * t.shoes + t.dresses * t.shoes;
}

// src/features/closet/swap.ts
function outcomeOfSwap(tally, remove, add) {
  const removed = remove ? { ...tally, [remove]: Math.max(0, tally[remove] - 1) } : tally;
  const swapped = countOutfits({ ...removed, [add]: removed[add] + 1 });
  const keptBoth = countOutfits({ ...tally, [add]: tally[add] + 1 });
  return {
    from: countOutfits(tally),
    swapped,
    keptBoth,
    costOfSwap: Math.max(0, keptBoth - swapped)
  };
}
function rankSwapCandidates(tally, add, candidates) {
  return [...candidates].sort((a, b) => a.wearCount - b.wearCount || a.outfitCount - b.outfitCount).map((c) => ({ ...c, outcome: outcomeOfSwap(tally, c.kind, add) }));
}

// tests/swap.test.ts
var closet = (tops, bottoms, dresses, shoes) => ({
  tops,
  bottoms,
  dresses,
  shoes
});
var THE_TEN = closet(3, 2, 1, 2);
test("outcomeOfSwap recounts honestly rather than quoting a fixed 14 \u2192 17", () => {
  const outcome = outcomeOfSwap(THE_TEN, "bottoms", "shoes");
  assert.equal(outcome.from, 14);
  assert.equal(outcome.swapped, 12);
  assert.equal(outcome.keptBoth, 21);
  assert.equal(outcome.costOfSwap, 9);
});
test("outcomeOfSwap never reports a negative cost", () => {
  const outcome = outcomeOfSwap(closet(1, 1, 0, 1), "tops", "tops");
  assert.ok(outcome.costOfSwap >= 0);
});
test("storing a piece of the same kind being added leaves the count exactly where it was", () => {
  const outcome = outcomeOfSwap(THE_TEN, "tops", "tops");
  assert.equal(outcome.swapped, outcome.from);
  assert.ok(outcome.costOfSwap > 0);
});
test("storing an uncounted piece (a coat, a bag) costs the outfit count nothing", () => {
  const outcome = outcomeOfSwap(THE_TEN, null, "shoes");
  assert.equal(outcome.swapped, outcome.keptBoth);
  assert.equal(outcome.costOfSwap, 0);
  assert.equal(outcome.swapped, 21);
});
test("rankSwapCandidates sorts least-worn first, ties broken by fewer outfits held together", () => {
  const candidates = [
    { id: "a", kind: "bottoms", wearCount: 3, outfitCount: 2, piece: { name: "coat" } },
    { id: "b", kind: "bottoms", wearCount: 0, outfitCount: 4, piece: { name: "skirt" } },
    { id: "c", kind: "bottoms", wearCount: 1, outfitCount: 4, piece: { name: "jumper" } },
    { id: "d", kind: "bottoms", wearCount: 0, outfitCount: 1, piece: { name: "jeans" } }
  ];
  const ranked = rankSwapCandidates(THE_TEN, "shoes", candidates);
  assert.deepEqual(
    ranked.map((c) => c.id),
    ["d", "b", "c", "a"]
  );
  for (const c of ranked) {
    assert.equal(c.outcome.from, 14);
    assert.equal(typeof c.outcome.swapped, "number");
  }
});
