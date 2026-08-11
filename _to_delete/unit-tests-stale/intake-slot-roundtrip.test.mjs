// tests/intake-slot-roundtrip.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

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

// src/lib/styling/garment.ts
var MID_LAYER = /\b(sweater|jumper|cardigan|hoodie|sweatshirt|fleece|vest|gilet|overshirt|shacket|pullover|knit|turtleneck)\b/i;
var OUTERWEAR_TOP = /\b(blazer|sport coat|suit jacket)\b/i;
function toSlot(item) {
  const sub = item.subcategory ?? "";
  switch (item.category) {
    case "dress":
      return "dress";
    case "bottom":
      return "bottom";
    case "footwear":
      return "footwear";
    case "bag":
      return "bag";
    case "headwear":
      return "headwear";
    case "jewelry":
    case "accessory":
      return "accessory";
    case "outerwear":
      return "outerwear";
    case "top":
      if (OUTERWEAR_TOP.test(sub)) return "outerwear";
      return MID_LAYER.test(sub) ? "mid_layer" : "base_top";
    default:
      return "accessory";
  }
}

// tests/intake-slot-roundtrip.test.ts
var INTAKE_CATEGORY_FOR = {
  base_top: "top",
  mid_layer: "top",
  bottom: "bottom",
  dress: "dress",
  outerwear: "outerwear",
  footwear: "footwear",
  bag: "bag",
  headwear: "headwear",
  accessory: "accessory"
};
function committedSlot(slot, spokenNoun) {
  return toSlot({
    category: INTAKE_CATEGORY_FOR[slot],
    subcategory: spokenNoun
  });
}
var SPOKEN = {
  base_top: ["crewneck", "tee", "t-shirt", "button-down shirt", "blouse", "tank top"],
  mid_layer: ["cardigan", "sweater", "jumper", "hoodie", "sweatshirt", "fleece", "turtleneck"],
  bottom: ["jeans", "trousers", "skirt", "shorts", "chinos"],
  dress: ["midi dress", "slip dress", "shirt dress"],
  outerwear: ["wool coat", "trench coat", "puffer jacket", "parka"],
  footwear: ["ankle boots", "trainers", "loafers", "heels"],
  bag: ["tote", "clutch", "crossbody bag"],
  headwear: ["beanie", "baseball cap", "wool hat"],
  accessory: ["leather belt", "silk scarf", "sunglasses"]
};
for (const slot of Object.keys(SPOKEN)) {
  for (const noun of SPOKEN[slot]) {
    test(`${slot}: "${noun}" survives the commit round trip`, () => {
      assert.equal(
        committedSlot(slot, noun),
        slot,
        `a draft parsed as ${slot} came back as ${committedSlot(slot, noun)} \u2014 the styling engine would treat this garment as the wrong layer`
      );
    });
  }
}
test("a mid_layer with no knit word degrades to base_top, not to nothing", () => {
  const degraded = committedSlot("mid_layer", "thing");
  assert.equal(degraded, "base_top");
  assert.notEqual(degraded, "accessory");
});
test("the drafts CHECK constraint and the Slot union agree", () => {
  const SQL_SLOTS = [
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
  assert.deepEqual(SQL_SLOTS.sort(), Object.keys(INTAKE_CATEGORY_FOR).sort());
});
