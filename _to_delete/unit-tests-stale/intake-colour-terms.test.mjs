// tests/intake-colour-terms.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// supabase/functions/_shared/intake-schema.ts
var SLOTS = [
  "base_top",
  "mid_layer",
  "bottom",
  "dress",
  "outerwear",
  "footwear",
  "bag",
  "headwear",
  "accessory"
];
var COLOUR_TERMS = [
  "black",
  "charcoal",
  "dark grey",
  "dark gray",
  "grey",
  "gray",
  "light grey",
  "light gray",
  "silver",
  "white",
  "off white",
  "ivory",
  "cream",
  "ecru",
  "bone",
  "navy",
  "navy blue",
  "midnight",
  "indigo",
  "denim",
  "light wash",
  "medium wash",
  "dark wash",
  "blue",
  "royal blue",
  "cobalt",
  "sky blue",
  "baby blue",
  "powder blue",
  "light blue",
  "cornflower",
  "slate",
  "slate blue",
  "steel",
  "teal",
  "turquoise",
  "aqua",
  "cyan",
  "petrol",
  "green",
  "olive",
  "olive green",
  "khaki",
  "forest green",
  "forest",
  "hunter",
  "emerald",
  "sage",
  "mint",
  "lime green",
  "lime",
  "moss",
  "army green",
  "yellow",
  "mustard",
  "gold",
  "butter",
  "lemon",
  "ochre",
  "orange",
  "rust",
  "terracotta",
  "burnt",
  "burnt orange",
  "peach",
  "apricot",
  "coral",
  "brown",
  "chocolate",
  "espresso",
  "tan",
  "camel",
  "beige",
  "sand",
  "stone",
  "taupe",
  "caramel",
  "cognac",
  "bronze",
  "copper",
  "red",
  "crimson",
  "burgundy",
  "maroon",
  "wine",
  "brick",
  "cherry",
  "scarlet",
  "pink",
  "hot pink",
  "blush",
  "rose",
  "fuchsia",
  "magenta",
  "mauve",
  "salmon",
  "purple",
  "lavender",
  "lilac",
  "violet",
  "plum",
  "aubergine",
  "eggplant"
];
var MAX_QUANTITY = 12;

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

// tests/intake-colour-terms.test.ts
test("every colour term in the parse enum resolves in the lexicon", () => {
  const unresolvable = COLOUR_TERMS.filter((term) => resolveColorName(term) === null);
  assert.deepEqual(
    unresolvable,
    [],
    `these terms are offered to the model but resolve to nothing: ${unresolvable.join(", ")}`
  );
});
test("the enum is not empty and carries no duplicates", () => {
  assert.ok(COLOUR_TERMS.length > 50, "a thin lexicon forces the model into bad nearest-matches");
  assert.equal(new Set(COLOUR_TERMS).size, COLOUR_TERMS.length, "duplicate colour terms");
});
test("the wardrobe neutrals are all offerable", () => {
  for (const neutral of ["navy", "olive", "camel", "charcoal", "cream", "chocolate"]) {
    assert.ok(
      COLOUR_TERMS.includes(neutral),
      `"${neutral}" is a wardrobe neutral and must be offerable`
    );
    assert.notEqual(resolveColorName(neutral), null, `"${neutral}" must resolve`);
  }
});
test("the parse schema offers exactly the nine styling slots", () => {
  assert.deepEqual(
    [...SLOTS].sort(),
    ["accessory", "bag", "base_top", "bottom", "dress", "footwear", "headwear", "mid_layer", "outerwear"]
  );
});
test("the quantity ceiling agrees with the drafts constraint", () => {
  assert.equal(MAX_QUANTITY, 12);
});
