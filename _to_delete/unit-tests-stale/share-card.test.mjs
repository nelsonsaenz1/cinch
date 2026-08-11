// tests/share-card.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/share/card-layout.ts
var MAX_TILES = 5;
var FIVE = {
  slots: [
    { x: 0, y: 0.02609, size: 0.52174 },
    { x: 0.04348, y: 0.5913, size: 0.47826 },
    { x: 0.56522, y: 0, size: 0.43478 },
    { x: 0.52174, y: 0.40435, size: 0.3587 },
    { x: 0.6087, y: 0.79783, size: 0.32609 }
  ],
  height: 1.12391
};
var COMPOSITIONS = {
  1: { slots: [{ x: 0.14, y: 0, size: 0.72 }], height: 0.72 },
  2: {
    slots: [
      { x: 0, y: 0.06, size: 0.56 },
      { x: 0.46, y: 0.5, size: 0.54 }
    ],
    height: 1.04
  },
  3: {
    slots: [
      { x: 0, y: 0.04, size: 0.52 },
      { x: 0.06, y: 0.6, size: 0.46 },
      { x: 0.56, y: 0.2, size: 0.44 }
    ],
    height: 1.06
  },
  4: {
    // The five-piece case with its smallest tile removed, and nothing else
    // moved — the four that remain already stagger, so re-tuning them would
    // only drift away from the transcription for no gain.
    slots: FIVE.slots.slice(0, 4),
    height: 1.06957
  },
  5: FIVE
};
var ROLE_RANK = {
  outerwear: 0,
  dress: 1,
  bottom: 2,
  mid_layer: 3,
  base_top: 4,
  footwear: 5,
  headwear: 6,
  bag: 7,
  accessory: 8
};
var LAYOUT_ORDER = [
  "outerwear",
  "mid_layer",
  "base_top",
  "dress",
  "bottom",
  "footwear",
  "bag",
  "accessory",
  "headwear"
];
function cardStack(pieces) {
  const ranked = [...pieces].sort(
    (a, b) => ROLE_RANK[a.slot] - ROLE_RANK[b.slot] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const kept = ranked.slice(0, MAX_TILES);
  const composition = COMPOSITIONS[kept.length];
  if (!composition) return [];
  return kept.map((garment, i) => ({ garment, slot: composition.slots[i] }));
}
function cardStackHeight(count) {
  return COMPOSITIONS[Math.min(count, MAX_TILES)]?.height ?? 0;
}
function cardDescription(reasoning) {
  const text = reasoning?.trim();
  if (!text) return null;
  return text.split(/(?<=[.!?])\s+/)[0]?.trim() || null;
}
function cardPieceOrder(pieces) {
  return [...pieces].sort((a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot));
}

// tests/share-card.test.ts
var g = (id, slot) => ({ id, slot, subcategory: null, category: "other" });
var COAT = g("a-coat", "outerwear");
var KNIT = g("b-knit", "mid_layer");
var SHIRT = g("c-shirt", "base_top");
var TROUSERS = g("d-trousers", "bottom");
var SHOES = g("e-shoes", "footwear");
var TOTE = g("f-tote", "bag");
var BELT = g("g-belt", "accessory");
var FIVE2 = [SHOES, SHIRT, TROUSERS, COAT, KNIT];
test("five pieces land in the five atlas slots, largest first", () => {
  const placed = cardStack(FIVE2);
  assert.deepEqual(
    placed.map((p) => p.garment.id),
    ["a-coat", "d-trousers", "b-knit", "c-shirt", "e-shoes"]
  );
  assert.deepEqual(placed[0].slot, { x: 0, y: 0.02609, size: 0.52174 });
  assert.deepEqual(placed[4].slot, { x: 0.6087, y: 0.79783, size: 0.32609 });
  const sizes = placed.map((p) => p.slot.size);
  for (let i = 1; i < sizes.length; i++) {
    assert.ok(sizes[i] < sizes[i - 1], `slot ${i} should be smaller than slot ${i - 1}`);
  }
});
test("a sixth and seventh piece are dropped, least significant first", () => {
  const placed = cardStack([...FIVE2, TOTE, BELT]);
  assert.equal(placed.length, 5);
  assert.deepEqual(
    placed.map((p) => p.garment.id),
    ["a-coat", "d-trousers", "b-knit", "c-shirt", "e-shoes"]
  );
  assert.ok(ROLE_RANK.bag > ROLE_RANK.footwear);
  assert.ok(ROLE_RANK.accessory > ROLE_RANK.bag);
});
test("the same outfit composes identically whatever order it arrives in", () => {
  const shuffled = [KNIT, COAT, SHOES, TROUSERS, SHIRT];
  assert.deepEqual(cardStack(shuffled), cardStack(FIVE2));
});
test("two garments in the same slot are ordered by id, not by input order", () => {
  const early = g("a-loafer", "footwear");
  const late = g("z-boot", "footwear");
  assert.deepEqual(
    cardStack([late, early]).map((p) => p.garment.id),
    ["a-loafer", "z-boot"]
  );
});
test("one to four pieces each get their own composition", () => {
  for (const count of [1, 2, 3, 4]) {
    const placed = cardStack(FIVE2.slice(0, count));
    assert.equal(placed.length, count, `${count} pieces should place ${count} tiles`);
    const boxes = new Set(placed.map((p) => JSON.stringify(p.slot)));
    assert.equal(boxes.size, count);
  }
});
test("an empty outfit places nothing rather than throwing", () => {
  assert.deepEqual(cardStack([]), []);
  assert.equal(cardStackHeight(0), 0);
});
test("every composition stays inside its box and declares an honest height", () => {
  for (const count of [1, 2, 3, 4, 5]) {
    const placed = cardStack(FIVE2.concat(TOTE).slice(0, count));
    assert.equal(placed.length, count);
    for (const { slot } of placed) {
      assert.ok(slot.x >= 0 && slot.x <= 1, `${count}: x ${slot.x} out of the box`);
      assert.ok(slot.y >= 0, `${count}: y ${slot.y} above the box`);
      assert.ok(slot.size > 0, `${count}: size ${slot.size} is not a tile`);
      assert.ok(slot.x + slot.size <= 1.001, `${count}: tile runs past the measure`);
    }
    const reach = Math.max(...placed.map((p) => p.slot.y + p.slot.size));
    assert.ok(
      Math.abs(reach - cardStackHeight(count)) < 1e-3,
      `${count}: reaches ${reach} but declares ${cardStackHeight(count)}`
    );
  }
});
test("a sixth piece does not change the height the five-tile block declares", () => {
  assert.equal(cardStackHeight(6), cardStackHeight(5));
});
test("the description is the first sentence, whole", () => {
  assert.equal(
    cardDescription(
      "Cognac and cream anchor the look while the charcoal trousers ground it. The loafers keep it from reading as evening."
    ),
    "Cognac and cream anchor the look while the charcoal trousers ground it."
  );
  assert.equal(cardDescription("One sentence only."), "One sentence only.");
  assert.equal(cardDescription("  Padded on both sides.  "), "Padded on both sides.");
  assert.equal(cardDescription("No full stop at all"), "No full stop at all");
  assert.equal(cardDescription("Really? Yes."), "Really?");
  assert.equal(cardDescription("Wear it!  Twice."), "Wear it!");
});
test("there is no description rather than an empty one", () => {
  assert.equal(cardDescription(""), null);
  assert.equal(cardDescription("   "), null);
  assert.equal(cardDescription(null), null);
  assert.equal(cardDescription(void 0), null);
});
test("the piece list reads down the body, and leaves its input alone", () => {
  const input = [SHOES, TOTE, COAT, TROUSERS, SHIRT, KNIT];
  const before = input.slice();
  assert.deepEqual(
    cardPieceOrder(input).map((p) => p.slot),
    ["outerwear", "mid_layer", "base_top", "bottom", "footwear", "bag"]
  );
  assert.deepEqual(input, before, "cardPieceOrder must return a copy");
});
