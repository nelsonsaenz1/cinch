// tests/outfit-count.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/closet/outfit-count.ts
var COUNTED_KINDS = ["shoes", "bottoms", "tops", "dresses"];
var EMPTY_TALLY = { tops: 0, bottoms: 0, dresses: 0, shoes: 0 };
function kindOfSlot(slot) {
  switch (slot) {
    case "base_top":
    case "mid_layer":
      return "tops";
    case "bottom":
      return "bottoms";
    case "dress":
      return "dresses";
    case "footwear":
      return "shoes";
    case "outerwear":
    case "bag":
    case "headwear":
    case "accessory":
      return null;
  }
}
function tallyOf(wardrobe) {
  const out = { ...EMPTY_TALLY };
  for (const g of wardrobe) {
    const kind = kindOfSlot(g.slot);
    if (kind) out[kind] += 1;
  }
  return out;
}
function countOutfits(t) {
  return t.tops * t.bottoms * t.shoes + t.dresses * t.shoes;
}
function withOne(t, kind) {
  return { ...t, [kind]: t[kind] + 1 };
}
function gainFrom(t, kind) {
  const total = countOutfits(withOne(t, kind));
  return { kind, total, gain: total - countOutfits(t) };
}
function rankGaps(t) {
  return COUNTED_KINDS.map((kind) => gainFrom(t, kind)).sort((a, b) => b.gain - a.gain);
}
function missingForFirstOutfit(t) {
  if (countOutfits(t) > 0) return [];
  const missing = [];
  if (t.shoes === 0) missing.push("shoes");
  if (t.dresses === 0) {
    if (t.tops === 0) missing.push("tops");
    if (t.bottoms === 0) missing.push("bottoms");
  }
  return missing;
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

// tests/outfit-count.test.ts
var closet = (tops, bottoms, dresses, shoes) => ({
  tops,
  bottoms,
  dresses,
  shoes
});
var THE_TEN = closet(3, 2, 1, 2);
test("every count printed in the five atlases", () => {
  const cases = [
    [THE_TEN, 14, 'The Ten \xB7 The Reveal R-02 \u2014 "Ten pieces. Fourteen outfits."'],
    [closet(4, 2, 0, 2), 16, "The Ten T-04 \xB7 The Reveal R-04 \u2014 a fourth top instead of the dress"],
    [closet(3, 3, 0, 2), 18, "The Ten T-04 \u2014 a third bottom instead of the dress"],
    [closet(3, 2, 0, 2), 12, 'The Ten T-04 \u2014 "keep the slot open", finish with nine'],
    [closet(3, 2, 1, 3), 21, "The Gap Feed \xB7 The Wall \u2014 a second pair of shoes"],
    [closet(3, 3, 1, 2), 20, "The Gap Feed \u2014 a third bottom"],
    [closet(4, 2, 1, 2), 18, "The Gap Feed \u2014 a fourth top"],
    [closet(3, 2, 2, 2), 16, "The Gap Feed \u2014 a second dress"],
    [closet(10, 0, 0, 0), 0, "The Reveal R-05 \u2014 ten tops and nothing else"]
  ];
  for (const [t, expected, source] of cases) {
    assert.equal(countOutfits(t), expected, source);
  }
});
test("coats and bags never change the count", () => {
  const withCoatAndBag = tallyOf([
    ...Array.from({ length: 3 }, () => garment("base_top", "white")),
    ...Array.from({ length: 2 }, () => garment("bottom", "charcoal")),
    garment("dress", "olive"),
    ...Array.from({ length: 2 }, () => garment("footwear", "brown")),
    garment("outerwear", "cognac"),
    garment("bag", "cognac")
  ]);
  assert.deepEqual(withCoatAndBag, THE_TEN);
  assert.equal(countOutfits(withCoatAndBag), 14);
});
test("a knit counts as a top", () => {
  assert.equal(kindOfSlot("mid_layer"), "tops");
  const knitwear = tallyOf([
    garment("base_top", "white"),
    garment("mid_layer", "cream"),
    garment("base_top", "black"),
    garment("bottom", "charcoal"),
    garment("bottom", "beige"),
    garment("dress", "olive"),
    garment("footwear", "brown"),
    garment("footwear", "black")
  ]);
  assert.equal(knitwear.tops, 3);
  assert.equal(countOutfits(knitwear), 14);
});
test("the gap ranking the feed prints, in order", () => {
  const ranked = rankGaps(THE_TEN);
  assert.deepEqual(
    ranked.map((g) => [g.kind, g.total, g.gain]),
    [
      ["shoes", 21, 7],
      ["bottoms", 20, 6],
      ["tops", 18, 4],
      ["dresses", 16, 2]
    ]
  );
});
test("an unbalanced closet: one gap dominates", () => {
  const unbalanced = closet(8, 1, 0, 1);
  assert.equal(countOutfits(unbalanced), 8);
  const ranked = rankGaps(unbalanced);
  assert.deepEqual(
    ranked.slice(0, 2).map((g) => [g.kind, g.gain]).sort(),
    [
      ["bottoms", 8],
      ["shoes", 8]
    ].sort()
  );
  assert.equal(gainFrom(unbalanced, "tops").gain, 1);
});
test("nothing to build with names exactly what is missing", () => {
  assert.deepEqual(missingForFirstOutfit(closet(10, 0, 0, 0)), ["shoes", "bottoms"]);
  assert.deepEqual(missingForFirstOutfit(closet(0, 0, 1, 0)), ["shoes"]);
  assert.deepEqual(missingForFirstOutfit(THE_TEN), []);
});
test("a gain is never negative", () => {
  for (const t of [closet(0, 0, 0, 0), closet(1, 0, 0, 0), THE_TEN]) {
    for (const g of rankGaps(t)) assert.ok(g.gain >= 0, `${g.kind} gained ${g.gain}`);
  }
});
