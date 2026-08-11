// tests/repeat.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/closet/outfit-count.ts
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

// src/lib/date.ts
function dateKey(d) {
  const year = String(d.getFullYear()).padStart(4, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day2 = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day2}`;
}

// src/features/styling/repeat.ts
function coreIdsOf(itemIds, wardrobe) {
  const kindById = new Map(wardrobe.map((g) => [g.id, kindOfSlot(g.slot)]));
  return [...itemIds].filter((id) => kindById.get(id) != null).sort();
}
function coreKey(ids) {
  return ids.join("\xB7");
}
function possibleCores(wardrobe) {
  const by = (kind) => wardrobe.filter((g) => kindOfSlot(g.slot) === kind);
  const tops = by("tops");
  const bottoms = by("bottoms");
  const dresses = by("dresses");
  const shoes = by("shoes");
  const cores = [];
  for (const t of tops) {
    for (const b of bottoms) {
      for (const s of shoes) cores.push([t.id, b.id, s.id].sort());
    }
  }
  for (const d of dresses) {
    for (const s of shoes) cores.push([d.id, s.id].sort());
  }
  return cores;
}
function wearsOfCore(records, wardrobe, candidateItemIds) {
  const key = coreKey(coreIdsOf(candidateItemIds, wardrobe));
  if (!key) return [];
  return records.filter((r) => coreKey(coreIdsOf(r.itemIds, wardrobe)) === key).map((r) => r.date).sort((a, b) => a.getTime() - b.getTime());
}
function exhaustionProgress(wardrobe, records) {
  const cores = possibleCores(wardrobe);
  const total = cores.length;
  const coreKeys = new Set(cores.map(coreKey));
  const wornKeys = /* @__PURE__ */ new Set();
  let since = null;
  for (const r of records) {
    const ids = coreIdsOf(r.itemIds, wardrobe);
    if (!ids.length) continue;
    const key = coreKey(ids);
    if (!coreKeys.has(key)) continue;
    wornKeys.add(key);
    if (!since || r.date.getTime() < since.getTime()) since = r.date;
  }
  return { total, wornCount: wornKeys.size, exhausted: total > 0 && wornKeys.size >= total, since };
}
function repeatRegisterFor(previousWears) {
  if (previousWears.length === 0) return { kind: "none" };
  if (previousWears.length === 1) return { kind: "first", lastWorn: previousWears[0] };
  const sorted = [...previousWears].sort((a, b) => a.getTime() - b.getTime());
  return { kind: "firm", previousWears: sorted, occurrence: sorted.length + 1 };
}
var WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];
function weekdayName(d) {
  return WEEKDAYS[d.getDay()];
}
function ordinalDay(day2) {
  const mod100 = day2 % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day2}th`;
  switch (day2 % 10) {
    case 1:
      return `${day2}st`;
    case 2:
      return `${day2}nd`;
    case 3:
      return `${day2}rd`;
    default:
      return `${day2}th`;
  }
}
var ORDINAL_WORDS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth"
];
function ordinalWord(n) {
  return ORDINAL_WORDS[n - 1] ?? `${n}th`;
}
function describeDate(d, now) {
  return dateKey(d) === dateKey(now) ? "today" : `${weekdayName(d)} the ${ordinalDay(d.getDate())}`;
}
function joinDates(parts) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}
function daysBetween(a, b) {
  const toNoon = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((toNoon(b) - toNoon(a)) / 864e5);
}
function describeSpan(first, now) {
  const days = Math.max(0, daysBetween(first, now));
  const weeks = Math.max(1, Math.round(days / 7));
  return weeks === 1 ? "in the last week" : `in the last ${weeks} weeks`;
}
function describeShortDate(d) {
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${d.getDate()} ${month}`;
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

// tests/repeat.test.ts
var day = (y, m, d, hh = 9, mm = 0) => new Date(y, m - 1, d, hh, mm, 0);
function theTen() {
  resetIds();
  return [
    garment("base_top", "white"),
    // g1
    garment("base_top", "navy"),
    // g2
    garment("mid_layer", "cream"),
    // g3
    garment("bottom", "charcoal"),
    // g4
    garment("bottom", "denim"),
    // g5
    garment("dress", "olive"),
    // g6
    garment("footwear", "brown"),
    // g7
    garment("footwear", "black"),
    // g8
    garment("outerwear", "navy"),
    // g9
    garment("bag", "tan")
    // g10
  ];
}
test("possibleCores never diverges from countOutfits, across every atlas closet", () => {
  const closet = (tops, bottoms, dresses, shoes) => {
    resetIds();
    return [
      ...Array.from({ length: tops }, () => garment("base_top", "white")),
      ...Array.from({ length: bottoms }, () => garment("bottom", "charcoal")),
      ...Array.from({ length: dresses }, () => garment("dress", "olive")),
      ...Array.from({ length: shoes }, () => garment("footwear", "brown"))
    ];
  };
  const cases = [
    [3, 2, 1, 2],
    // The Ten — 14
    [4, 2, 0, 2],
    // 16
    [3, 3, 0, 2],
    // 18
    [3, 2, 0, 2],
    // 12
    [3, 2, 1, 3],
    // 21
    [0, 0, 0, 0]
    // 0
  ];
  for (const [tops, bottoms, dresses, shoes] of cases) {
    const wardrobe = closet(tops, bottoms, dresses, shoes);
    const cores = possibleCores(wardrobe);
    assert.equal(cores.length, countOutfits(tallyOf(wardrobe)), `${tops}/${bottoms}/${dresses}/${shoes}`);
  }
});
test("the canonical ten makes exactly fourteen possible cores", () => {
  assert.equal(possibleCores(theTen()).length, 14);
});
test("coreIdsOf keeps only counted-kind garments, sorted", () => {
  const wardrobe = theTen();
  const [top, , , bottom, , , shoe, , outer, bag] = wardrobe;
  const full = [outer.id, top.id, bottom.id, shoe.id, bag.id];
  const core = coreIdsOf(full, wardrobe);
  assert.deepEqual(core, [top.id, bottom.id, shoe.id].sort());
});
test("coreIdsOf drops ids not present in the wardrobe at all", () => {
  const wardrobe = theTen();
  const [top, , , bottom, , , shoe] = wardrobe;
  const core = coreIdsOf([top.id, bottom.id, shoe.id, "sold-item-id"], wardrobe);
  assert.deepEqual(core, [top.id, bottom.id, shoe.id].sort());
});
test("coreKey is order-independent once ids are sorted", () => {
  assert.equal(coreKey(["a", "b", "c"]), coreKey(["a", "b", "c"]));
  assert.notEqual(coreKey(["a", "b"]), coreKey(["a", "b", "c"]));
});
test("wearsOfCore matches the same core regardless of bag or coat", () => {
  const wardrobe = theTen();
  const [top, , , bottom, , , shoe, , outer, bag] = wardrobe;
  const core = [top.id, bottom.id, shoe.id];
  const records = [
    { date: day(2026, 8, 4), itemIds: core },
    // bare core
    { date: day(2026, 8, 7), itemIds: [...core, bag.id] },
    // core + bag
    { date: day(2026, 8, 9), itemIds: [outer.id, ...core, bag.id] }
    // core + coat + bag
  ];
  const wears = wearsOfCore(records, wardrobe, core);
  assert.equal(wears.length, 3);
  assert.deepEqual(
    wears.map((d) => d.getTime()),
    [day(2026, 8, 4).getTime(), day(2026, 8, 7).getTime(), day(2026, 8, 9).getTime()]
  );
});
test("wearsOfCore never matches a genuinely different core", () => {
  const wardrobe = theTen();
  const [top, , , bottom, , , shoe1, shoe2] = wardrobe;
  const records = [{ date: day(2026, 8, 4), itemIds: [top.id, bottom.id, shoe2.id] }];
  const wears = wearsOfCore(records, wardrobe, [top.id, bottom.id, shoe1.id]);
  assert.deepEqual(wears, []);
});
test("wearsOfCore returns nothing for an item set with no counted core", () => {
  const wardrobe = theTen();
  const [, , , , , , , , outer, bag] = wardrobe;
  const wears = wearsOfCore(
    [{ date: day(2026, 8, 4), itemIds: [outer.id, bag.id] }],
    wardrobe,
    [outer.id, bag.id]
  );
  assert.deepEqual(wears, []);
});
test("an unmarked day produces no wear \u2014 no inference, ever", () => {
  const wardrobe = theTen();
  const [top, , , bottom, , , shoe] = wardrobe;
  assert.deepEqual(wearsOfCore([], wardrobe, [top.id, bottom.id, shoe.id]), []);
});
function twoCoreCloset() {
  resetIds();
  const tops = [garment("base_top", "white"), garment("base_top", "navy")];
  const bottom = garment("bottom", "charcoal");
  const shoe = garment("footwear", "brown");
  return { wardrobe: [...tops, bottom, shoe], tops, bottom, shoe };
}
test("exhausted only once every real core has a real worn record", () => {
  const { wardrobe, tops, bottom, shoe } = twoCoreCloset();
  assert.equal(possibleCores(wardrobe).length, 2);
  const oneCore = [{ date: day(2026, 8, 1), itemIds: [tops[0].id, bottom.id, shoe.id] }];
  const partial = exhaustionProgress(wardrobe, oneCore);
  assert.equal(partial.wornCount, 1);
  assert.equal(partial.exhausted, false);
  const bothCores = [
    ...oneCore,
    { date: day(2026, 8, 3), itemIds: [tops[1].id, bottom.id, shoe.id] }
  ];
  const full = exhaustionProgress(wardrobe, bothCores);
  assert.equal(full.total, 2);
  assert.equal(full.wornCount, 2);
  assert.equal(full.exhausted, true);
  assert.equal(full.since?.getTime(), day(2026, 8, 1).getTime());
});
test("a record for an item no longer in the wardrobe cannot force exhaustion", () => {
  const { wardrobe, tops, bottom, shoe } = twoCoreCloset();
  const records = [
    { date: day(2026, 8, 1), itemIds: [tops[0].id, bottom.id, shoe.id] },
    // References an id this wardrobe has never had — a sold or removed item.
    { date: day(2026, 8, 2), itemIds: ["ghost-1", "ghost-2", "ghost-3"] }
  ];
  const progress = exhaustionProgress(wardrobe, records);
  assert.equal(progress.wornCount, 1);
  assert.equal(progress.exhausted, false);
});
test("an empty wardrobe is never exhausted \u2014 nothing to exhaust", () => {
  const progress = exhaustionProgress([], []);
  assert.equal(progress.total, 0);
  assert.equal(progress.exhausted, false);
  assert.equal(progress.since, null);
});
test("zero previous wears is not a repeat", () => {
  assert.deepEqual(repeatRegisterFor([]), { kind: "none" });
});
test("one previous wear is the first-register repeat (P-01)", () => {
  const register = repeatRegisterFor([day(2026, 8, 4)]);
  assert.equal(register.kind, "first");
  if (register.kind === "first") assert.equal(register.lastWorn.getTime(), day(2026, 8, 4).getTime());
});
test("two or more previous wears escalate once to the firm register (P-02), and stop", () => {
  const two = repeatRegisterFor([day(2026, 8, 7), day(2026, 8, 4)]);
  assert.equal(two.kind, "firm");
  if (two.kind === "firm") {
    assert.equal(two.occurrence, 3);
    assert.deepEqual(
      two.previousWears.map((d) => d.getTime()),
      [day(2026, 8, 4).getTime(), day(2026, 8, 7).getTime()]
    );
  }
  const four = repeatRegisterFor([day(2026, 8, 4), day(2026, 8, 7), day(2026, 8, 11)]);
  assert.equal(four.kind, "firm");
  if (four.kind === "firm") assert.equal(four.occurrence, 4);
});
test("weekdayName reads the real calendar weekday", () => {
  assert.equal(weekdayName(day(2026, 8, 4)), "Tuesday");
  assert.equal(weekdayName(day(2026, 8, 7)), "Friday");
});
test("ordinalDay handles the 11th/12th/13th exception", () => {
  const cases = [
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [24, "24th"]
  ];
  for (const [n, expected] of cases) assert.equal(ordinalDay(n), expected);
});
test("ordinalWord matches repeatRegisterFor occurrences", () => {
  assert.equal(ordinalWord(1), "first");
  assert.equal(ordinalWord(2), "second");
  assert.equal(ordinalWord(3), "third");
  assert.equal(ordinalWord(11), "11th");
});
test('describeDate says "today" for the same local day, and a real weekday otherwise', () => {
  const now = day(2026, 8, 7);
  assert.equal(describeDate(day(2026, 8, 7, 21, 0), now), "today");
  assert.equal(describeDate(day(2026, 8, 4), now), "Tuesday the 4th");
});
test("joinDates joins the way spoken English does", () => {
  assert.equal(joinDates([]), "");
  assert.equal(joinDates(["a"]), "a");
  assert.equal(joinDates(["a", "b"]), "a and b");
  assert.equal(joinDates(["a", "b", "c"]), "a, b, and c");
  assert.equal(
    joinDates(["Tuesday the 4th", "Friday the 7th", "today"]),
    "Tuesday the 4th, Friday the 7th, and today"
  );
});
test("describeSpan rounds to whole weeks and never claims false precision", () => {
  assert.equal(describeSpan(day(2026, 8, 4), day(2026, 8, 6)), "in the last week");
  assert.equal(describeSpan(day(2026, 8, 4), day(2026, 8, 12)), "in the last week");
  assert.equal(describeSpan(day(2026, 8, 4), day(2026, 8, 20)), "in the last 2 weeks");
});
test("describeShortDate prints day and month, never a bare ISO string", () => {
  assert.equal(describeShortDate(day(2026, 7, 18)), "18 Jul");
});
