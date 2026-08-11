// tests/packing-memo.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/context/weather.ts
function formatTemp(celsius, units) {
  const value = units === "F" ? celsius * 9 / 5 + 32 : celsius;
  return `${Math.round(value)}\xB0`;
}

// src/features/plan/trip.ts
var DAY_PARTS = [
  { key: "daytime", label: "Daytime", title: "Day", phrase: "daytime", formalityOffset: 0 },
  { key: "evening", label: "Evening", title: "Night", phrase: "evenings", formalityOffset: 1 },
  { key: "gym", label: "Gym", title: "Gym", phrase: "the gym", formalityOffset: -2 },
  {
    key: "travel",
    label: "Travel days",
    title: "Travel",
    phrase: "travel days",
    formalityOffset: -1
  }
];
var dayPartOf = (key) => DAY_PARTS.find((p) => p.key === key) ?? DAY_PARTS[0];

// src/features/plan/packing-memo.ts
var WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty"
];
var word = (n) => WORDS[n] ?? String(n);
var cap = (s) => s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
function garmentLabel(g) {
  const s = g.subcategory ?? g.category;
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function bagHeaderLine(items) {
  const n = items.length;
  const base = `${n} ${n === 1 ? "piece" : "pieces"}`;
  if (!n) return base;
  const allPriced = items.every((p) => p.garment.purchasePrice !== null);
  if (!allPriced) return base;
  const totalPrice = items.reduce((s, p) => s + (p.garment.purchasePrice ?? 0), 0);
  const totalWears = items.reduce((s, p) => s + p.garment.wearCount, 0);
  if (totalWears === 0) return base;
  return `${base} \xB7 $${(totalPrice / totalWears).toFixed(2)} per wear`;
}
function memoHeadline(pieceCount, lookCount) {
  const pieces = `${cap(word(pieceCount))} ${pieceCount === 1 ? "piece" : "pieces"}`;
  const looks = `${word(lookCount)} ${lookCount === 1 ? "look" : "looks"}`;
  return `${pieces}, ${looks}, one bag.`;
}
function forecastSummaryLine(forecasts, units = "F") {
  const lowC = Math.min(...forecasts.map((f) => f.lowC));
  const highC = Math.max(...forecasts.map((f) => f.highC));
  const wet = forecasts.filter((f) => f.precipitationChance >= 0.4).length;
  const wetPhrase = wet === 0 ? "no wet days" : wet === 1 ? "one wet day" : `${word(wet)} wet days`;
  return `${formatTemp(lowC, units).replace("\xB0", "")}\u2013${formatTemp(highC, units)}, ${wetPhrase}.`;
}
var warmthForTemp = (c) => {
  if (c <= 5) return 5;
  if (c <= 12) return 4;
  if (c <= 18) return 3;
  if (c <= 24) return 2;
  return 1;
};
function closetWeatherFit(wardrobe, forecasts) {
  if (!forecasts.length) return { total: wardrobe.length, suitable: 0 };
  const lowC = Math.min(...forecasts.map((f) => f.lowC));
  const highC = Math.max(...forecasts.map((f) => f.highC));
  const minWarmth = warmthForTemp(highC);
  const maxWarmth = warmthForTemp(lowC);
  const suitable = wardrobe.filter(
    (g) => g.warmth >= minWarmth - 1 && g.warmth <= maxWarmth + 1
  ).length;
  return { total: wardrobe.length, suitable };
}
function firstUnfilledPart(looks) {
  return looks.find((l) => !l.outfit)?.part ?? null;
}
function shortfallSentence(requestedLooks, unfilled, missingPart) {
  const achieved = Math.max(0, requestedLooks - unfilled);
  const lead = `${cap(word(achieved))} ${achieved === 1 ? "look" : "looks"}, not ${word(requestedLooks)} \u2014`;
  if (!missingPart) {
    return `${lead} your closet doesn't have enough pieces for every look this trip needs.`;
  }
  return `${lead} you don't own anything that works for ${dayPartOf(missingPart).phrase}.`;
}

// tests/packing-memo.test.ts
var garment = (id, overrides = {}) => ({
  id,
  slot: "base_top",
  category: "top",
  subcategory: "blouse",
  colors: [],
  warmth: 3,
  purchasePrice: null,
  wearCount: 0,
  ...overrides
});
var piece = (id, looks, worn, overrides = {}) => ({
  garment: garment(id, overrides),
  looks,
  worn
});
var weather = (overrides = {}) => ({
  feelsLikeC: 20,
  highC: 24,
  lowC: 16,
  precipitationChance: 0,
  windKph: 8,
  swing: false,
  ...overrides
});
test("garmentLabel capitalises the subcategory", () => {
  assert.equal(garmentLabel(garment("a", { subcategory: "linen blouse" })), "Linen blouse");
});
test("garmentLabel falls back to the category when there is no subcategory", () => {
  assert.equal(garmentLabel(garment("a", { subcategory: null, category: "top" })), "Top");
});
test("the bag header is the piece count alone when any piece has no price", () => {
  const items = [
    piece("a", 3, false, { purchasePrice: 68, wearCount: 5 }),
    piece("b", 4, false, { purchasePrice: null, wearCount: 2 })
  ];
  assert.equal(bagHeaderLine(items), "2 pieces");
});
test("the bag header carries a real per-wear figure once every piece is priced", () => {
  const items = [
    piece("a", 3, false, { purchasePrice: 100, wearCount: 10 }),
    // $10/wear
    piece("b", 4, false, { purchasePrice: 50, wearCount: 5 })
    // $10/wear
  ];
  assert.equal(bagHeaderLine(items), "2 pieces \xB7 $10.00 per wear");
});
test("a priced piece nobody has worn yet drops the fragment rather than dividing by zero", () => {
  const items = [piece("a", 1, false, { purchasePrice: 40, wearCount: 0 })];
  assert.equal(bagHeaderLine(items), "1 piece");
});
test("an empty bag is just the count", () => {
  assert.equal(bagHeaderLine([]), "0 pieces");
});
test('K-05: "Eleven pieces, eight looks, one bag."', () => {
  assert.equal(memoHeadline(11, 8), "Eleven pieces, eight looks, one bag.");
});
test("memoHeadline keeps singular pieces and looks honest", () => {
  assert.equal(memoHeadline(1, 1), "One piece, one look, one bag.");
});
test(`K-06: "Six looks, not eight \u2014 you don't own anything that works for evenings."`, () => {
  assert.equal(
    shortfallSentence(8, 2, "evening"),
    "Six looks, not eight \u2014 you don't own anything that works for evenings."
  );
});
test("shortfallSentence with no identifiable gap still states the real numbers", () => {
  assert.equal(
    shortfallSentence(4, 4, null),
    "Zero looks, not four \u2014 your closet doesn't have enough pieces for every look this trip needs."
  );
});
test("firstUnfilledPart names the first look the closet could not fill", () => {
  const looks = [
    { dayIndex: 0, date: "2026-09-12", part: "daytime", weather: null, outfit: {} },
    { dayIndex: 0, date: "2026-09-12", part: "evening", weather: null, outfit: null }
  ];
  assert.equal(firstUnfilledPart(looks), "evening");
});
test("firstUnfilledPart is null when nothing failed", () => {
  const looks = [
    { dayIndex: 0, date: "2026-09-12", part: "daytime", weather: null, outfit: {} }
  ];
  assert.equal(firstUnfilledPart(looks), null);
});
test("forecastSummaryLine states the real range and counts wet days honestly", () => {
  const forecasts = [
    weather({ lowC: 19, highC: 24, precipitationChance: 0.1 }),
    weather({ lowC: 20, highC: 27, precipitationChance: 0.6 })
  ];
  assert.equal(forecastSummaryLine(forecasts), "66\u201381\xB0, one wet day.");
  assert.equal(forecastSummaryLine(forecasts, "C"), "19\u201327\xB0, one wet day.");
});
test('forecastSummaryLine says "no wet days" rather than "zero"', () => {
  const forecasts = [weather({ lowC: 10, highC: 15, precipitationChance: 0 })];
  assert.equal(forecastSummaryLine(forecasts, "C"), "10\u201315\xB0, no wet days.");
});
test("closetWeatherFit counts only the pieces whose warmth suits the real forecast", () => {
  const wardrobe = [
    garment("cold", { warmth: 5 }),
    garment("mid", { warmth: 3 }),
    garment("hot", { warmth: 1 })
  ];
  const forecasts = [weather({ lowC: 20, highC: 30 })];
  const fit = closetWeatherFit(wardrobe, forecasts);
  assert.equal(fit.total, 3);
  assert.ok(fit.suitable < fit.total, "the coldest-rated piece should not count as right for a warm trip");
});
