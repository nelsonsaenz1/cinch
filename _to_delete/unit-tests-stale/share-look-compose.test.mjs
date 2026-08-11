// tests/share-look-compose.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/event-outfits/look-layout.ts
var MAX_CELLS = 6;

// src/features/share-look/compose.ts
var MIN_PIECES_TO_COMPOSE = 2;
var MAX_PIECES = MAX_CELLS;
function canCompose(stack) {
  return stack.length >= MIN_PIECES_TO_COMPOSE;
}
function togglePiece(stack, piece) {
  const already = stack.some((g) => g.id === piece.id);
  if (already) return stack.filter((g) => g.id !== piece.id);
  if (stack.length >= MAX_PIECES) return [...stack];
  return [...stack, piece];
}
function removePiece(stack, id) {
  return stack.filter((g) => g.id !== id);
}
function moveStackPiece(stack, from, to) {
  if (from === to || from < 0 || to < 0 || from >= stack.length || to >= stack.length) {
    return [...stack];
  }
  const next = [...stack];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
function matchesCategoryFilter(garment2, filter) {
  switch (filter) {
    case "All":
      return true;
    case "Tops":
      return garment2.category === "top";
    case "Bottoms":
      return garment2.category === "bottom";
    case "Shoes":
      return garment2.category === "footwear";
  }
}
function stackStatusLine(stack) {
  if (stack.length === 0) return "Nothing picked. Two pieces make a look.";
  if (stack.length === 1) return "One piece is a piece. Add another to post.";
  if (stack.length >= MAX_PIECES) return `${MAX_PIECES} is the ceiling. Remove one to swap.`;
  const lead = stack[0];
  const noun = (lead.subcategory ?? lead.category).toLowerCase();
  return `${stack.length} pieces \xB7 ${noun} leads the card.`;
}
function capitalise(word) {
  return word.length ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}
function dominantColourName(g) {
  const name = g.colors[0]?.name;
  return name ? capitalise(name) : null;
}
function nounOf(g) {
  return capitalise(g.subcategory ?? g.category);
}
function titleFromPieces(pieces) {
  if (pieces.length === 0) return "A look";
  const byWeight = [...pieces].sort((a, b) => b.visualWeight - a.visualWeight);
  if (pieces.length === 1) {
    const g = byWeight[0];
    const colour = dominantColourName(g);
    return colour ? `${colour} ${nounOf(g)}` : nounOf(g);
  }
  const colours = [];
  for (const g of byWeight) {
    const c = dominantColourName(g);
    if (c && !colours.includes(c)) colours.push(c);
    if (colours.length === 2) break;
  }
  if (colours.length === 2) return colours.join(" & ");
  if (colours.length === 1) return `${colours[0]} & ${nounOf(byWeight[0])}`;
  const nouns = [];
  for (const g of byWeight) {
    const n = nounOf(g);
    if (!nouns.includes(n)) nouns.push(n);
    if (nouns.length === 2) break;
  }
  return nouns.length ? nouns.join(" & ") : "A look";
}
function captionFromPieces(pieces) {
  if (pieces.length === 0) return "";
  const names = pieces.map((g) => (g.subcategory ?? g.category).toLowerCase());
  if (names.length === 1) return names[0];
  const [first, ...rest] = names;
  return `The ${first} with the ${rest.join(", ")}.`;
}
function audienceLine(peopleCount) {
  return peopleCount === 1 ? "1 person can see this" : `${peopleCount} people can see this`;
}
var NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six"];
function wordForCount(n) {
  return NUMBER_WORDS[n] ?? String(n);
}
function postedToLatelyLine(pieceCount) {
  const word = pieceCount === 1 ? "wear" : "wears";
  return `Posted, and ${wordForCount(pieceCount)} ${word} counted in Lately.`;
}

// src/lib/color/oklch.ts
function parseHex(input) {
  const hex = input.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  let full;
  if (hex.length === 3) full = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  else if (hex.length === 6) full = hex;
  else return null;
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255
  };
}
var srgbToLinear = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
function rgbToOklab({ r, g, b }) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  };
}
function oklabToOklch({ L, a, b }) {
  const C = Math.sqrt(a * a + b * b);
  const h = C < 1e-6 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  return { L, C, h };
}
var hexToOklch = (hex) => {
  const rgb = parseHex(hex);
  return rgb ? oklabToOklch(rgbToOklab(rgb)) : null;
};

// src/lib/color/families.ts
var FAMILY_BANDS = [
  { family: "red", from: 15, to: 40 },
  { family: "orange", from: 40, to: 80 },
  { family: "yellow", from: 80, to: 130 },
  { family: "green", from: 130, to: 175 },
  { family: "teal", from: 175, to: 230 },
  { family: "blue", from: 230, to: 290 },
  { family: "purple", from: 290, to: 335 },
  { family: "pink", from: 335, to: 375 }
  // wraps past 360
];
function neutrality({ L, C, h }) {
  if (C < 0.03) return 1;
  let n = Math.max(0, 1 - C / 0.16);
  if (L < 0.45) {
    const denom = 0.16 + (0.45 - L) * 0.2;
    n = Math.max(n, Math.max(0, 1 - C / denom));
  }
  const warmEarth = h >= 45 && h <= 145;
  if (warmEarth && C < 0.11) n = Math.max(n, 0.65 + (1 - C / 0.11) * 0.25);
  return Math.min(1, n);
}
function hueFamily(c) {
  if (neutrality(c) > 0.7) return "neutral";
  const h = c.h;
  for (const band of FAMILY_BANDS) {
    const hi = band.to > 360 ? band.to - 360 : band.to;
    const wraps = band.to > 360;
    if (wraps ? h >= band.from || h < hi : h >= band.from && h < band.to) return band.family;
  }
  return "red";
}
var METALLIC = /\b(gold|silver|bronze|copper|gunmetal|pewter|rose gold|brass|chrome)\b/i;
var isMetallicName = (name) => METALLIC.test(name);
var NAMED = {
  // Achromatic
  black: "#111111",
  charcoal: "#36393d",
  "dark grey": "#4a4d52",
  "dark gray": "#4a4d52",
  grey: "#8b8f94",
  gray: "#8b8f94",
  "light grey": "#c3c6ca",
  "light gray": "#c3c6ca",
  silver: "#c9ccd1",
  white: "#f7f7f5",
  "off white": "#f0ede6",
  "off-white": "#f0ede6",
  ivory: "#efe9dc",
  cream: "#efe6d2",
  ecru: "#e3dac6",
  bone: "#e6e0d4",
  // Blues
  navy: "#1f2a44",
  "navy blue": "#1f2a44",
  midnight: "#151d33",
  indigo: "#2b3a67",
  denim: "#3f5d80",
  "light wash": "#8aa6c0",
  "medium wash": "#5c7fa3",
  "dark wash": "#2f4459",
  blue: "#2f5fa8",
  "royal blue": "#2a4fc4",
  cobalt: "#2549b8",
  "sky blue": "#8ec3e8",
  "baby blue": "#adcfe8",
  "powder blue": "#bdd4e3",
  "light blue": "#9fc4e0",
  cornflower: "#6b8fd4",
  slate: "#5a6b7d",
  "slate blue": "#57688a",
  steel: "#6c7c8c",
  // Teals / cyans
  teal: "#1f6f6b",
  turquoise: "#3aa9a2",
  aqua: "#77c9c4",
  cyan: "#4dbcc9",
  petrol: "#1d5560",
  // Greens
  green: "#3f7a4a",
  olive: "#6a6b3d",
  "olive green": "#6a6b3d",
  khaki: "#9a9060",
  "forest green": "#2c4f38",
  forest: "#2c4f38",
  hunter: "#2b4a3a",
  emerald: "#1f8a5c",
  sage: "#9aa88e",
  mint: "#a8d6bb",
  "lime green": "#8fbe45",
  lime: "#8fbe45",
  moss: "#5c6b45",
  "army green": "#585f43",
  // Yellows / golds
  yellow: "#e3c23c",
  mustard: "#c9a227",
  gold: "#c9a227",
  butter: "#f0dfa0",
  lemon: "#eddc63",
  ochre: "#bb8f34",
  // Oranges / browns
  orange: "#d97230",
  rust: "#a8502c",
  terracotta: "#b96a4c",
  burnt: "#a55a2e",
  "burnt orange": "#b35c22",
  peach: "#f0b79a",
  apricot: "#e8a677",
  coral: "#e5735c",
  brown: "#6b4a34",
  chocolate: "#4a3225",
  espresso: "#3b2a20",
  tan: "#b99567",
  camel: "#b58f5f",
  beige: "#d6c4a8",
  sand: "#d9c9a8",
  stone: "#c9bfae",
  taupe: "#9a8b7c",
  caramel: "#a9743f",
  cognac: "#8e5525",
  bronze: "#8c6239",
  copper: "#a3603a",
  // Reds
  red: "#b8332f",
  crimson: "#a5203a",
  burgundy: "#5e2233",
  maroon: "#5c2029",
  wine: "#5a2334",
  brick: "#9c4437",
  cherry: "#a8253c",
  scarlet: "#c02b28",
  // Pinks
  pink: "#e493ac",
  "hot pink": "#e0479a",
  blush: "#e8c0bd",
  rose: "#c97b8b",
  fuchsia: "#cf3a8e",
  magenta: "#c22b7d",
  mauve: "#a37f92",
  salmon: "#e9927c",
  // Purples
  purple: "#6b4a8a",
  lavender: "#b7a6d4",
  lilac: "#c1b0d9",
  violet: "#7a52a8",
  plum: "#5f3350",
  aubergine: "#42263c",
  eggplant: "#42263c"
};
var NAMED_KEYS = Object.keys(NAMED).sort((a, b) => b.length - a.length);
function resolveColorName(name) {
  const lower = name.toLowerCase().trim();
  if (!lower) return null;
  const direct = NAMED[lower];
  if (direct) return hexToOklch(direct);
  for (const key of NAMED_KEYS) {
    if (lower.includes(key)) {
      const base = hexToOklch(NAMED[key]);
      if (!base) continue;
      if (/\b(light|pale|pastel|washed|faded)\b/.test(lower)) {
        return { ...base, L: Math.min(0.95, base.L + 0.16), C: base.C * 0.7 };
      }
      if (/\b(dark|deep)\b/.test(lower)) {
        return { ...base, L: Math.max(0.12, base.L - 0.14), C: base.C * 0.9 };
      }
      if (/\b(bright|vivid|neon|electric)\b/.test(lower)) {
        return { ...base, C: Math.min(0.34, base.C * 1.5) };
      }
      if (/\b(muted|dusty|heather|marled|washed out)\b/.test(lower)) {
        return { ...base, C: base.C * 0.55 };
      }
      return base;
    }
  }
  return null;
}
function toGarmentColors(raw) {
  if (!raw?.length) return [];
  const out = [];
  for (const entry of raw) {
    const name = entry.name?.trim() ?? "";
    const oklch = (entry.hex ? hexToOklch(entry.hex) : null) ?? resolveColorName(name);
    if (!oklch) continue;
    out.push({
      oklch,
      name,
      family: hueFamily(oklch),
      neutrality: neutrality(oklch),
      metallic: isMetallicName(name),
      weight: 0
      // assigned below
    });
  }
  const decay = out.map((_, i) => 1 / (i + 1) ** 1.6);
  const total = decay.reduce((a, b) => a + b, 0);
  out.forEach((c, i) => {
    c.weight = decay[i] / total;
  });
  return out;
}

// tests/helpers.ts
var VISUAL_WEIGHT = {
  dress: 0.42,
  outerwear: 0.34,
  bottom: 0.26,
  base_top: 0.22,
  mid_layer: 0.24,
  footwear: 0.12,
  bag: 0.06,
  headwear: 0.05,
  accessory: 0.04
};
var seq = 0;
function resetIds() {
  seq = 0;
}
function garment(slot, color, overrides = {}) {
  return {
    id: `g${++seq}`,
    slot,
    category: "other",
    subcategory: null,
    colors: toGarmentColors([{ name: color }]),
    visualWeight: VISUAL_WEIGHT[slot],
    fit: "regular",
    pattern: null,
    patternScale: "none",
    material: null,
    brand: null,
    formality: 3,
    warmth: 3,
    waterResistant: false,
    seasons: [],
    occasions: [],
    wearCount: 4,
    lastWornAt: null,
    purchasePrice: null,
    thumbPath: null,
    cutoutPath: null,
    platePath: null,
    ...overrides
  };
}

// tests/share-look-compose.test.ts
test('never produces "Untitled" at any piece count above zero', () => {
  resetIds();
  const cases = [
    [garment("base_top", "cream")],
    [garment("base_top", "cream"), garment("bottom", "cognac")],
    [garment("base_top", "cream"), garment("bottom", "cognac"), garment("footwear", "brown")],
    // No colour data on any piece at all.
    [garment("base_top", ""), garment("bottom", "")]
  ];
  for (const pieces of cases) {
    const title = titleFromPieces(pieces);
    assert.notEqual(title, "Untitled", JSON.stringify(pieces.map((g) => g.colors)));
    assert.ok(title.length > 0);
  }
});
test("one piece names itself by colour and noun", () => {
  resetIds();
  const sweater = garment("base_top", "cream", { subcategory: "sweater" });
  assert.equal(titleFromPieces([sweater]), "Cream Sweater");
});
test("two or more pieces read as two dominant colours, heaviest first", () => {
  resetIds();
  const coat = garment("outerwear", "cognac");
  const shirt = garment("base_top", "cream");
  assert.equal(titleFromPieces([shirt, coat]), "Cognac & Cream");
});
test("a repeated colour across pieces counts once", () => {
  resetIds();
  const a = garment("outerwear", "black");
  const b = garment("base_top", "black");
  const c = garment("footwear", "tan");
  const title = titleFromPieces([c, b, a]);
  assert.equal(title, "Black & Tan");
});
test("stack order is untouched by naming \u2014 piece one still leads the plate", () => {
  resetIds();
  const stack = [garment("footwear", "brown"), garment("outerwear", "cognac")];
  const before = stack.map((g) => g.id);
  titleFromPieces(stack);
  assert.deepEqual(
    stack.map((g) => g.id),
    before
  );
});
test("caption reads the stack in order, never re-sorted", () => {
  resetIds();
  const stack = [
    garment("base_top", "cream", { subcategory: "mohair sweater" }),
    garment("bottom", "oat", { subcategory: "corduroy skirt" }),
    garment("footwear", "cognac", { subcategory: "loafers" })
  ];
  assert.equal(
    captionFromPieces(stack),
    "The mohair sweater with the corduroy skirt, loafers."
  );
});
test("Compose stays inert below two pieces", () => {
  resetIds();
  assert.equal(canCompose([]), false);
  assert.equal(canCompose([garment("base_top", "cream")]), false);
  assert.equal(
    canCompose([garment("base_top", "cream"), garment("bottom", "oat")]),
    true
  );
  assert.equal(MIN_PIECES_TO_COMPOSE, 2);
});
test("toggling a piece twice is a no-op on the stack", () => {
  resetIds();
  const a = garment("base_top", "cream");
  let stack = togglePiece([], a);
  assert.deepEqual(stack.map((g) => g.id), [a.id]);
  stack = togglePiece(stack, a);
  assert.deepEqual(stack, []);
});
test("the picker refuses past the ceiling rather than growing the stack", () => {
  resetIds();
  let stack = [];
  for (let i = 0; i < MAX_PIECES; i++) {
    stack = togglePiece(stack, garment("accessory", "grey"));
  }
  assert.equal(stack.length, MAX_PIECES);
  const overflow = togglePiece(stack, garment("accessory", "grey"));
  assert.equal(overflow.length, MAX_PIECES);
});
test("the stack renumbers on removal \u2014 remaining pieces close the gap in order", () => {
  resetIds();
  const [a, b, c, d] = [
    garment("base_top", "cream"),
    garment("bottom", "oat"),
    garment("footwear", "cognac"),
    garment("bag", "tan")
  ];
  const stack = [a, b, c, d];
  const after = removePiece(stack, b.id);
  assert.deepEqual(after.map((g) => g.id), [a.id, c.id, d.id]);
  assert.deepEqual(
    after.map((g, i) => i + 1),
    [1, 2, 3]
  );
});
test("removing the leading piece promotes the next one to the face", () => {
  resetIds();
  const [a, b, c] = [
    garment("base_top", "cream"),
    garment("bottom", "oat"),
    garment("footwear", "cognac")
  ];
  const after = removePiece([a, b, c], a.id);
  assert.equal(after[0].id, b.id, "piece one is the look's face");
});
test("removing a piece not in the stack is a no-op", () => {
  resetIds();
  const stack = [garment("base_top", "cream"), garment("bottom", "oat")];
  const after = removePiece(stack, "not-in-the-stack");
  assert.deepEqual(after.map((g) => g.id), stack.map((g) => g.id));
});
test("drag-to-reorder moves exactly one piece, closing the gap it left", () => {
  resetIds();
  const [a, b, c, d] = [
    garment("base_top", "cream"),
    garment("bottom", "oat"),
    garment("footwear", "cognac"),
    garment("bag", "tan")
  ];
  const stack = [a, b, c, d];
  const moved = moveStackPiece(stack, 0, 2);
  assert.deepEqual(moved.map((g) => g.id), [b.id, c.id, a.id, d.id]);
});
test("an out-of-range drag is a no-op copy, never a throw", () => {
  resetIds();
  const stack = [garment("base_top", "cream"), garment("bottom", "oat")];
  const moved = moveStackPiece(stack, 0, 9);
  assert.deepEqual(moved.map((g) => g.id), stack.map((g) => g.id));
  assert.notEqual(moved, stack, "still a fresh array, not the same reference");
});
test("category chips filter by the garment category the atlas names", () => {
  resetIds();
  const top = garment("base_top", "cream", { category: "top" });
  const bottom = garment("bottom", "oat", { category: "bottom" });
  const shoe = garment("footwear", "cognac", { category: "footwear" });
  assert.ok(matchesCategoryFilter(top, "All"));
  assert.ok(matchesCategoryFilter(top, "Tops"));
  assert.ok(!matchesCategoryFilter(top, "Bottoms"));
  assert.ok(matchesCategoryFilter(bottom, "Bottoms"));
  assert.ok(matchesCategoryFilter(shoe, "Shoes"));
  assert.ok(!matchesCategoryFilter(shoe, "Tops"));
});
test("the status line never claims a count it is not printing", () => {
  resetIds();
  assert.match(stackStatusLine([]), /nothing picked/i);
  assert.match(stackStatusLine([garment("base_top", "cream")]), /one piece/i);
  const full = Array.from({ length: MAX_PIECES }, () => garment("accessory", "grey"));
  assert.match(stackStatusLine(full), /ceiling/i);
});
test("audience is stated in people, singular and plural", () => {
  assert.equal(audienceLine(1), "1 person can see this");
  assert.equal(audienceLine(5), "5 people can see this");
  assert.equal(audienceLine(0), "0 people can see this");
});
test("the Lately line names how many wears, matching the piece count", () => {
  assert.equal(postedToLatelyLine(1), "Posted, and one wear counted in Lately.");
  assert.equal(postedToLatelyLine(4), "Posted, and four wears counted in Lately.");
});
