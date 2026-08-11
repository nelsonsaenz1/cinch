// tests/color.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/lib/color/oklch.ts
var clamp01 = (n) => n < 0 ? 0 : n > 1 ? 1 : n;
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
function toHex({ r, g, b }) {
  const c = (n) => Math.round(clamp01(n) * 255).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
var srgbToLinear = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
var linearToSrgb = (c) => c <= 31308e-7 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
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
function oklabToRgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: clamp01(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clamp01(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clamp01(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s))
  };
}
function oklabToOklch({ L, a, b }) {
  const C = Math.sqrt(a * a + b * b);
  const h = C < 1e-6 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  return { L, C, h };
}
function oklchToOklab({ L, C, h }) {
  const rad = h * Math.PI / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}
var hexToOklch = (hex) => {
  const rgb = parseHex(hex);
  return rgb ? oklabToOklch(rgbToOklab(rgb)) : null;
};
var oklchToHex = (c) => toHex(oklabToRgb(oklchToOklab(c)));
function hueDistance(h1, h2) {
  const d = Math.abs((h1 - h2) % 360 + 360) % 360;
  return d > 180 ? 360 - d : d;
}
function deltaE(a, b) {
  const la = oklchToOklab(a);
  const lb = oklchToOklab(b);
  const dL = la.L - lb.L;
  const da = la.a - lb.a;
  const db = la.b - lb.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

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

// src/lib/color/harmony.ts
var VIVID = 0.13;
function pairHarmony(a, b) {
  if (a.metallic || b.metallic) return { score: 0.72, label: "metallic-accent" };
  const dh = hueDistance(a.oklch.h, b.oklch.h);
  const dE = deltaE(a.oklch, b.oklch);
  const dC = Math.abs(a.oklch.C - b.oklch.C);
  if (dE > 0.04 && dE < 0.14 && dC < 0.06) return { score: 0.3, label: "near-miss" };
  const an = a.neutrality;
  const bn = b.neutrality;
  const maxNeutral = Math.max(an, bn);
  if (maxNeutral > 0.72) {
    if (Math.min(an, bn) > 0.72) {
      const bothTinted = a.oklch.C > 0.03 && b.oklch.C > 0.03;
      if (bothTinted) {
        if (dh < 60) return { score: 0.8, label: "analogous" };
        if (dh > 120) return { score: 0.86, label: "complementary" };
      }
      return { score: 0.7, label: "neutral-anchored" };
    }
    return { score: 0.82, label: "neutral-anchored" };
  }
  let score;
  let label;
  if (dh < 12) {
    const dL2 = Math.abs(a.oklch.L - b.oklch.L);
    score = dL2 > 0.18 ? 0.86 : 0.62;
    label = "monochrome";
  } else if (dh < 48) {
    score = 0.8;
    label = "analogous";
  } else if (dh < 72) {
    score = 0.52;
    label = "analogous";
  } else if (dh < 104) {
    score = 0.28;
    label = "discord";
  } else if (dh < 136) {
    score = 0.68;
    label = "triadic";
  } else if (dh < 160) {
    score = 0.74;
    label = "split-complementary";
  } else {
    score = 0.8;
    label = "complementary";
  }
  if (dh > 100 && a.oklch.C > VIVID && b.oklch.C > VIVID) {
    const minWeight = Math.min(a.weight, b.weight);
    const relief = minWeight < 0.2 ? 0.9 : 0.62;
    score *= relief;
  }
  const dL = Math.abs(a.oklch.L - b.oklch.L);
  if (label === "discord" && dL > 0.35) score = Math.min(1, score + 0.18);
  return { score: Math.max(0, Math.min(1, score)), label };
}
function analyzePalette(pieces) {
  const dominant = pieces.map((p) => ({ color: p.colors[0], weight: p.visualWeight })).filter((p) => Boolean(p.color));
  if (dominant.length < 2) {
    return {
      cohesion: 0.6,
      valueContrast: 0.5,
      chromaDiscipline: 1,
      hasNeutralAnchor: dominant.some((d) => d.color.neutrality > 0.7),
      labels: [],
      score: 0.6
    };
  }
  let weighted = 0;
  let weightSum = 0;
  const labelCounts = /* @__PURE__ */ new Map();
  for (let i = 0; i < dominant.length; i++) {
    for (let j = i + 1; j < dominant.length; j++) {
      const a = dominant[i];
      const b = dominant[j];
      const { score: score2, label } = pairHarmony(
        { ...a.color, weight: a.weight },
        { ...b.color, weight: b.weight }
      );
      const w = a.weight * b.weight;
      weighted += score2 * w;
      weightSum += w;
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
  }
  const cohesion = weightSum > 0 ? weighted / weightSum : 0.6;
  const Ls = dominant.map((d) => d.color.oklch.L);
  const spread = Math.max(...Ls) - Math.min(...Ls);
  const valueContrast = spread < 0.1 ? 0.35 + spread * 2 : spread < 0.5 ? 1 - Math.abs(spread - 0.32) * 0.6 : Math.max(0.55, 1 - (spread - 0.5) * 0.5);
  const loud = dominant.filter(
    (d) => d.color.oklch.C > VIVID && d.color.neutrality < 0.5 && d.weight > 0.15
  ).length;
  const chromaDiscipline = loud <= 1 ? 1 : loud === 2 ? 0.82 : Math.max(0.3, 1 - (loud - 1) * 0.28);
  const hasNeutralAnchor = dominant.some((d) => d.color.neutrality > 0.7 && d.weight > 0.2);
  const labels = [...labelCounts.entries()].sort((x, y) => y[1] - x[1]).map(([label]) => label);
  const score = cohesion * 0.5 + valueContrast * 0.24 + chromaDiscipline * 0.2 + (hasNeutralAnchor ? 0.06 : 0);
  return {
    cohesion,
    valueContrast,
    chromaDiscipline,
    hasNeutralAnchor,
    labels,
    score: Math.max(0, Math.min(1, score))
  };
}
function fitToPalette(candidate, existing) {
  if (!existing.length) return 0.6;
  const c = {
    oklch: candidate,
    name: "",
    family: "neutral",
    neutrality: neutrality(candidate),
    metallic: false,
    weight: 0.5
  };
  const scores = existing.map((e) => pairHarmony(c, e).score);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// tests/color.test.ts
var color = (name, weight = 0.5) => {
  const c = toGarmentColors([{ name }])[0];
  assert.ok(c, `fixture colour "${name}" did not resolve`);
  return { ...c, weight };
};
test("parseHex accepts 3- and 6-digit forms, with or without the hash", () => {
  assert.deepEqual(parseHex("#000000"), { r: 0, g: 0, b: 0 });
  assert.deepEqual(parseHex("ffffff"), { r: 1, g: 1, b: 1 });
  assert.deepEqual(parseHex("#fff"), parseHex("#ffffff"));
  assert.deepEqual(parseHex("  #FFF  "), parseHex("#ffffff"));
});
test("parseHex rejects anything it cannot parse rather than guessing", () => {
  for (const bad of ["", "#", "xyz", "#12345", "#1234567", "rgb(1,2,3)", "#ggg"]) {
    assert.equal(parseHex(bad), null, `parseHex(${JSON.stringify(bad)}) should be null`);
  }
});
test("hex -> OKLCH -> hex round-trips inside one 8-bit step", () => {
  const samples = [
    "#000000",
    "#ffffff",
    "#808080",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#1f2a44",
    "#b58f5f",
    "#6a6b3d",
    "#5e2233",
    "#e0479a",
    "#2549b8"
  ];
  for (const hex of samples) {
    const back = oklchToHex(hexToOklch(hex));
    const a = parseHex(hex);
    const b = parseHex(back);
    for (const ch of ["r", "g", "b"]) {
      const delta = Math.abs(a[ch] - b[ch]) * 255;
      assert.ok(delta <= 1.5, `${hex} -> ${back}: ${ch} drifted ${delta.toFixed(2)}/255`);
    }
  }
});
test("OKLab anchors match the published reference values", () => {
  const white = hexToOklch("#ffffff");
  assert.ok(Math.abs(white.L - 1) < 2e-3, `white L = ${white.L}`);
  assert.ok(white.C < 5e-3, `white should be achromatic, C = ${white.C}`);
  const black = hexToOklch("#000000");
  assert.ok(Math.abs(black.L) < 2e-3, `black L = ${black.L}`);
  const red = hexToOklch("#ff0000");
  assert.ok(Math.abs(red.L - 0.6279) < 0.01, `red L = ${red.L}`);
  assert.ok(Math.abs(red.h - 29.23) < 1, `red h = ${red.h}`);
  const blue = hexToOklch("#0000ff");
  assert.ok(Math.abs(blue.L - 0.452) < 0.01, `blue L = ${blue.L}`);
  assert.ok(Math.abs(blue.h - 264.05) < 1, `blue h = ${blue.h}`);
});
test("near-grey has a defined, non-jittering hue of zero", () => {
  const grey = hexToOklch("#808080");
  assert.equal(grey.h, 0);
  assert.ok(grey.C < 1e-6);
});
test("hueDistance is circular, symmetric, and capped at 180", () => {
  assert.equal(hueDistance(350, 10), 20);
  assert.equal(hueDistance(10, 350), 20);
  assert.equal(hueDistance(0, 180), 180);
  assert.equal(hueDistance(0, 190), 170);
  assert.equal(hueDistance(45, 45), 0);
  assert.equal(hueDistance(-10, 10), 20);
  assert.equal(hueDistance(370, 10), 0);
  for (let a = 0; a < 360; a += 37) {
    for (let b = 0; b < 360; b += 53) {
      const d = hueDistance(a, b);
      assert.ok(d >= 0 && d <= 180, `hueDistance(${a},${b}) = ${d}`);
      assert.equal(d, hueDistance(b, a));
    }
  }
});
test("deltaE is zero for identical colours and symmetric otherwise", () => {
  const navy = hexToOklch("#1f2a44");
  const camel = hexToOklch("#b58f5f");
  assert.equal(deltaE(navy, navy), 0);
  assert.ok(Math.abs(deltaE(navy, camel) - deltaE(camel, navy)) < 1e-12);
  assert.ok(deltaE(navy, camel) > 0.14, "navy and camel should be clearly different");
});
test("achromatics are fully neutral and vivid colours are not", () => {
  for (const n of ["black", "white", "grey", "charcoal"]) {
    assert.ok(neutrality(resolveColorName(n)) > 0.9, `${n} should read as neutral`);
  }
  for (const n of ["hot pink", "cobalt", "lime green"]) {
    assert.ok(neutrality(resolveColorName(n)) < 0.4, `${n} should not read as neutral`);
  }
});
test("wardrobe neutrals carrying real chroma still behave as neutrals", () => {
  for (const n of ["navy", "olive", "camel", "beige", "chocolate", "taupe"]) {
    assert.ok(neutrality(resolveColorName(n)) > 0.6, `${n} should behave as a neutral`);
  }
});
test("neutrality stays inside 0..1 across the whole colour table", () => {
  for (const name of ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "sage", "mustard"]) {
    const n = neutrality(resolveColorName(name));
    assert.ok(n >= 0 && n <= 1, `${name} neutrality = ${n}`);
  }
});
test("hue families land where OKLCH puts them, not where the RGB wheel does", () => {
  assert.equal(hueFamily(resolveColorName("cobalt")), "blue");
  assert.equal(hueFamily(resolveColorName("scarlet")), "red");
  assert.equal(hueFamily(resolveColorName("hot pink")), "pink");
  assert.equal(hueFamily(resolveColorName("emerald")), "green");
  assert.equal(hueFamily(resolveColorName("turquoise")), "teal");
  assert.equal(hueFamily(resolveColorName("navy")), "neutral");
  assert.equal(hueFamily(resolveColorName("black")), "neutral");
});
test("unresolvable and empty names return null rather than a default colour", () => {
  assert.equal(resolveColorName(""), null);
  assert.equal(resolveColorName("   "), null);
  assert.equal(resolveColorName("zzzz"), null);
});
test("multi-word names beat their single-word substrings", () => {
  const light = resolveColorName("light blue");
  const plain = resolveColorName("blue");
  assert.ok(light.L > plain.L, "light blue should be lighter than blue");
});
test("modifiers the table cannot enumerate are applied to the anchor word", () => {
  const indigo = resolveColorName("indigo");
  const washed = resolveColorName("washed indigo");
  assert.ok(washed.L > indigo.L && washed.C < indigo.C, "washed should lighten and desaturate");
  const deep = resolveColorName("deep indigo");
  assert.ok(deep.L < indigo.L, "deep should darken");
  const neon = resolveColorName("neon pink");
  assert.ok(neon.C > resolveColorName("pink").C, "neon should raise chroma");
  const dusty = resolveColorName("dusty rose");
  assert.ok(dusty.C < resolveColorName("rose").C, "dusty should cut chroma");
});
test("modified colours stay inside the physical bounds of the space", () => {
  for (const n of ["light white", "dark black", "neon fuchsia", "pale cream", "deep espresso"]) {
    const c = resolveColorName(n);
    assert.ok(c.L >= 0 && c.L <= 1, `${n} L = ${c.L}`);
    assert.ok(c.C >= 0 && c.C <= 0.4, `${n} C = ${c.C}`);
  }
});
test("metallics are recognised by name", () => {
  assert.ok(isMetallicName("gold"));
  assert.ok(isMetallicName("Rose Gold hardware"));
  assert.ok(!isMetallicName("golden"));
  assert.ok(!isMetallicName("navy"));
});
test("garment colour weights decay and sum to one", () => {
  const cs = toGarmentColors([{ name: "navy" }, { name: "white" }, { name: "camel" }]);
  assert.equal(cs.length, 3);
  const total = cs.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
  assert.ok(cs[0].weight > cs[1].weight && cs[1].weight > cs[2].weight, "weights must decay");
});
test("a single colour carries the whole weight", () => {
  const [only] = toGarmentColors([{ name: "navy" }]);
  assert.equal(only.weight, 1);
});
test("hex beats the name when both are present", () => {
  const [c] = toGarmentColors([{ hex: "#ff0000", name: "navy" }]);
  assert.equal(c.family, "red");
});
test("unresolvable colours are dropped, not defaulted", () => {
  assert.deepEqual(toGarmentColors([]), []);
  assert.deepEqual(toGarmentColors(null), []);
  assert.deepEqual(toGarmentColors(void 0), []);
  assert.deepEqual(toGarmentColors([{ name: "zzzz" }]), []);
  const kept = toGarmentColors([{ name: "navy" }, { name: "zzzz" }]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].weight, 1, "weights must renormalise after a drop");
});
test("pair harmony is symmetric", () => {
  const names = ["navy", "camel", "black", "rust", "olive", "hot pink", "grey", "burgundy"];
  for (const a of names) {
    for (const b of names) {
      const ab = pairHarmony(color(a), color(b));
      const ba = pairHarmony(color(b), color(a));
      assert.equal(ab.score, ba.score, `${a}+${b} scored asymmetrically`);
      assert.equal(ab.label, ba.label, `${a}+${b} labelled asymmetrically`);
    }
  }
});
test("pair harmony always returns a score inside 0..1", () => {
  const names = [
    "navy",
    "camel",
    "black",
    "white",
    "rust",
    "olive",
    "hot pink",
    "grey",
    "burgundy",
    "mustard",
    "sage",
    "cobalt",
    "lime green",
    "gold",
    "red"
  ];
  for (const a of names) {
    for (const b of names) {
      const { score } = pairHarmony(color(a), color(b));
      assert.ok(score >= 0 && score <= 1, `${a}+${b} = ${score}`);
    }
  }
});
test("near-miss is caught before the neutral rule can wave it through", () => {
  assert.equal(pairHarmony(color("navy"), color("black")).label, "near-miss");
  assert.equal(pairHarmony(color("charcoal"), color("navy")).label, "near-miss");
  assert.ok(pairHarmony(color("navy"), color("black")).score < 0.4);
});
test("the classic reliable pairings score well", () => {
  for (const [a, b] of [
    ["navy", "camel"],
    ["black", "white"],
    ["grey", "burgundy"],
    ["olive", "camel"]
  ]) {
    const { score } = pairHarmony(color(a), color(b));
    assert.ok(score >= 0.7, `${a} + ${b} scored only ${score.toFixed(2)}`);
  }
});
test("the discord zone is actively penalised, not merely unremarkable", () => {
  const { score } = pairHarmony(color("red"), color("lime green"));
  assert.ok(score < 0.5, `red + lime green scored ${score.toFixed(2)}`);
});
test("metallics short-circuit the clash calculation entirely", () => {
  for (const other of ["hot pink", "lime green", "navy", "black"]) {
    const { label, score } = pairHarmony(color("gold"), color(other));
    assert.equal(label, "metallic-accent");
    assert.ok(score > 0.5, `gold + ${other} = ${score}`);
  }
});
test("a small vivid accent is allowed to be louder than a full panel", () => {
  const accent = pairHarmony(color("cobalt", 0.05), color("mustard", 0.95));
  const panel = pairHarmony(color("cobalt", 0.5), color("mustard", 0.5));
  assert.ok(accent.score > panel.score, "a belt should be allowed to shout; a coat should not");
});
test("monochrome reads better when the values separate", () => {
  const flat = pairHarmony(color("navy"), color("indigo"));
  const separated = pairHarmony(color("light blue"), color("navy"));
  assert.ok(separated.score >= flat.score, "value separation should not be punished");
});
var piece = (name, visualWeight) => ({
  colors: toGarmentColors([{ name }]),
  visualWeight
});
test("palette analysis is bounded and handles degenerate outfits", () => {
  assert.equal(analyzePalette([]).score, 0.6);
  assert.equal(analyzePalette([piece("navy", 0.3)]).score, 0.6);
  assert.equal(analyzePalette([piece("zzzz", 0.3), piece("zzzz", 0.3)]).score, 0.6);
  for (const outfit of [
    [piece("navy", 0.3), piece("camel", 0.3)],
    [piece("hot pink", 0.3), piece("lime green", 0.3), piece("cobalt", 0.3), piece("mustard", 0.3)],
    [piece("black", 0.4), piece("white", 0.3), piece("grey", 0.2), piece("charcoal", 0.1)]
  ]) {
    const a = analyzePalette(outfit);
    assert.ok(a.score >= 0 && a.score <= 1, `score ${a.score}`);
    assert.ok(a.cohesion >= 0 && a.cohesion <= 1, `cohesion ${a.cohesion}`);
    assert.ok(a.valueContrast >= 0 && a.valueContrast <= 1, `valueContrast ${a.valueContrast}`);
    assert.ok(a.chromaDiscipline >= 0 && a.chromaDiscipline <= 1, `discipline ${a.chromaDiscipline}`);
  }
});
test("four loud colours are disciplined harder than one", () => {
  const one = analyzePalette([piece("navy", 0.34), piece("grey", 0.26), piece("cobalt", 0.22)]);
  const four = analyzePalette([
    piece("cobalt", 0.34),
    piece("hot pink", 0.26),
    piece("lime green", 0.22),
    piece("mustard", 0.2)
  ]);
  assert.equal(one.chromaDiscipline, 1);
  assert.ok(four.chromaDiscipline < 0.6, `four loud colours scored ${four.chromaDiscipline}`);
  assert.ok(one.score > four.score);
});
test("a neutral anchor is detected only when it is a substantial piece", () => {
  const anchored = analyzePalette([piece("navy", 0.34), piece("rust", 0.26)]);
  assert.ok(anchored.hasNeutralAnchor);
  const trimOnly = analyzePalette([piece("cobalt", 0.34), piece("black", 0.04)]);
  assert.ok(!trimOnly.hasNeutralAnchor, "a black belt is not an anchor");
});
test("fitToPalette falls back to neutral for an empty wardrobe and stays bounded", () => {
  assert.equal(fitToPalette(hexToOklch("#1f2a44"), []), 0.6);
  for (const hex of ["#1f2a44", "#b58f5f", "#e0479a", "#000000", "#ffffff"]) {
    const v = fitToPalette(hexToOklch(hex), [color("navy"), color("camel"), color("white")]);
    assert.ok(v >= 0 && v <= 1, `${hex} => ${v}`);
  }
});
